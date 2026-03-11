import asyncio
from dataclasses import dataclass, field
from typing import Sequence

from agent_framework import AgentThread, ChatMessage, ChatMessageStore


class SlidingWindowChatMessageStore(ChatMessageStore):
    """In-memory chat history capped to the latest N messages."""

    def __init__(
        self,
        messages: Sequence[ChatMessage] | None = None,
        *,
        max_messages: int = 20,
    ) -> None:
        super().__init__(messages=messages)
        self.max_messages = max(2, max_messages)
        self._trim()

    async def add_messages(self, messages: Sequence[ChatMessage]) -> None:
        await super().add_messages(messages)
        self._trim()

    def _trim(self) -> None:
        if len(self.messages) > self.max_messages:
            self.messages = self.messages[-self.max_messages :]


@dataclass
class UploadedDocument:
    file_id: str
    name: str
    content_type: str
    size_bytes: int
    extracted_text: str
    preview_text: str


@dataclass
class SessionState:
    thread: AgentThread
    uploaded_documents: list[UploadedDocument] = field(default_factory=list)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class SessionStore:
    """Backend-local session store keyed by mode and session ID."""

    def __init__(self, max_messages: int = 20) -> None:
        self.max_messages = max_messages
        self._sessions: dict[tuple[str, str], SessionState] = {}
        self._guard = asyncio.Lock()

    async def get_session(self, mode: str, session_id: str) -> SessionState:
        key = (mode, session_id)
        async with self._guard:
            session = self._sessions.get(key)
            if session is None:
                session = SessionState(
                    thread=AgentThread(
                        message_store=SlidingWindowChatMessageStore(max_messages=self.max_messages)
                    )
                )
                self._sessions[key] = session
            return session

    async def clear_session(self, mode: str, session_id: str) -> None:
        key = (mode, session_id)
        async with self._guard:
            self._sessions.pop(key, None)
