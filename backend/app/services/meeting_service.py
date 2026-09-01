from typing import Any

from app.models.domain import MeetingRecord
from app.services.supabase_client import get_supabase_client


async def create_meeting(
    *,
    title: str,
    meeting_date: str,
    meeting_time: str,
    duration_minutes: int,
    platform: str,
    agenda: str,
    attendee_ids: list[str],
    created_by: str,
) -> MeetingRecord:
    client = get_supabase_client()
    if client is None:
        raise RuntimeError("Supabase is not configured")

    response = (
        client.table("meetings")
        .insert(
            {
                "title": title,
                "meeting_date": meeting_date,
                "meeting_time": meeting_time,
                "duration_minutes": duration_minutes,
                "platform": platform,
                "agenda": agenda,
                "created_by": created_by,
                "status": "Scheduled",
            }
        )
        .select("*")
        .single()
        .execute()
    )
    row = response.data
    meeting_id = row["id"]
    all_attendees = list({*attendee_ids, created_by})
    if all_attendees:
        client.table("meeting_attendees").insert(
            [{"meeting_id": meeting_id, "user_id": uid} for uid in all_attendees]
        ).execute()

    return await _meeting_from_row(row, all_attendees)


async def get_meetings(user_id: str) -> list[MeetingRecord]:
    _ = user_id
    client = get_supabase_client()
    if client is None:
        return []

    response = client.table("meetings").select("*").order("meeting_date").execute()
    meetings: list[MeetingRecord] = []
    for row in response.data or []:
        attendee_resp = (
            client.table("meeting_attendees").select("user_id").eq("meeting_id", row["id"]).execute()
        )
        attendee_ids = [a["user_id"] for a in attendee_resp.data or []]
        meetings.append(await _meeting_from_row(row, attendee_ids))
    return meetings


async def _meeting_from_row(row: dict[str, Any], attendee_ids: list[str]) -> MeetingRecord:
    client = get_supabase_client()
    attendees: list[str] = []
    if client and attendee_ids:
        profiles = client.table("profiles").select("id, name").in_("id", attendee_ids).execute()
        attendees = [p["name"] for p in profiles.data or []]

    duration = row.get("duration_minutes", 30)
    return MeetingRecord(
        id=row["id"],
        title=row["title"],
        date=row.get("meeting_date") or "",
        time=row.get("meeting_time") or "",
        duration=f"{duration} min",
        platform=row.get("platform") or "Google Meet",
        status=row.get("status") or "Scheduled",
        agenda=row.get("agenda") or "",
        attendees=attendees,
    )
