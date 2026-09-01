from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: str | None = None
    language: str = "English"


class ChatResponse(BaseModel):
    conversation_id: str
    intent: str
    response: str
    data: dict = Field(default_factory=dict)
    requires_confirmation: bool = False
