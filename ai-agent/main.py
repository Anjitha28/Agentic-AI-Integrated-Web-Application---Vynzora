import base64
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
import uvicorn

import config
from gemini_agent import agent_manager, MODEL_NAME
from voice_handler import transcribe_audio_file, generate_speech_audio, generate_speech_audio_chunks

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vynzora-ai-agent-api")

app = FastAPI(
    title="Vynzora AI Business Assistant API",
    description="Python FastAPI backend replicating Agent_Zora.ipynb: Gemini 3.5 Flash Lite + Sarvam Saaras v3 + gTTS + Supabase PostgreSQL CRM",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    language: Optional[str] = None

class SpeakRequest(BaseModel):
    text: str
    language: Optional[str] = "en-IN"

class CancelRequest(BaseModel):
    session_id: str


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing Vynzora AI Agent backend...")
    config.validate_config()
    logger.info("Vynzora AI Agent backend initialized and ready.")


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Vynzora AI Business Assistant",
        "llm_model": MODEL_NAME,
        "stt_model": "sarvam:saaras:v3",
        "tts_engine": "gTTS",
        "database": "Supabase PostgreSQL",
        "active_sessions": len(agent_manager.sessions),
    }


@app.post("/agent/cancel")
async def cancel_endpoint(payload: CancelRequest):
    """
    Cancels in-flight Gemini generation & prevents late TTS synthesis
    when the user interrupts the assistant.
    """
    agent_manager.cancel_session(payload.session_id)
    return {"status": "success", "session_id": payload.session_id}


@app.post("/agent/chat")
async def chat_endpoint(payload: ChatRequest):
    """
    Text Chat Endpoint:
    Sends user message to Gemini Agent (gemini-3.5-flash-lite) with native Supabase tool execution.
    Maintains persistent multi-turn chat history via session_id.
    Synthesizes and returns gTTS speech audio so voice playback is always complete.
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    try:
        result = agent_manager.process_message(
            message=payload.message.strip(),
            session_id=payload.session_id,
            detected_language=payload.language
        )

        if result.get("cancelled"):
            return {
                "status": "cancelled",
                "response": "",
                "session_id": result["session_id"],
                "audio_base64": None
            }

        ai_text = result["response"]
        detected_lang = result.get("detected_language") or payload.language or "en-IN"

        # Generate fast first sentence chunk and full chunks for rapid playback
        first_audio_base64 = None
        audio_chunks_base64 = []
        audio_base64 = None
        try:
            first_chunk_bytes, all_chunks_bytes, sentences = generate_speech_audio_chunks(
                text=ai_text,
                detected_language=detected_lang
            )
            first_audio_base64 = base64.b64encode(first_chunk_bytes).decode("utf-8")
            audio_chunks_base64 = [base64.b64encode(c).decode("utf-8") for c in all_chunks_bytes]
            audio_base64 = base64.b64encode(b"".join(all_chunks_bytes)).decode("utf-8")
        except Exception as tts_err:
            logger.warning(f"Could not synthesize speech audio in /agent/chat: {tts_err}")

        return {
            "status": "success",
            "response": ai_text,
            "session_id": result["session_id"],
            "detected_language": detected_lang,
            "first_audio_base64": first_audio_base64,
            "audio_chunks": audio_chunks_base64,
            "audio_base64": audio_base64
        }
    except Exception as e:
        logger.error(f"Error in /agent/chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Agent processing error: {str(e)}")


@app.post("/agent/voice")
async def voice_endpoint(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None)
):
    """
    Multilingual Voice Endpoint:
    1. Transcribes audio using Sarvam Saaras v3 (ml-IN, hi-IN, en-IN).
    2. Passes original transcript to Gemini Agent with native Supabase tools.
    3. Synthesizes AI response audio using gTTS (clean text + digit pronunciation).
    4. Returns transcript, detected language, AI response text, and base64 audio.
    """
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")

        # 1. Speech-to-Text via Sarvam AI
        transcript, detected_lang = transcribe_audio_file(
            file_path_or_bytes=audio_bytes,
            filename=audio.filename or "recording.wav"
        )

        if not transcript or not transcript.strip():
            return {
                "status": "unrecognized",
                "transcript": "",
                "detected_language": detected_lang,
                "response": "Could not recognize speech. Please speak clearly into your microphone.",
                "audio_base64": None,
                "session_id": session_id or ""
            }

        # 2. Process query with Gemini Agent (sharing same conversational session)
        result = agent_manager.process_message(
            message=transcript,
            session_id=session_id,
            detected_language=detected_lang
        )

        if result.get("cancelled"):
            return {
                "status": "cancelled",
                "transcript": transcript,
                "detected_language": detected_lang,
                "response": "",
                "audio_base64": None,
                "session_id": result["session_id"]
            }

        ai_text = result["response"]
        active_session_id = result["session_id"]

        # 3. Text-to-Speech via gTTS with chunked fast first audio delivery
        first_chunk_bytes, all_chunks_bytes, sentences = generate_speech_audio_chunks(
            text=ai_text,
            detected_language=detected_lang
        )
        first_audio_base64 = base64.b64encode(first_chunk_bytes).decode("utf-8")
        audio_chunks_base64 = [base64.b64encode(c).decode("utf-8") for c in all_chunks_bytes]
        audio_base64 = base64.b64encode(b"".join(all_chunks_bytes)).decode("utf-8")

        return {
            "status": "success",
            "transcript": transcript,
            "detected_language": detected_lang,
            "response": ai_text,
            "first_audio_base64": first_audio_base64,
            "audio_chunks": audio_chunks_base64,
            "audio_base64": audio_base64,
            "session_id": active_session_id
        }
    except Exception as e:
        logger.error(f"Error in /agent/voice: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Voice agent error: {str(e)}")


@app.post("/agent/voice/transcribe")
async def transcribe_endpoint(audio: UploadFile = File(...)):
    """Transcribes audio using Sarvam Saaras v3 without executing agent turns."""
    try:
        audio_bytes = await audio.read()
        transcript, detected_lang = transcribe_audio_file(
            file_path_or_bytes=audio_bytes,
            filename=audio.filename or "recording.wav"
        )
        return {
            "status": "success",
            "transcript": transcript,
            "detected_language": detected_lang
        }
    except Exception as e:
        logger.error(f"Error in /agent/voice/transcribe: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/agent/voice/speak")
async def speak_endpoint(payload: SpeakRequest):
    """Generates and streams speech MP3 audio for arbitrary text using gTTS."""
    try:
        audio_bytes = generate_speech_audio(
            text=payload.text,
            detected_language=payload.language or "en-IN"
        )
        return Response(content=audio_bytes, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"Error in /agent/voice/speak: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)

