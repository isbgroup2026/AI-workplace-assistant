from app.graph.router import classify_intent
from app.graph.state import WorkAIState
from app.services import chat_persistence


async def load_context_node(state: WorkAIState) -> dict:
    user_id = state.get("user_id", "")
    history = await chat_persistence.load_conversation_history(user_id)
    profile = await chat_persistence.load_user_profile(user_id)

    context: list = [{"type": "history", "messages": history}]
    if profile:
        context.append({"type": "profile", "data": profile})

    return {"context": context}
