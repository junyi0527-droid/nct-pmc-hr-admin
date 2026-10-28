"""Common response schemas."""
from pydantic import BaseModel


class Message(BaseModel):
    message: str


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int
