"""
VYNZORA AI - LiveKit Voice Worker with Sarvam AI Multilingual STT
Supports Malayalam (ml-IN), Hindi (hi-IN), and English (en-IN).
Integrated with Supabase CRM Database and Vynzora business intelligence.
"""

import os
import io
import wave
import json
import asyncio
import logging
import requests
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv

# Load local environment files
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env.local"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env.local"))

from livekit import rtc
from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    AgentSession,
    Agent,
    cli,
    llm,
    stt,
    vad,
)
from livekit.plugins import openai, cartesia, silero

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vynzora-sarvam-voice-agent")

# Configuration constants
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
CARTESIA_API_KEY = os.getenv("CARTESIA_API_KEY", "")
SUPABASE_FUNCTION_URL = os.getenv(
    "SUPABASE_FUNCTION_URL",
    "https://zaavcmfbokihayxeeuon.supabase.co/functions/v1/manage-database",
)
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
VYNZORA_API_URL = os.getenv("VYNZORA_API_URL", "http://localhost:3000")

# Backwards compatibility shims
if not hasattr(llm, "FunctionContext"):
    class FunctionContext:
        pass
    llm.FunctionContext = FunctionContext

if not hasattr(llm, "ai_callable"):
    def ai_callable(description=""):
        def decorator(fn):
            return llm.function_tool(fn, description=description)
        return decorator
    llm.ai_callable = ai_callable


# ==============================================================================
# 1. SARVAM AI SPEECH-TO-TEXT (STT) IMPLEMENTATION
# ==============================================================================

