"""Time helpers. Datetimes are stored as naive local time (default Asia/Kuala_Lumpur)."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import get_settings


def now_local() -> datetime:
    return datetime.now(ZoneInfo(get_settings().timezone)).replace(tzinfo=None, microsecond=0)


def today_local() -> date:
    return now_local().date()


def to_naive_local(value: datetime) -> datetime:
    """Convert an aware datetime to naive local time; leave naive values unchanged."""
    if value.tzinfo is None:
        return value
    return value.astimezone(ZoneInfo(get_settings().timezone)).replace(tzinfo=None)
