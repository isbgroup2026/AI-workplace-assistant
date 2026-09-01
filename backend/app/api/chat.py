from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException

from app.graph.graph import get_workai_graph
from app.graph.state import WorkAIState
from app.models.chat import ChatRequest, ChatResponse
from app.services import chat_persistence
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/api", tags=["chat"])


async def get_current_user_id(
    authorization: Annotated[str | None, Header()] = None,
    x_user_id: Annotated[str | None, Header()] = None,
) -> str:
    """Resolve user identity from Supabase JWT or PoC dev header."""
    if x_user_id:
        return x_user_id

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        client = get_supabase_client()
        if client is None:
            raise HTTPException(status_code=503, detail="Supabase is not configured")
        try:
            user_response = client.auth.get_user(token)
            user = user_response.user
            if user and user.id:
                return user.id
        except Exception as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired token") from exc

    raise HTTPException(status_code=401, detail="Authentication required")


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user_id: Annotated[str, Depends(get_current_user_id)],
) -> ChatResponse:
    conversation_id = body.conversation_id or user_id

    initial_state: WorkAIState = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "message": body.message.strip(),
        "language": body.language,
    }

    graph = get_workai_graph()
    final_state = await graph.ainvoke(initial_state)

    response_text = final_state.get("response") or "No response generated."
    intent = final_state.get("intent") or "UNKNOWN"
    result_data = final_state.get("result") or {}

    await chat_persistence.save_message(user_id, "user", body.message.strip())
    await chat_persistence.save_message(user_id, "assistant", response_text)

    return ChatResponse(
        conversation_id=conversation_id,
        intent=intent,
        response=response_text,
        data=result_data,
        requires_confirmation=bool(final_state.get("requires_confirmation")),
    )
