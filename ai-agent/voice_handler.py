import io
import os
import re
import tempfile
import logging
from typing import Tuple, List
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


def split_into_sentences(text: str, lang: str = "en") -> List[str]:
    """
    Splits cleaned text into sentences supporting Malayalam, Hindi, and English punctuation.
    """
    clean = clean_text_for_voice(text, lang=lang)
    if not clean or not clean.strip():
        return []

    # Split on terminal punctuation followed by whitespace
    raw_sentences = [x.strip() for x in re.split(r'(?<=[.?!।\n])\s+', clean.strip()) if x.strip()]
    if not raw_sentences:
        return [clean.strip()]

    # If first sentence is tiny (e.g. "Yes." or "ഹലോ!"), merge it with the second if available
    merged = []
    i = 0
    while i < len(raw_sentences):
        current = raw_sentences[i]
        if len(current) < 15 and i + 1 < len(raw_sentences):
            merged.append(current + " " + raw_sentences[i + 1])
            i += 2
        else:
            merged.append(current)
            i += 1

    return merged if merged else [clean.strip()]


def generate_speech_audio_chunks(text: str, detected_language: str = "en-IN") -> Tuple[bytes, List[bytes], List[str]]:
    """
    Converts AI response into sentence-level audio chunks.
    Sentence 1 is synthesized first for immediate playback (~250-350ms first-audio latency).
    Subsequent sentences are synthesized and returned for background queuing.
    Returns: (first_chunk_audio_bytes, list_of_all_chunk_bytes, sentence_texts)
    """
    tts_lang = map_language_to_tts(detected_language)
    sentences = split_into_sentences(text, lang=tts_lang)

    if not sentences:
        fallback = generate_speech_audio("I have processed your request.", detected_language)
        return fallback, [fallback], ["I have processed your request."]

    chunks: List[bytes] = []
    for s in sentences:
        try:
            chunk_bytes = generate_speech_audio(s, detected_language)
            chunks.append(chunk_bytes)
        except Exception as e:
            logger.warning(f"Error synthesizing chunk '{s[:30]}...': {e}")

    if not chunks:
        fallback = generate_speech_audio(text, detected_language)
        return fallback, [fallback], [text]

    return chunks[0], chunks, sentences


