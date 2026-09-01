import pytest
from unittest.mock import AsyncMock, patch

from app.graph.graph import build_workai_graph
from app.models.domain import EmployeeResult


@pytest.mark.asyncio
async def test_people_vertical_slice():
    graph = build_workai_graph()
    rajesh = EmployeeResult(
        id="emp-1",
        name="Rajesh Kumar",
        initials="RK",
        role="Team Lead",
        department="Maintenance",
        employee_id="EMP-0042",
        email="rajesh.kumar@example.com",
        plant="Pune Plant 2",
    )

    with patch("app.nodes.context.chat_persistence.load_conversation_history", new=AsyncMock(return_value=[])):
        with patch("app.nodes.context.chat_persistence.load_user_profile", new=AsyncMock(return_value=None)):
            with patch(
                "app.services.people_service.search_people",
                new=AsyncMock(return_value=[rajesh]),
            ):
                final = await graph.ainvoke(
                    {
                        "user_id": "user-1",
                        "conversation_id": "user-1",
                        "message": "Who is Rajesh?",
                    }
                )

    assert final.get("intent") == "EMPLOYEE_LOOKUP"
    assert final.get("result", {}).get("type") == "people"
    assert "Rajesh Kumar" in final.get("response", "")
    assert "Maintenance" in final.get("response", "")


@pytest.mark.asyncio
async def test_chat_api_endpoint():
    from fastapi.testclient import TestClient

    from app.main import app

    graph = build_workai_graph()
    rajesh = EmployeeResult(
        id="emp-1",
        name="Rajesh Kumar",
        initials="RK",
        role="Team Lead",
        department="Maintenance",
        plant="Pune Plant 2",
    )

    with patch("app.nodes.context.chat_persistence.load_conversation_history", new=AsyncMock(return_value=[])):
        with patch("app.nodes.context.chat_persistence.load_user_profile", new=AsyncMock(return_value=None)):
            with patch("app.services.chat_persistence.save_message", new=AsyncMock()):
                with patch("app.services.people_service.search_people", new=AsyncMock(return_value=[rajesh])):
                    client = TestClient(app)
                    response = client.post(
                        "/api/chat",
                        json={"message": "Who is Rajesh?"},
                        headers={"X-User-Id": "user-1"},
                    )

    assert response.status_code == 200
    body = response.json()
    assert body["intent"] == "EMPLOYEE_LOOKUP"
    assert "Rajesh Kumar" in body["response"]
    assert body["conversation_id"] == "user-1"
