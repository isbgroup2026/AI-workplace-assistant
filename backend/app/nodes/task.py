from app.graph.intents import WorkAIIntent
from app.graph.state import WorkAIState
from app.services import task_service


async def task_node(state: WorkAIState) -> dict:
    intent = state.get("intent", WorkAIIntent.UNKNOWN.value)
    user_id = state.get("user_id", "")

    if intent == WorkAIIntent.TASK_CREATE.value:
        return {
            "requires_confirmation": True,
            "pending_action": {"action": "task_create", "message": state.get("message", "")},
            "result": {"type": "task", "status": "confirmation_required"},
        }

    if intent == WorkAIIntent.TASK_UPDATE.value:
        return {
            "requires_confirmation": True,
            "pending_action": {"action": "task_update", "message": state.get("message", "")},
            "result": {"type": "task", "status": "confirmation_required"},
        }

    tasks = await task_service.get_tasks(user_id)
    return {
        "result": {
            "type": "task",
            "tasks": [t.model_dump() for t in tasks],
            "count": len(tasks),
        }
    }
