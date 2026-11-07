"""
VYNZORA AI - Python LiveKit Voice Agent Worker
Real-time conversational voice assistant connected to Vynzora Supabase CRM database.
Supports English, Malayalam, and Hindi with automatic language detection.
"""

import os
import json
import logging
import requests
from dotenv import load_dotenv

from livekit.agents import (
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice_assistant import VoiceAssistant
from livekit.plugins import silero, google

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vynzora-ai-agent")

# Target Vynzora Web App Base URL for Tool Execution
VYNZORA_API_URL = os.getenv("VYNZORA_API_URL", "http://localhost:3000")

SYSTEM_PROMPT = """
You are Vynzora AI, a multilingual business assistant.

You communicate in Malayalam, English and Hindi.

Always identify the language used in the latest user message.

Respond in the same language as the latest user message.

If the user speaks Malayalam, respond naturally in Malayalam.

If the user speaks English, respond in English.

If the user speaks Hindi, respond naturally in Hindi.

Support natural code-switching and mixed-language conversations.

Never force English responses.

Never translate the response into another language unless explicitly requested.

Regardless of the language used, retrieve all business information from the connected Supabase database.

Database retrieval, calculations, analytics and report generation must remain accurate and consistent across all supported languages.

CRITICAL INSTRUCTIONS:
1. DATABASE TOOLS:
   - Use the provided functions to query live CRM data, customer inquiries, follow-ups, and notifications.
   - Do NOT invent or fabricate statistics, client names, or financial numbers.
2. MULTILINGUAL VOICE AGENT:
   - If user speaks English -> Respond verbally in English.
   - If user speaks Malayalam (or Manglish) -> Respond verbally in natural, fluent Malayalam.
   - If user speaks Hindi (or Hinglish) -> Respond verbally in natural, fluent Hindi.
   - Keep spoken answers concise, conversational, and direct for audio communication.
"""

class VynzoraDatabaseTools:
    """Helper class invoking Vynzora Next.js API tool endpoints."""

    @staticmethod
    def _call_ai_api(query: str):
        try:
            res = requests.post(
                f"{VYNZORA_API_URL}/api/ai/chat",
                json={"message": query, "history": []},
                timeout=10,
            )
            if res.ok:
                return res.json().get("data", {})
        except Exception as e:
            logger.error(f"Error querying Vynzora API: {e}")
        return {"reply": "Unable to connect to Vynzora database at this moment."}

    @llm.ai_callable(description="Query the CRM summary, pipeline counts, and conversion rate.")
    def get_crm_overview(self) -> str:
        data = self._call_ai_api("Give me the CRM summary.")
        return data.get("reply", "CRM summary retrieved.")

    @llm.ai_callable(description="Get today's active notifications and scheduled alerts.")
    def get_today_notifications(self) -> str:
        data = self._call_ai_api("Show me today's notifications.")
        return data.get("reply", "Today's notifications retrieved.")

    @llm.ai_callable(description="List customers needing urgent follow-up touchpoints.")
    def get_pending_followups(self) -> str:
        data = self._call_ai_api("Which customers need follow-up?")
        return data.get("reply", "Follow-ups retrieved.")

    @llm.ai_callable(description="Retrieve latest customer inquiries from the website.")
    def get_latest_enquiries(self) -> str:
        data = self._call_ai_api("Show me the latest customer enquiries.")
        return data.get("reply", "Latest enquiries retrieved.")

    @llm.ai_callable(description="Get client service category demand ranking and analysis.")
    def get_service_demand(self) -> str:
        data = self._call_ai_api("Which services are most requested?")
        return data.get("reply", "Service demand retrieved.")

    @llm.ai_callable(description="List all customer contact names registered in the Supabase database.")
    def get_all_contacts(self) -> str:
        data = self._call_ai_api("Show all contacts.")
        return data.get("reply", "Customer contacts retrieved.")

    @llm.ai_callable(description="Get the total count of customer contacts in the database.")
    def get_contact_count(self) -> str:
        data = self._call_ai_api("How many contacts do we have?")
        return data.get("reply", "Contact count retrieved.")

    @llm.ai_callable(description="Retrieve complete profile and details for a specific customer or all contacts.")
    def get_contact_details(self, contact_name: str = "") -> str:
        prompt = f"Show {contact_name}'s contact details." if contact_name else "Show all contact details."
        data = self._call_ai_api(prompt)
        return data.get("reply", "Contact details retrieved.")

    @llm.ai_callable(description="Create a new customer contact with company, email, phone, and required service.")
    def create_contact(self, full_name: str, company_name: str, email: str, phone: str, service: str = "Brand Identity & Rebranding") -> str:
        prompt = f"Add a new contact named {full_name}, working at {company_name}, email {email}, phone {phone}, interested in {service}"
        data = self._call_ai_api(prompt)
        return data.get("reply", f"Contact for {full_name} created.")

    @llm.ai_callable(description="Update a contact field (company, phone) or CRM lead status (e.g. Converted).")
    def update_contact_or_lead(self, target_name: str, status_or_update: str) -> str:
        prompt = f"Change {target_name}'s lead status to {status_or_update}"
        data = self._call_ai_api(prompt)
        return data.get("reply", f"Updated {target_name}.")

    @llm.ai_callable(description="Delete a contact record or confirm a pending contact deletion.")
    def delete_contact(self, contact_name: str, confirmation: str = "yes confirm delete") -> str:
        prompt = f"Delete {contact_name}'s contact"
        data = self._call_ai_api(prompt)
        return data.get("reply", f"Deletion processed for {contact_name}.")

    @llm.ai_callable(description="General intelligent assistant tool to query Vynzora Supabase database, website services, analytics, or CRM in English, Malayalam, or Hindi.")
    def query_vynzora_database(self, user_query: str) -> str:
        data = self._call_ai_api(user_query)
        return data.get("reply", "Information processed.")


async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room: {ctx.room.name}")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # Initialize Silero Voice Activity Detection (VAD) for real-time speech interruption
    vad = silero.VAD.load()

    # Initialize Gemini multimodal LLM plugin
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        logger.warning("GEMINI_API_KEY is not set. Ensure Gemini credentials are in .env")

    gemini_model = google.LLM(
        model="gemini-2.0-flash",
        api_key=gemini_key,
    )

    # Connect Voice Assistant with VAD, Gemini LLM, and Vynzora tools
    assistant = VoiceAssistant(
        vad=vad,
        stt=google.STT(languages=["en-US", "ml-IN", "hi-IN"]),
        llm=gemini_model,
        tts=google.TTS(gender="female"),
        fnc_ctx=VynzoraDatabaseTools(),
        system_message=SYSTEM_PROMPT,
    )

    # Start conversational agent session
    assistant.start(ctx.room)
    logger.info("Vynzora AI Voice Agent active and listening.")

    # Greet the admin
    await assistant.say(
        "Hello! I am Vynzora AI, your business assistant. I'm connected to your live CRM database. How can I assist you today?",
        allow_interruptions=True,
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )

