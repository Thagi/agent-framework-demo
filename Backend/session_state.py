import asyncio
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Sequence
from urllib.parse import quote

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

    def __init__(self, max_messages: int = 20, store_dir: str | None = None) -> None:
        self.max_messages = max_messages
        base_dir = Path(__file__).resolve().parent
        configured_dir = Path(store_dir) if store_dir else Path("data/backend_sessions")
        if not configured_dir.is_absolute():
            configured_dir = base_dir / configured_dir
        self.store_dir = configured_dir
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self._sessions: dict[tuple[str, str], SessionState] = {}
        self._guard = asyncio.Lock()

    def _session_path(self, mode: str, session_id: str) -> Path:
        filename = f"{quote(mode, safe='')}__{quote(session_id, safe='')}.json"
        return self.store_dir / filename

    def _serialize_message(self, message: ChatMessage) -> dict:
        role = getattr(message.role, "value", str(message.role))
        return {
            "role": role,
            "text": message.text,
            "author_name": message.author_name,
        }

    def _deserialize_message(self, payload: dict) -> ChatMessage:
        return ChatMessage(
            role=payload.get("role", "assistant"),
            text=payload.get("text", ""),
            author_name=payload.get("author_name"),
        )

    def _serialize_document(self, document: UploadedDocument) -> dict:
        return {
            "file_id": document.file_id,
            "name": document.name,
            "content_type": document.content_type,
            "size_bytes": document.size_bytes,
            "extracted_text": document.extracted_text,
            "preview_text": document.preview_text,
        }

    def _deserialize_document(self, payload: dict) -> UploadedDocument:
        return UploadedDocument(
            file_id=payload.get("file_id", ""),
            name=payload.get("name", ""),
            content_type=payload.get("content_type", "application/octet-stream"),
            size_bytes=int(payload.get("size_bytes", 0)),
            extracted_text=payload.get("extracted_text", ""),
            preview_text=payload.get("preview_text", ""),
        )

    def _load_persisted_session(self, mode: str, session_id: str) -> SessionState | None:
        path = self._session_path(mode, session_id)
        if not path.exists():
            return None

        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
        messages = [self._deserialize_message(item) for item in payload.get("messages", [])]
        documents = [self._deserialize_document(item) for item in payload.get("uploaded_documents", [])]
        return SessionState(
            thread=AgentThread(
                message_store=SlidingWindowChatMessageStore(messages=messages, max_messages=self.max_messages)
            ),
            uploaded_documents=documents,
        )

    def _write_session_payload(self, path: Path, payload: dict) -> None:
        temp_path = path.with_name(f".{path.name}.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    async def get_session(self, mode: str, session_id: str) -> SessionState:
        key = (mode, session_id)
        async with self._guard:
            session = self._sessions.get(key)
            if session is None:
                session = self._load_persisted_session(mode, session_id)
                if session is None:
                    session = SessionState(
                        thread=AgentThread(
                            message_store=SlidingWindowChatMessageStore(max_messages=self.max_messages)
                        )
                    )
                self._sessions[key] = session
            return session

    async def save_session(self, mode: str, session_id: str) -> None:
        key = (mode, session_id)
        async with self._guard:
            session = self._sessions.get(key)
            if session is None:
                return

        messages = []
        if session.thread.message_store is not None:
            messages = [self._serialize_message(message) for message in session.thread.message_store.messages]
        payload = {
            "messages": messages,
            "uploaded_documents": [
                self._serialize_document(document) for document in session.uploaded_documents
            ],
        }

        path = self._session_path(mode, session_id)
        self._write_session_payload(path, payload)

    async def clear_session(self, mode: str, session_id: str) -> None:
        key = (mode, session_id)
        async with self._guard:
            self._sessions.pop(key, None)
        path = self._session_path(mode, session_id)
        if path.exists():
            path.unlink()
