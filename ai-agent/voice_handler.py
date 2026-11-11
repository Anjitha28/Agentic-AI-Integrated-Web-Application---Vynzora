import io
import os
import tempfile
import logging
from typing import Tuple
from gtts import gTTS
from sarvamai import SarvamAI
import config
from language_handler import map_language_to_tts, clean_text_for_voice

logger = logging.getLogger("vynzora-voice-handler")

_sarvam_client: SarvamAI = None

def get_sarvam_client() -> SarvamAI:
    """Initializes and caches the Sarvam AI client."""
    global _sarvam_client
    if _sarvam_client is None:
        config.validate_config()
        _sarvam_client = SarvamAI(api_subscription_key=config.SARVAM_API_KEY)
    return _sarvam_client


def transcribe_audio_file(file_path_or_bytes: io.BytesIO, filename: str = "audio.wav") -> Tuple[str, str]:
    """
    Transcribes user audio using Sarvam AI Saaras v3 model in transcribe mode.
    Preserves exact Malayalam, Hindi, or English script without translation.
    Returns: (transcript, detected_language_code)
    """
    client = get_sarvam_client()

    # If BytesIO, write to temp file
    if isinstance(file_path_or_bytes, (bytes, bytearray)):
        file_obj = io.BytesIO(file_path_or_bytes)
    else:
        file_obj = file_path_or_bytes

    # Create temporary audio file for Sarvam SDK
    ext = os.path.splitext(filename)[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp_path = tmp.name
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
            tmp.write(file_obj.read())
        else:
            tmp.write(file_obj)

    try:
        with open(tmp_path, "rb") as audio_file:
            response = client.speech_to_text.transcribe(
                file=audio_file,
                model="saaras:v3",
                mode="transcribe"
            )

        transcript = getattr(response, "transcript", "") or ""
        detected_lang = getattr(response, "language_code", "en-IN") or "en-IN"

        logger.info(f"Sarvam STT success | Lang: {detected_lang} | Transcript: '{transcript}'")
        return transcript, detected_lang
    except Exception as e:
        logger.error(f"Error in Sarvam STT transcription: {e}")
        raise
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


def generate_speech_audio(text: str, detected_language: str = "en-IN") -> bytes:
    """
    Converts AI response text into natural speech audio using Google Text-to-Speech (gTTS).
    Uses clean_text_for_voice to pronounce phone numbers and strip markdown.
    """
    tts_lang = map_language_to_tts(detected_language)
    clean_text = clean_text_for_voice(text, lang=tts_lang)

    if not clean_text:
        clean_text = "I have processed your request."

    logger.info(f"Synthesizing speech with gTTS | Lang: {tts_lang} | Length: {len(clean_text)} chars")

    tts = gTTS(
        text=clean_text,
        lang=tts_lang,
        slow=False
    )

    buffer = io.BytesIO()
    tts.write_to_fp(buffer)
    buffer.seek(0)
    return buffer.read()

