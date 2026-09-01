from app.graph.state import WorkAIState
from app.services import knowledge_service


async def knowledge_node(state: WorkAIState) -> dict:
    query = state.get("message", "")
    user_id = state.get("user_id", "")
    knowledge = await knowledge_service.search_knowledge(query, user_id)
    return {
        "result": {
            "type": "knowledge",
            "answer_context": knowledge.answer_context,
            "sources": knowledge.sources,
        }
    }
