from app.graph.intents import WorkAIIntent
from app.graph.state import WorkAIState


async def build_response_node(state: WorkAIState) -> dict:
    if state.get("error"):
        return {"response": f"Sorry, something went wrong: {state['error']}"}

    if state.get("requires_confirmation"):
        pending = state.get("pending_action") or {}
        action = pending.get("action", "action")
        return {
            "response": (
                f"I can help with that ({action.replace('_', ' ')}). "
                "Please confirm to proceed — reply 'Yes' to continue."
            )
        }

    result = state.get("result") or {}
    result_type = result.get("type")

    if result_type == "people":
        employees = result.get("employees") or []
        if not employees:
            return {"response": "I couldn't find anyone matching that description in the employee directory."}
        if len(employees) == 1:
            e = employees[0]
            return {
                "response": (
                    f"{e['name']} — {e['role']} in {e['department']}"
                    + (f" ({e['plant']})" if e.get("plant") else "")
                    + (f". Email: {e['email']}" if e.get("email") else "")
                    + "."
                )
            }
        lines = [f"- {e['name']} ({e['role']}, {e['department']})" for e in employees[:5]]
        suffix = f"\n…and {len(employees) - 5} more." if len(employees) > 5 else ""
        return {"response": f"I found {len(employees)} people:\n" + "\n".join(lines) + suffix}

    if result_type == "knowledge":
        if not result.get("answer_context"):
            return {
                "response": "Knowledge search is not connected yet. The Knowledge workstream will implement RAG here."
            }
        return {"response": "\n".join(result["answer_context"])}

    if result_type == "task":
        if result.get("status") == "confirmation_required":
            return {"response": state.get("response") or "Please confirm the task action."}
        count = result.get("count", 0)
        return {"response": f"You have {count} task(s) in the system. Open Tasks for full details."}

    if result_type == "meeting":
        if result.get("status") == "confirmation_required":
            return {"response": state.get("response") or "Please confirm the meeting action."}
        count = result.get("count", 0)
        return {"response": f"You have {count} meeting(s) scheduled. Open Meetings for full details."}

    if result_type == "messaging":
        if result.get("status") == "confirmation_required":
            return {"response": state.get("response") or "Please confirm before sending the message."}
        return {"response": result.get("note", "Messaging capability stub.")}

    if result_type == "general_chat":
        return {
            "response": (
                "Hello! I'm WorkAI. I can help with employee lookup, tasks, meetings, "
                "messaging, and workplace knowledge. What would you like to do?"
            )
        }

    return {"response": "I'm not sure how to help with that yet. Try asking about a colleague, task, or meeting."}
