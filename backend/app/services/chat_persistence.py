from app.services.supabase_client import get_supabase_client


async def load_conversation_history(user_id: str, limit: int = 20) -> list[dict]:
    """Load recent AI messages — mirrors frontend `listAIMessages`."""
    client = get_supabase_client()
    if client is None:
        return []

    response = (
        client.table("ai_messages")
        .select("role, text, created_at")
        .eq("user_id", user_id)
        .order("created_at")
        .limit(limit)
        .execute()
    )
    return response.data or []


async def save_message(user_id: str, role: str, text: str) -> None:
    client = get_supabase_client()
    if client is None:
        return

    client.table("ai_messages").insert({"user_id": user_id, "role": role, "text": text}).execute()


async def load_user_profile(user_id: str) -> dict | None:
    client = get_supabase_client()
    if client is None:
        return None

    response = client.table("profiles").select("*").eq("id", user_id).single().execute()
    return response.data
