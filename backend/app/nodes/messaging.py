from app.graph.intents import WorkAIIntent
from app.graph.state import WorkAIState
from app.services import messaging_service


async def messaging_node(state: WorkAIState) -> dict:
    intent = state.get("intent", WorkAIIntent.UNKNOWN.value)

    if intent == WorkAIIntent.MESSAGE_SEND.value:
        return {
            "requires_confirmation": True,
            "pending_action": {"action": "message_send", "message": state.get("message", "")},
            "result": {"type": "messaging", "status": "confirmation_required"},
        }

    return {
        "result": {
            "type": "messaging",
            "messages": [],
            "note": "Message query stub — implement conversation lookup in messaging workstream.",
        }
    }
