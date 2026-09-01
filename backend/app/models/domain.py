from pydantic import BaseModel, Field


class IntentResult(BaseModel):
    intent: str
    confidence: float = Field(ge=0.0, le=1.0)


class EmployeeResult(BaseModel):
    id: str
    name: str
    initials: str
    role: str
    department: str
    employee_id: str | None = None
    email: str | None = None
    plant: str | None = None


class KnowledgeResult(BaseModel):
    answer_context: list[str] = Field(default_factory=list)
    sources: list[str] = Field(default_factory=list)


class TaskRecord(BaseModel):
    id: str
    title: str
    description: str = ""
    assignee_id: str | None = None
    due_date: str = ""
    priority: str = "Medium"
    status: str = "Pending"
    department: str = ""


class MeetingRecord(BaseModel):
    id: str
    title: str
    date: str
    time: str
    duration: str = "30 min"
    platform: str = "Google Meet"
    status: str = "Scheduled"
    agenda: str = ""
    attendees: list[str] = Field(default_factory=list)


class MessageRecord(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    text: str
    timestamp: str = ""
