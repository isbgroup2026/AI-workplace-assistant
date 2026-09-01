from app.models.domain import MessageRecord
from app.services.supabase_client import get_supabase_client


async def send_message(conversation_id: str, sender_id: str, text: str) -> None:
    client = get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured")

    client.table("chat_messages").insert(
        {
            "conversation_id": conversation_id,
            "sender_id": sender_id,
            "text": text,
            "status": "sent",
        }
    ).execute()


async def get_messages(conversation_id: str) -> list[MessageRecord]:
    client = get_supabase_client()
    if client is None:
        return []

    response = (
        client.table("chat_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at")
        .execute()
    )
    return [
        MessageRecord(
            id=row["id"],
            conversation_id=row["conversation_id"],
            sender_id=row["sender_id"],
            text=row["text"],
            timestamp=row.get("created_at") or "",
        )
        for row in response.data or []
    ]
