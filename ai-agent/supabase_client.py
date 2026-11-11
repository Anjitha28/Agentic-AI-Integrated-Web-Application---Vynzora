import logging
from supabase import create_client, Client
import config

logger = logging.getLogger("vynzora-supabase")

_supabase_client: Client = None

def get_supabase_client() -> Client:
    """
    Initializes and authenticates the Supabase client using dedicated email/password,
    exactly as implemented in Agent_Zora.ipynb.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    config.validate_config()

    logger.info(f"Connecting to Supabase at: {config.SUPABASE_URL}")
    client = create_client(config.SUPABASE_URL, config.SUPABASE_KEY)

    try:
        auth_response = client.auth.sign_in_with_password({
            "email": config.SUPABASE_EMAIL,
            "password": config.SUPABASE_PASSWORD
        })
        user_email = auth_response.user.email if auth_response and auth_response.user else config.SUPABASE_EMAIL
        logger.info(f"Supabase authenticated successfully as: {user_email}")
    except Exception as e:
        logger.warning(f"Supabase auth sign-in with password warning: {e}. Proceeding with anon key.")

    _supabase_client = client
    return _supabase_client

