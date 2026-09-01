from typing import Any, TypedDict


class WorkAIState(TypedDict, total=False):
    # Identity
    user_id: str
    conversation_id: str

    # User request
    message: str

    # Language (optional preprocessing)
    language: str

    # Orchestration
    intent: str
    confidence: float

    # Context / retrieval (conversation history, profile snippets, etc.)
    context: list[Any]

    # Tool or service result
    result: dict[str, Any]

    # HITL — set True when an action needs user confirmation
    requires_confirmation: bool
    pending_action: dict[str, Any]

    # Assistant output
    response: str

    # Error handling
    error: str
