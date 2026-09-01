import pytest
from unittest.mock import AsyncMock, patch

from app.graph.graph import build_workai_graph, route_by_intent
from app.graph.intents import WorkAIIntent
from app.graph.state import WorkAIState


@pytest.mark.parametrize(
    "intent,expected_node",
    [
        (WorkAIIntent.GENERAL_CHAT.value, "general_chat"),
        (WorkAIIntent.KNOWLEDGE_QUERY.value, "knowledge"),
        (WorkAIIntent.EMPLOYEE_LOOKUP.value, "people"),
        (WorkAIIntent.TASK_CREATE.value, "task"),
        (WorkAIIntent.TASK_QUERY.value, "task"),
        (WorkAIIntent.MEETING_CREATE.value, "meeting"),
        (WorkAIIntent.MESSAGE_SEND.value, "messaging"),
        (WorkAIIntent.UNKNOWN.value, "general_chat"),
    ],
)
def test_route_by_intent(intent: str, expected_node: str):
    state: WorkAIState = {"intent": intent}
    assert route_by_intent(state) == expected_node


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message,expected_intent",
    [
        ("Who is Rajesh?", WorkAIIntent.EMPLOYEE_LOOKUP.value),
        ("Create a task for hydraulic inspection", WorkAIIntent.TASK_CREATE.value),
        ("What is the safety policy?", WorkAIIntent.KNOWLEDGE_QUERY.value),
        ("Schedule a meeting tomorrow", WorkAIIntent.MEETING_CREATE.value),
    ],
)
async def test_graph_routes_to_expected_intent(message: str, expected_intent: str):
    graph = build_workai_graph()
    with patch("app.nodes.context.chat_persistence.load_conversation_history", new=AsyncMock(return_value=[])):
        with patch("app.nodes.context.chat_persistence.load_user_profile", new=AsyncMock(return_value=None)):
            with patch("app.services.people_service.search_people", new=AsyncMock(return_value=[])):
                with patch("app.services.knowledge_service.search_knowledge", new=AsyncMock()):
                    with patch("app.services.task_service.get_tasks", new=AsyncMock(return_value=[])):
                        with patch("app.services.meeting_service.get_meetings", new=AsyncMock(return_value=[])):
                            final = await graph.ainvoke(
                                {
                                    "user_id": "user-1",
                                    "conversation_id": "user-1",
                                    "message": message,
                                }
                            )
    assert final.get("intent") == expected_intent
