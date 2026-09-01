import re
from typing import Any

from app.graph.intents import WorkAIIntent
from app.models.domain import IntentResult
from app.services.llm_service import get_llm_service


async def classify_intent(message: str, user_context: dict[str, Any] | None = None) -> IntentResult:
    """Classify user message into a WorkAI intent.

    Uses LLM structured output when configured; otherwise deterministic rules.
    """
    llm = get_llm_service()
    if llm.is_configured():
        try:
            return await llm.classify_intent(message, user_context)
        except Exception:
            pass  # fall through to deterministic router

    return _classify_deterministic(message)


def _classify_deterministic(message: str) -> IntentResult:
    text = message.lower().strip()

    if text in {"yes", "confirm", "confirmed", "go ahead", "proceed"}:
        return IntentResult(intent=WorkAIIntent.UNKNOWN.value, confidence=0.9)

    if any(k in text for k in ("who is", "find someone", "find employee", "employee lookup", "who works")):
        return IntentResult(intent=WorkAIIntent.EMPLOYEE_LOOKUP.value, confidence=0.85)

    if any(k in text for k in ("document", "policy", "knowledge", "what does the handbook", "where is the sop")):
        return IntentResult(intent=WorkAIIntent.KNOWLEDGE_QUERY.value, confidence=0.8)

    if any(k in text for k in ("create task", "create a task", "add task", "new task", "assign task")):
        return IntentResult(intent=WorkAIIntent.TASK_CREATE.value, confidence=0.85)

    if any(k in text for k in ("my tasks", "pending tasks", "list tasks", "show tasks", "task status")):
        return IntentResult(intent=WorkAIIntent.TASK_QUERY.value, confidence=0.85)

    if any(k in text for k in ("update task", "mark task", "complete task")):
        return IntentResult(intent=WorkAIIntent.TASK_UPDATE.value, confidence=0.85)

    if any(
        k in text
        for k in (
            "schedule meeting",
            "schedule a meeting",
            "book meeting",
            "book a meeting",
            "create meeting",
            "create a meeting",
            "set up a meeting",
        )
    ):
        return IntentResult(intent=WorkAIIntent.MEETING_CREATE.value, confidence=0.85)

    if any(k in text for k in ("my meetings", "upcoming meetings", "calendar", "show meetings")):
        return IntentResult(intent=WorkAIIntent.MEETING_QUERY.value, confidence=0.85)

    if any(k in text for k in ("send message", "message to", "tell ", "notify ")):
        return IntentResult(intent=WorkAIIntent.MESSAGE_SEND.value, confidence=0.8)

    if any(k in text for k in ("my messages", "recent messages", "chat history")):
        return IntentResult(intent=WorkAIIntent.MESSAGE_QUERY.value, confidence=0.8)

    if any(k in text for k in ("hello", "hi", "hey", "thanks", "thank you")):
        return IntentResult(intent=WorkAIIntent.GENERAL_CHAT.value, confidence=0.7)

    return IntentResult(intent=WorkAIIntent.UNKNOWN.value, confidence=0.4)


def extract_person_name(query: str) -> str | None:
    """Extract a person name from common lookup phrasing."""
    patterns = [
        r"who is\s+(.+?)(?:\?|$)",
        r"find\s+(?:someone\s+(?:named|called)\s+)?(.+?)(?:\?|$)",
        r"lookup\s+(.+?)(?:\?|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip("?.")
    return None
