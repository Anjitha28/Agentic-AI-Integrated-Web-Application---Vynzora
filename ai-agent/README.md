# Vynzora AI Business Assistant – Python Backend Service

This service is the production-grade implementation of the reference Google Colab AI agent (`Agent_Zora.ipynb`).

---

## 🎯 Architecture & Models

- **LLM Reasoning**: Google Gemini `gemini-3.5-flash-lite` with native function calling via the official `google-genai` SDK.
- **Speech-to-Text (STT)**: Sarvam AI `saaras:v3` model (`mode="transcribe"`), providing native transcription and language detection for **Malayalam (`ml-IN`)**, **Hindi (`hi-IN`)**, and **English (`en-IN`)**.
- **Text-to-Speech (TTS)**: Google Text-to-Speech (`gTTS`) with phone-number pronunciation and text-cleaning logic.
- **Database**: Live Supabase PostgreSQL database authenticated with dedicated email & password credentials.
- **Unified Memory**: Persistent conversation context across both text chat and voice turns via stateful `session_id`.

---

## 🔑 Environment Variables

The following variables must be configured in `.env` or in the host environment:

```env
# Google Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# Sarvam AI API Key
SARVAM_API_KEY=your_sarvam_api_key

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase Dedicated Auth Credentials
SUPABASE_EMAIL=your_supabase_user_email
SUPABASE_PASSWORD=your_supabase_user_password

# Server Settings (Optional)
HOST=0.0.0.0
PORT=8000
```

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Start the FastAPI Server
```bash
python main.py
# or using uvicorn directly:
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at:
- **API Base URL**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check & model status |
| `POST` | `/agent/chat` | Multi-turn text conversation with native Supabase tools |
| `POST` | `/agent/voice` | Multilingual audio processing: Sarvam STT $\rightarrow$ Gemini $\rightarrow$ gTTS audio |
| `POST` | `/agent/voice/transcribe` | Standalone audio transcription using Sarvam Saaras v3 |
| `POST` | `/agent/voice/speak` | Converts arbitrary text into speech MP3 audio via gTTS |

---

## ☁️ Production Deployment

Deploy this service on any container or persistent Python hosting platform (e.g., Render, Railway, Google Cloud Run, Fly.io, or an AWS/DigitalOcean VM):

1. **Deploy Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
2. Configure the environment variables in your deployment dashboard.
3. In your Next.js application, set:
   ```env
   AI_AGENT_BACKEND_URL=https://your-deployed-ai-agent.com
   ```