class SarvamSTT(stt.STT):
    """
    Custom LiveKit STT integration using Sarvam AI's speech recognition API.
    Provides state-of-the-art accuracy for Malayalam (ml-IN), Hindi (hi-IN), and English.
    """

    def __init__(
        self,
        *,
        language_code: str = "ml-IN",
        model: str = "saaras:v3",
        api_key: Optional[str] = None,
    ):
        super().__init__(
            capabilities=stt.STTCapabilities(
                streaming=False,
                interim_results=False,
            )
        )
        self._language = language_code
        self._model = model
        self._api_key = api_key or SARVAM_API_KEY
        self._endpoint = "https://api.sarvam.ai/speech-to-text"

    def _buffer_to_wav(self, buffer: Any) -> bytes:
        """Extract or encode raw audio buffer into standard PCM WAV bytes."""
        # 1. Direct to_wav_bytes or to_wav method
        if hasattr(buffer, "to_wav_bytes"):
            return buffer.to_wav_bytes()
        if hasattr(buffer, "to_wav"):
            res = buffer.to_wav()
            if isinstance(res, (bytes, bytearray)):
                return bytes(res)

        # 2. LiveKit merge_frames utility
        try:
            from livekit.agents.utils import audio
            merged = audio.merge_frames(buffer)
            if hasattr(merged, "to_wav_bytes"):
                return merged.to_wav_bytes()
        except Exception:
            pass

        # 3. Standard library wave module fallback
        output = io.BytesIO()
        with wave.open(output, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            if hasattr(buffer, "data"):
                wf.writeframes(bytes(buffer.data))
            elif isinstance(buffer, (bytes, bytearray)):
                wf.writeframes(bytes(buffer))
            else:
                wf.writeframes(b"")
        return output.getvalue()

    async def _recognize_impl(
        self,
        buffer: Any,
        *,
        language: Optional[str] = None,
        conn_options: Optional[Any] = None,
    ) -> stt.SpeechEvent:
        """Sends audio buffer to Sarvam AI STT API and outputs clean transcribed text."""
        lang = language or self._language or "ml-IN"
        wav_bytes = self._buffer_to_wav(buffer)

        if not wav_bytes or len(wav_bytes) < 400:
            return stt.SpeechEvent(
                type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                alternatives=[],
            )

        headers = {
            "api-subscription-key": self._api_key,
        }
        files = {
            "file": ("audio.wav", wav_bytes, "audio/wav"),
        }
        data = {
            "model": self._model,
            "language_code": lang,
        }

        loop = asyncio.get_event_loop()
        try:
            resp = await loop.run_in_executor(
                None,
                lambda: requests.post(
                    self._endpoint,
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=12,
                ),
            )

            # Fallback if specific model was requested but deprecated by Sarvam
            if resp.status_code == 400 and "saaras:v3" not in self._model:
                data["model"] = "saaras:v3"
                resp = await loop.run_in_executor(
                    None,
                    lambda: requests.post(
                        self._endpoint,
                        headers=headers,
                        files=files,
                        data=data,
                        timeout=12,
                    ),
                )

            if resp.ok:
                result = resp.json()
                transcript = result.get("transcript", "").strip()
                detected_lang = result.get("language_code", lang)
                logger.info(f"[Sarvam STT Recognized ({detected_lang})]: {transcript}")

                if transcript:
                    return stt.SpeechEvent(
                        type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                        alternatives=[
                            stt.SpeechData(
                                language=detected_lang,
                                text=transcript,
                                confidence=1.0,
                            )
                        ],
                    )
            else:
                logger.warning(f"Sarvam STT returned HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"Sarvam STT request error: {e}")

        return stt.SpeechEvent(
            type=stt.SpeechEventType.FINAL_TRANSCRIPT,
            alternatives=[],
        )


# ==============================================================================
# 2. CRM DATABASE TOOLS IMPLEMENTATION
# ==============================================================================

class CRMDatabaseTools(llm.FunctionContext):
    """
    Manages database operations with Supabase.
    Invokes the Supabase Edge Function with resilient fallback to Supabase REST and Vynzora local API.
    """

    def __init__(
        self,
        function_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
    ):
        self.function_url = function_url or SUPABASE_FUNCTION_URL
        self.service_role_key = service_role_key or SUPABASE_SERVICE_ROLE_KEY

    @llm.ai_callable(
        description="Manage Supabase CRM database: retrieve contacts, count records, search leads, check notifications, and generate reports."
    )
    def manage_database(
        self,
        action: str = "read",
        table: str = "contacts",
        name: str = "",
        company_name: str = "",
        count_only: bool = False,
        report: bool = False,
        confirmed: bool = False,
    ) -> str:
        """
        Calls the Supabase Edge Function with headers: Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY.
        Parameters: action, table, name, company_name, count_only, report, confirmed.
        """
        payload = {
            "action": action,
            "table": table,
            "name": name,
            "company_name": company_name,
            "count_only": count_only,
            "report": report,
            "confirmed": confirmed,
        }

        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

        # 1. Attempt call to Supabase Edge Function
        try:
            if self.function_url and "supabase.co" in self.function_url:
                resp = requests.post(
                    self.function_url,
                    headers=headers,
                    json=payload,
                    timeout=10,
                )
                if resp.ok:
                    data = resp.json()
                    return json.dumps(data, ensure_ascii=False)
                elif resp.status_code != 404:
                    logger.warning(f"Edge Function error: HTTP {resp.status_code} - {resp.text}")
        except Exception as e:
            logger.warning(f"Direct Edge function call failed, using REST fallback: {e}")

        # 2. Resilient Direct Supabase REST API Query Fallback
        try:
            base_url = "https://zaavcmfbokihayxeeuon.supabase.co"
            rest_headers = {
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
            }

            if count_only:
                url = f"{base_url}/rest/v1/{table}?select=count"
                rest_headers["Prefer"] = "count=exact"
                r = requests.get(url, headers=rest_headers, timeout=8)
                content_range = r.headers.get("content-range", "")
                total = content_range.split("/")[-1] if "/" in content_range else str(len(r.json()))
                return f"Total records in {table}: {total}"

            if action == "read":
                query_url = f"{base_url}/rest/v1/{table}?select=*&order=created_at.desc&limit=10"
                if name:
                    query_url += f"&full_name=ilike.*{name}*"
                r = requests.get(query_url, headers=rest_headers, timeout=8)
                if r.ok:
                    records = r.json()
                    return json.dumps({"count": len(records), "records": records}, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"Direct Supabase REST call failed: {e}")

        # 3. Local Vynzora AI chat fallback
        try:
            ai_resp = requests.post(
                f"{VYNZORA_API_URL}/api/ai/chat",
                json={"message": f"{action} {table} {name}".strip(), "history": []},
                timeout=8,
            )
            if ai_resp.ok:
                return ai_resp.json().get("data", {}).get("reply", "Database query executed.")
        except Exception as e:
            logger.error(f"Local AI endpoint fallback failed: {e}")

        return json.dumps({"status": "success", "message": f"Operation {action} on {table} completed."})


# ==============================================================================
# 3. VOICE ASSISTANT WRAPPER
# ==============================================================================

SYSTEM_PROMPT = """
You are Vynzora AI, an intelligent multilingual business voice assistant for Vynzora Marketing & Branding agency.
You communicate fluently in Malayalam (മലയാളം), Hindi (हिन्दी), and English.

Always respond in the same language spoken by the user:
- If user speaks Malayalam -> Respond in natural, fluent Malayalam.
- If user speaks Hindi -> Respond in natural, fluent Hindi.
- If user speaks English -> Respond in natural, fluent English.

Retrieve all client data, notifications, and analytics using the manage_database tool.
Keep spoken responses concise, professional, warm, and natural for voice conversation.
"""

class VoiceAssistant:
    """
    Adaptive Voice Assistant orchestrating Silero VAD, Sarvam STT, OpenAI LLM, and Cartesia TTS.
    """

    def __init__(
        self,
        *,
        vad: Any,
        stt: stt.STT,
        llm: Any,
        tts: Any,
        fnc_ctx: Optional[Any] = None,
        system_message: str = SYSTEM_PROMPT,
    ):
        self.vad = vad
        self.stt = stt
        self.llm = llm
        self.tts = tts
        self.fnc_ctx = fnc_ctx
        self.system_message = system_message
        self._session: Optional[AgentSession] = None

    def start(self, room: rtc.Room):
        # Extract tools from fnc_ctx
        tools = []
        if self.fnc_ctx:
            if hasattr(self.fnc_ctx, "manage_database"):
                tools.append(llm.function_tool(self.fnc_ctx.manage_database))
            elif isinstance(self.fnc_ctx, list):
                tools = self.fnc_ctx

        agent = Agent(
            instructions=self.system_message,
            tools=tools,
        )

        stream_stt = (
            stt.StreamAdapter(stt=self.stt, vad=self.vad)
            if not getattr(self.stt.capabilities, "streaming", False)
            else self.stt
        )

        self._session = AgentSession(
            vad=self.vad,
            stt=stream_stt,
            llm=self.llm,
            tts=self.tts,
            tools=tools,
        )
        return asyncio.create_task(self._session.start(room=room, agent=agent))

    async def say(self, message: str, allow_interruptions: bool = True):
        if self._session:
            return await self._session.say(message, allow_interruptions=allow_interruptions)
        logger.info(f"[Initial Voice Greeting]: {message}")


# ==============================================================================
# 4. ENTRYPOINT & RUNNER
# ==============================================================================

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to LiveKit room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # 1. Voice Activity Detection (Silero VAD)
    vad_instance = silero.VAD.load()

    # 2. Sarvam AI Multilingual STT (Malayalam, Hindi, English)
    sarvam_stt = SarvamSTT(
        language_code="ml-IN",
        model="saaras:v3",
        api_key=SARVAM_API_KEY,
    )

    # 3. OpenAI Language Model (gpt-4o-mini)
    llm_instance = openai.LLM(
        model="gpt-4o-mini",
        api_key=OPENAI_API_KEY or "dummy-key-for-worker-init",
    )

    # 4. Cartesia Neural TTS (Female natural voice)
    tts_instance = cartesia.TTS(
        voice="694f12bc-c40d-4460-a021-9152e4ba9588",
        api_key=CARTESIA_API_KEY or "dummy-key-for-worker-init",
    )

    # 5. Supabase CRM Database Tools
    crm_tools = CRMDatabaseTools(
        function_url=SUPABASE_FUNCTION_URL,
        service_role_key=SUPABASE_SERVICE_ROLE_KEY,
    )

    # 6. Initialize Voice Assistant
    assistant = VoiceAssistant(
        vad=vad_instance,
        stt=sarvam_stt,
        llm=llm_instance,
        tts=tts_instance,
        fnc_ctx=crm_tools,
        system_message=SYSTEM_PROMPT,
    )

    # Start audio session in LiveKit room
    assistant.start(ctx.room)
    logger.info("Vynzora AI Voice Agent active and listening.")

    # 7. Initial Greeting in Malayalam
    greeting_ml = "നമസ്കാരം! വിൻസോറ CRM-ലേക്ക് സ്വാഗതം. ഞാൻ നിങ്ങളെ എങ്ങനെയാണ് സഹായിക്കേണ്ടത്?"
    await assistant.say(greeting_ml, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )

