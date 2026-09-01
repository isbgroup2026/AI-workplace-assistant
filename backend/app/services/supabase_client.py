from functools import lru_cache

from supabase import Client, create_client

from app.config.settings import get_settings


@lru_cache
def get_supabase_client() -> Client | None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        return None
    return create_client(settings.supabase_url, settings.supabase_key)


def reset_supabase_client_cache() -> None:
    get_supabase_client.cache_clear()
