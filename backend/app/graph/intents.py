from enum import Enum


class WorkAIIntent(str, Enum):
    GENERAL_CHAT = "GENERAL_CHAT"
    KNOWLEDGE_QUERY = "KNOWLEDGE_QUERY"
    EMPLOYEE_LOOKUP = "EMPLOYEE_LOOKUP"
    TASK_CREATE = "TASK_CREATE"
    TASK_QUERY = "TASK_QUERY"
    TASK_UPDATE = "TASK_UPDATE"
    MEETING_CREATE = "MEETING_CREATE"
    MEETING_QUERY = "MEETING_QUERY"
    MESSAGE_SEND = "MESSAGE_SEND"
    MESSAGE_QUERY = "MESSAGE_QUERY"
    UNKNOWN = "UNKNOWN"


# Maps each intent to its LangGraph capability node name.
INTENT_TO_NODE: dict[WorkAIIntent, str] = {
    WorkAIIntent.GENERAL_CHAT: "general_chat",
    WorkAIIntent.KNOWLEDGE_QUERY: "knowledge",
    WorkAIIntent.EMPLOYEE_LOOKUP: "people",
    WorkAIIntent.TASK_CREATE: "task",
    WorkAIIntent.TASK_QUERY: "task",
    WorkAIIntent.TASK_UPDATE: "task",
    WorkAIIntent.MEETING_CREATE: "meeting",
    WorkAIIntent.MEETING_QUERY: "meeting",
    WorkAIIntent.MESSAGE_SEND: "messaging",
    WorkAIIntent.MESSAGE_QUERY: "messaging",
    WorkAIIntent.UNKNOWN: "general_chat",
}
