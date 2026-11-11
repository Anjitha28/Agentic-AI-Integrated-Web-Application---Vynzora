import re
from typing import Dict

LANGUAGE_MAPPING: Dict[str, str] = {
    "ml-IN": "ml",
    "en-IN": "en",
    "hi-IN": "hi",
    "ml": "ml",
    "en": "en",
    "hi": "hi"
}

DIGIT_WORDS = {
    "en": {
        "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
        "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"
    },
    "ml": {
        "0": "പൂജ്യം", "1": "ഒന്ന്", "2": "രണ്ട്", "3": "മൂന്ന്", "4": "നാല്",
        "5": "അഞ്ച്", "6": "ആറ്", "7": "ഏഴ്", "8": "എട്ട്", "9": "ഒൻപത്"
    },
    "hi": {
        "0": "शून्य", "1": "एक", "2": "दो", "3": "तीन", "4": "चार",
        "5": "पाँच", "6": "छह", "7": "सात", "8": "आठ", "9": "नौ"
    }
}

def map_language_to_tts(sarvam_lang_code: str) -> str:
    """
    Maps Sarvam language code (ml-IN, hi-IN, en-IN) to gTTS language code (ml, hi, en).
    """
    if not sarvam_lang_code:
        return "en"
    clean_code = sarvam_lang_code.strip()
    return LANGUAGE_MAPPING.get(clean_code, "en")

def pronounce_phone_digits(text: str, lang: str = "en") -> str:
    """
    Converts phone numbers (sequences of 7-15 digits) into spoken digit words
    for natural pronunciation in speech synthesis.
    """
    digit_map = DIGIT_WORDS.get(lang, DIGIT_WORDS["en"])

    def replace_phone(match):
        digits_str = re.sub(r"\D", "", match.group(0))
        words = [digit_map.get(d, d) for d in digits_str]
        return " " + " ".join(words) + " "

    # Pattern for phone numbers (e.g. +91 98765 43210, 9876543210, +1 (555) 019-2831)
    phone_pattern = r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b\d{10}\b"
    return re.sub(phone_pattern, replace_phone, text)

def clean_text_for_voice(text: str, lang: str = "en") -> str:
    """
    Cleans response text for natural, pleasant speech synthesis:
    - Replaces phone numbers with clear digit pronunciations.
    - Removes markdown syntax, tables, asterisks, URLs, and code blocks.
    - Normalizes spacing.
    """
    if not text:
        return ""

    # 1. Pronounce phone digits
    cleaned = pronounce_phone_digits(text, lang)

    # 2. Remove markdown code blocks & inline code
    cleaned = re.sub(r"```[\s\S]*?```", "", cleaned)
    cleaned = re.sub(r"`([^`]+)`", r"\1", cleaned)

    # 3. Remove URLs
    cleaned = re.sub(r"https?://\S+", "", cleaned)

    # 4. Remove Markdown headers, bold, italics, strikethrough, blockquotes
    cleaned = re.sub(r"[#*_~>]", "", cleaned)

    # 5. Remove bullet point characters and table pipes
    cleaned = re.sub(r"[•\-–—|]", " ", cleaned)

    # 6. Normalize whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return cleaned

