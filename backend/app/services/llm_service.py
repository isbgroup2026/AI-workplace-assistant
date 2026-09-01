from typing import Any

from pydantic import BaseModel

from app.config.settings import get_settings
from app.graph.intents import WorkAIIntent
from app.models.domain import IntentResult


class LLMService:
    """Central LLM access — feature nodes must not create provider clients directly."""

    def is_configured(self) -> bool:
        settings = get_settings()
        return bool(settings.openai_api_key)

    async def generate(self, prompt: str, system: str | None = None) -> str:
        if not self.is_configured():
            return "LLM is not configured yet."
        # Placeholder — Knowledge / General Chat workstreams can extend this.
        return "LLM response placeholder."

    async def structured(self, prompt: str, schema: type[BaseModel], system: str | None = None) -> BaseModel:
        if not self.is_configured():
            raise RuntimeError("LLM is not configured")
        raise NotImplementedError("Structured LLM output not implemented yet")

    async def classify_intent(self, message: str, user_context: dict[str, Any] | None = None) -> IntentResult:
        if not self.is_configured():
            raise RuntimeError("LLM is not configured")
        # Future: OpenAI structured output with WorkAIIntent schema
        raise NotImplementedError("LLM intent classification not implemented yet")


_llm_service: LLMService | None = None


def get_llm_service() -> LLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = LLMService()
    return _llm_service
