from typing import Any

from app.models.domain import TaskRecord
from app.services.supabase_client import get_supabase_client


async def create_task(
    *,
    title: str,
    description: str,
    assignee_id: str | None,
    due_date: str,
    priority: str,
    department: str,
    created_by: str,
) -> TaskRecord:
    client = get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured")

    payload: dict[str, Any] = {
        "title": title,
        "description": description,
        "assignee_id": assignee_id,
        "due_date": due_date,
        "priority": priority,
        "department": department,
        "created_by": created_by,
    }
    response = client.table("tasks").insert(payload).select("*").single().execute()
    row = response.data
    return _task_from_row(row)


async def get_tasks(user_id: str) -> list[TaskRecord]:
    client = get_supabase_client()
    if client is None:
        return []

    response = client.table("tasks").select("*").order("created_at", desc=True).execute()
    return [_task_from_row(row) for row in response.data or []]


async def update_task(task_id: str, *, status: str | None = None) -> TaskRecord | None:
    client = get_supabase_client()
    if client is None:
        return None

    updates: dict[str, Any] = {}
    if status:
        updates["status"] = status
    if not updates:
        return None

    response = client.table("tasks").update(updates).eq("id", task_id).select("*").single().execute()
    return _task_from_row(response.data) if response.data else None


def _task_from_row(row: dict[str, Any]) -> TaskRecord:
    return TaskRecord(
        id=row["id"],
        title=row["title"],
        description=row.get("description") or "",
        assignee_id=row.get("assignee_id"),
        due_date=row.get("due_date") or "",
        priority=row.get("priority") or "Medium",
        status=row.get("status") or "Pending",
        department=row.get("department") or "",
    )
