from app.graph.intents import WorkAIIntent
from app.graph.state import WorkAIState
from app.services import meeting_service


async def meeting_node(state: WorkAIState) -> dict:
    intent = state.get("intent", WorkAIIntent.UNKNOWN.value)
    user_id = state.get("user_id", "")

    if intent == WorkAIIntent.MEETING_CREATE.value:
        return {
            "requires_confirmation": True,
            "pending_action": {"action": "meeting_create", "message": state.get("message", "")},
            "result": {"type": "meeting", "status": "confirmation_required"},
        }

    meetings = await meeting_service.get_meetings(user_id)
    return {
        "result": {
            "type": "meeting",
            "meetings": [m.model_dump() for m in meetings],
            "count": len(meetings),
        }
    }
