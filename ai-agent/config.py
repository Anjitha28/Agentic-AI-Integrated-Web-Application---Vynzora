import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from parent .env.local and local .env
parent_env = Path(__file__).resolve().parent.parent / ".env.local"
if parent_env.exists():
    load_dotenv(parent_env)
load_dotenv()

# Gemini AI API Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Sarvam AI API Configuration
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

# Supabase Database Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

# Supabase Authentication Credentials
SUPABASE_EMAIL = os.getenv("SUPABASE_EMAIL")
SUPABASE_PASSWORD = os.getenv("SUPABASE_PASSWORD")

# Server Configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))

# Allowed CORS Origins (Vynzora web application)
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "https://*.vercel.app",
    "*"
]

def validate_config():
    """Validates required environment configuration on startup."""
    missing = []
    if not GEMINI_API_KEY:
        missing.append("GEMINI_API_KEY")
    if not SARVAM_API_KEY:
        missing.append("SARVAM_API_KEY")
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)")
    if not SUPABASE_EMAIL:
        missing.append("SUPABASE_EMAIL")
    if not SUPABASE_PASSWORD:
        missing.append("SUPABASE_PASSWORD")

    if missing:
        error_msg = f"[Config Error] Missing required environment variables: {', '.join(missing)}"
        print(error_msg, file=sys.stderr)
        raise ValueError(error_msg)

    print("[Config] All required environment variables successfully loaded.")

