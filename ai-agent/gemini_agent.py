import logging
import uuid
from typing import Dict, Any, Optional
from google import genai
from google.genai import types
import config
from database_tools import (
    get_total_enquiries,
    get_total_leads,
    get_leads_by_status,
    get_latest_enquiries,
    get_crm_analytics,
    get_unread_notifications,
    get_today_notifications,
    get_high_priority_notifications,
    get_scheduled_notifications,
    search_customer,
    get_customer_complete_details,
    create_customer,
    update_lead,
    delete_lead,
    read_database,
    mark_notification_as_read,
)

logger = logging.getLogger("vynzora-gemini-agent")

MODEL_NAME = "gemini-3.5-flash-lite"

SYSTEM_INSTRUCTION = """
You are Vynzora AI Business Assistant.

You help users manage and analyse the Vynzora CRM database.

You can:
- Retrieve customer enquiries.
- Analyse CRM leads.
- Count leads by status.
- Retrieve notifications.
- Generate CRM summaries.
- Search customer profiles and complete interaction histories.
- Create new customer contacts in the database.
- Update and manage CRM leads.
- Delete CRM leads when requested.

Rules:
1. Use Python tools to retrieve actual database information.
2. Never invent customer records or analytics.
3. Answer using actual results returned by the tools.
4. Understand Malayalam (മലയാളം), English, and Hindi (हिन्दी).
5. Always respond in the same language used by the user:
   - If user asks in Malayalam, reply in natural, fluent Malayalam script.
   - If user asks in Hindi, reply in natural, fluent Hindi in Devanagari script.
   - If user asks in English, reply in clear, professional English.
6. Keep customer names, phone numbers, and database values accurate.
7. Explain results in simple, conversational language.
8. If the user asks a database question, use the relevant tools immediately.
9. For simple greetings (e.g., "ഹലോ", "Hello", "നമസ്കാരം", "नमस्ते"), respond warmly and concisely in the same language without calling database tools.
"""

CRM_TOOLS = [
    get_total_enquiries,
    get_total_leads,
    get_leads_by_status,
    get_latest_enquiries,
    get_crm_analytics,
    get_unread_notifications,
    get_today_notifications,
    get_high_priority_notifications,
    get_scheduled_notifications,
    search_customer,
    get_customer_complete_details,
    create_customer,
    update_lead,
    delete_lead,
    read_database,
    mark_notification_as_read,
]

class GeminiAgentManager:
    """
    Manages stateful Gemini Chat sessions with native tool execution.
    Maintains persistent multi-turn conversational context across text and voice turns.
    """

    def __init__(self):
        config.validate_config()
        self.client = genai.Client(api_key=config.GEMINI_API_KEY)
        self.sessions: Dict[str, Any] = {}

    def get_or_create_chat(self, session_id: Optional[str] = None) -> tuple[Any, str]:
        """
        Retrieves existing chat session or creates a new one with the Colab system instructions and tools.
        """
        if not session_id:
            session_id = str(uuid.uuid4())

        if session_id not in self.sessions:
            logger.info(f"Creating new Gemini chat session: {session_id} using {MODEL_NAME}")
            chat = self.client.chats.create(
                model=MODEL_NAME,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    tools=CRM_TOOLS,
                    temperature=0.2,
                )
            )
            self.sessions[session_id] = chat

        return self.sessions[session_id], session_id

    def process_message(
        self,
        message: str,
        session_id: Optional[str] = None,
        detected_language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sends a message to the Gemini Agent and executes any required database tools natively.
        """
        chat, active_session_id = self.get_or_create_chat(session_id)

        # If a specific language code was detected from voice (e.g. ml-IN, hi-IN),
        # include language context guidance as in the Colab notebook.
        if detected_language:
            prompt = f"""The user's language is {detected_language}.
Understand the user's question and respond in the same language.
Do not translate the answer into another language.
Use the available Python database tools whenever the question requires CRM information.
Never invent database information.

User question:
{message}"""
        else:
            prompt = message

        logger.info(f"[Session {active_session_id}] Processing user prompt: '{message}'")
        response = chat.send_message(prompt)
        ai_text = response.text or ""

        return {
            "response": ai_text,
            "session_id": active_session_id
        }

# Global singleton
agent_manager = GeminiAgentManager()

