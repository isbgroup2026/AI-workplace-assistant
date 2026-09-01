from app.models.domain import KnowledgeResult


async def search_knowledge(query: str, user_id: str, top_k: int = 5) -> KnowledgeResult:
    """Knowledge/RAG boundary — stub until ingestion pipeline is built."""
    _ = query, user_id, top_k
    return KnowledgeResult(
        answer_context=[],
        sources=[],
    )
