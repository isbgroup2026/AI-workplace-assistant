from app.graph.state import WorkAIState
from app.services import people_service


async def people_node(state: WorkAIState) -> dict:
    query = state.get("message", "")
    user_id = state.get("user_id", "")
    employees = await people_service.search_people(query, user_id)
    return {
        "result": {
            "type": "people",
            "employees": [e.model_dump() for e in employees],
            "count": len(employees),
        }
    }
