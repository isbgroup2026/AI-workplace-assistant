import pytest
from unittest.mock import AsyncMock, patch

from app.graph.intents import WorkAIIntent
from app.graph.router import classify_intent


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "message,expected",
    [
        ("Create a task for Rajesh tomorrow", WorkAIIntent.TASK_CREATE),
        ("Who is Rajesh?", WorkAIIntent.EMPLOYEE_LOOKUP),
        ("Find someone from Maintenance", WorkAIIntent.EMPLOYEE_LOOKUP),
        ("What does the policy say about leave?", WorkAIIntent.KNOWLEDGE_QUERY),
        ("Schedule a meeting with Priya tomorrow at 3 PM", WorkAIIntent.MEETING_CREATE),
        ("Show my upcoming meetings", WorkAIIntent.MEETING_QUERY),
        ("Send a message to the team", WorkAIIntent.MESSAGE_SEND),
        ("Hello there", WorkAIIntent.GENERAL_CHAT),
    ],
)
async def test_classify_intent_deterministic(message: str, expected: WorkAIIntent):
    result = await classify_intent(message)
    assert result.intent == expected.value
    assert result.confidence > 0
