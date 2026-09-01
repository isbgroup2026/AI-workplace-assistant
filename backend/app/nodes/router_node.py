from app.graph.router import classify_intent
from app.graph.state import WorkAIState


async def router_node(state: WorkAIState) -> dict:
    profile_ctx = None
    for item in state.get("context") or []:
        if item.get("type") == "profile":
            profile_ctx = item.get("data")

    result = await classify_intent(state.get("message", ""), profile_ctx)
    return {"intent": result.intent, "confidence": result.confidence}
