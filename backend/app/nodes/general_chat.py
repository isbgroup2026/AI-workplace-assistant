from app.graph.state import WorkAIState


async def general_chat_node(state: WorkAIState) -> dict:
    message = state.get("message", "")
    return {
        "result": {
            "type": "general_chat",
            "message": message,
        }
    }
