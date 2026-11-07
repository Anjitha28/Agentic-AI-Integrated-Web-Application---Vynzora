# VYNZORA AI - Python LiveKit Voice Agent Worker

This is the standalone Python backend worker for **Vynzora AI Voice Agent**. It integrates LiveKit WebRTC audio streaming with Google Gemini 2.0 and the live Vynzora Supabase CRM database.

## Architecture

- **Audio Streaming & Rooms**: LiveKit Cloud / Server WebRTC
- **Voice Activity Detection**: Silero VAD (instant speech interruption support)
- **Speech-to-Text (STT)**: Google Speech / Multilingual (`en-US`, `ml-IN`, `hi-IN`)
- **Reasoning & Tool Execution**: Google Gemini 2.0 Flash
- **Database Tools**: Directly connected to Vynzora Next.js `/api/ai/chat` endpoints and Supabase
- **Text-to-Speech (TTS)**: Natural conversational speech output in English, Malayalam, and Hindi

## Setup Instructions

### 1. Create a Python Virtual Environment
```bash
cd livekit-agent
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update with your LiveKit and Gemini API keys:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GEMINI_API_KEY`
- `VYNZORA_API_URL` (e.g. `http://localhost:3000` or your deployed Vercel domain)

### 4. Run the Agent Locally
```bash
python agent.py dev
```

The agent will connect to your LiveKit Cloud project and automatically join voice rooms when requested by administrators from the Vynzora web application.

