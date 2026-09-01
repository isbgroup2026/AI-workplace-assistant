import re

from app.graph.router import extract_person_name
from app.models.domain import EmployeeResult
from app.services.supabase_client import get_supabase_client

PROFILE_COLUMNS = "id, name, initials, role, department, employee_id, email, plant"


async def search_people(query: str, user_id: str) -> list[EmployeeResult]:
    """Search employee profiles — mirrors frontend `listProfiles` with query filters."""
    client = get_supabase_client()
    if client is None:
        return []

    text = query.lower()
    name_hint = extract_person_name(query)

    response = client.table("profiles").select(PROFILE_COLUMNS).execute()
    rows = response.data or []

    results: list[EmployeeResult] = []
    for row in rows:
        if row.get("id") == user_id:
            continue
        employee = EmployeeResult(
            id=row["id"],
            name=row["name"],
            initials=row.get("initials", ""),
            role=row.get("role", ""),
            department=row.get("department", ""),
            employee_id=row.get("employee_id"),
            email=row.get("email"),
            plant=row.get("plant"),
        )
        if _matches_query(employee, text, name_hint):
            results.append(employee)

    return results


def _matches_query(employee: EmployeeResult, text: str, name_hint: str | None) -> bool:
    if name_hint:
        return name_hint.lower() in employee.name.lower()

    if "maintenance" in text and "maintenance" in employee.department.lower():
        return True
    if "quality" in text and "quality" in employee.department.lower():
        return True
    if "operations" in text and "operations" in employee.department.lower():
        return True
    if "pune" in text and employee.plant and "pune" in employee.plant.lower():
        return True
    if "chennai" in text and employee.plant and "chennai" in employee.plant.lower():
        return True

    # Fallback: match any token that looks like a name (>2 chars)
    tokens = [t for t in re.findall(r"[a-zA-Z]{3,}", text)]
    return any(token.lower() in employee.name.lower() for token in tokens)
