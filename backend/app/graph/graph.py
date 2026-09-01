from langgraph.graph import END, START, StateGraph

from app.graph.intents import INTENT_TO_NODE, WorkAIIntent
from app.graph.state import WorkAIState
from app.nodes.context import load_context_node
from app.nodes.general_chat import general_chat_node
from app.nodes.knowledge import knowledge_node
from app.nodes.meeting import meeting_node
from app.nodes.messaging import messaging_node
from app.nodes.people import people_node
from app.nodes.response import build_response_node
from app.nodes.router_node import router_node
from app.nodes.task import task_node

CAPABILITY_NODES = (
    "general_chat",
    "knowledge",
    "people",
    "task",
    "meeting",
    "messaging",
)


def route_by_intent(state: WorkAIState) -> str:
    intent_str = state.get("intent", WorkAIIntent.UNKNOWN.value)
    try:
        intent = WorkAIIntent(intent_str)
    except ValueError:
        intent = WorkAIIntent.UNKNOWN
    return INTENT_TO_NODE[intent]


def build_workai_graph():
    """Build and compile the single WorkAI LangGraph. Do not create alternate graphs."""
    graph = StateGraph(WorkAIState)

    graph.add_node("load_context", load_context_node)
    graph.add_node("router", router_node)
    graph.add_node("general_chat", general_chat_node)
    graph.add_node("knowledge", knowledge_node)
    graph.add_node("people", people_node)
    graph.add_node("task", task_node)
    graph.add_node("meeting", meeting_node)
    graph.add_node("messaging", messaging_node)
    graph.add_node("build_response", build_response_node)

    graph.add_edge(START, "load_context")
    graph.add_edge("load_context", "router")
    graph.add_conditional_edges("router", route_by_intent)

    for node in CAPABILITY_NODES:
        graph.add_edge(node, "build_response")

    graph.add_edge("build_response", END)

    return graph.compile()


# Singleton compiled graph
_compiled_graph = None


def get_workai_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_workai_graph()
    return _compiled_graph


def reset_workai_graph() -> None:
    global _compiled_graph
    _compiled_graph = None
