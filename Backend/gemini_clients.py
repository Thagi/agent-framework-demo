from __future__ import annotations

import base64
import json
from collections.abc import Awaitable, Callable, Mapping, MutableSequence, Sequence
from typing import Any
from uuid import uuid4

import google.auth
from google import genai
from google.auth.credentials import Credentials
from google.oauth2 import service_account
from google.genai import types as genai_types

from agent_framework import (
    BaseChatClient,
    ChatMessage,
    ChatResponse,
    ChatResponseUpdate,
    Content,
    Role,
    use_chat_middleware,
    use_function_invocation,
)


def _dumpable_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _dumpable_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_dumpable_value(item) for item in value]
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "to_dict"):
        return value.to_dict()
    return value


def _parse_data_uri(uri: str) -> tuple[bytes, str]:
    header, encoded = uri.split(",", 1)
    media_type = "application/octet-stream"
    if header.startswith("data:"):
        media_type = header[5:].split(";", 1)[0] or media_type
    return base64.b64decode(encoded), media_type


def _build_tool_config(tool_choice: Any) -> genai_types.ToolConfig | None:
    if tool_choice in (None, "", "auto"):
        mode = genai_types.FunctionCallingConfigMode.AUTO
        allowed = None
    elif tool_choice == "none":
        mode = genai_types.FunctionCallingConfigMode.NONE
        allowed = None
    elif isinstance(tool_choice, dict):
        name = (
            tool_choice.get("function", {}).get("name")
            if isinstance(tool_choice.get("function"), dict)
            else None
        )
        if name:
            mode = genai_types.FunctionCallingConfigMode.ANY
            allowed = [str(name)]
        else:
            mode = genai_types.FunctionCallingConfigMode.AUTO
            allowed = None
    else:
        mode = genai_types.FunctionCallingConfigMode.AUTO
        allowed = None

    return genai_types.ToolConfig(
        functionCallingConfig=genai_types.FunctionCallingConfig(
            mode=mode,
            allowedFunctionNames=allowed,
        )
    )


class _GeminiBaseChatClient(BaseChatClient[dict[str, Any]]):
    def __init__(
        self,
        *,
        model_id: str,
        api_key: str | Callable[[], str | Awaitable[str]] | None = None,
        project: str | None = None,
        location: str | None = None,
        credentials: Credentials | None = None,
        api_version: str | None = None,
        base_url: str | None = None,
    ) -> None:
        super().__init__()
        self.model_id = model_id
        self.api_key = api_key
        self.project = project
        self.location = location
        self.credentials = credentials
        self.api_version = api_version
        self.base_url = base_url
        self._async_client: genai.AsyncClient | None = None

    async def _resolve_api_key(self) -> str | None:
        if callable(self.api_key):
            value = self.api_key()
            if isinstance(value, Awaitable):
                return await value
            return value
        return self.api_key

    async def _ensure_client(self) -> genai.AsyncClient:
        if self._async_client is not None:
            return self._async_client

        http_options = None
        if self.api_version or self.base_url:
            http_options = genai_types.HttpOptions(
                apiVersion=self.api_version,
                baseUrl=self.base_url,
            )

        self._async_client = genai.Client(
            vertexai=self.credentials is not None or bool(self.project and self.location),
            api_key=await self._resolve_api_key(),
            credentials=self.credentials,
            project=self.project,
            location=self.location,
            http_options=http_options,
        ).aio
        return self._async_client

    def _content_to_part(self, content: Content, call_name_by_id: dict[str, str]) -> genai_types.Part | None:
        if content.type == "text" and content.text:
            return genai_types.Part.from_text(text=content.text)

        if content.type in {"data", "uri"} and content.uri:
            if content.uri.startswith("data:"):
                data, media_type = _parse_data_uri(content.uri)
                return genai_types.Part.from_bytes(
                    data=data,
                    mime_type=content.media_type or media_type,
                )
            return genai_types.Part.from_uri(
                file_uri=content.uri,
                mime_type=content.media_type,
            )

        if content.type == "function_call" and content.name:
            return genai_types.Part.from_function_call(
                name=content.name,
                args=content.parse_arguments() or {},
            )

        if content.type == "function_result":
            call_name = call_name_by_id.get(content.call_id or "", "tool_result")
            payload = _dumpable_value(content.result)
            if isinstance(payload, str):
                payload = {"result": payload}
            elif not isinstance(payload, dict):
                payload = {"result": payload}
            return genai_types.Part(
                function_response=genai_types.FunctionResponse(
                    id=content.call_id,
                    name=call_name,
                    response=payload,
                )
            )

        return None

    def _messages_to_gemini(
        self,
        messages: MutableSequence[ChatMessage],
    ) -> tuple[list[genai_types.Content], list[str]]:
        conversation: list[genai_types.Content] = []
        system_instructions: list[str] = []
        call_name_by_id: dict[str, str] = {}

        for message in messages:
            if message.role == Role.SYSTEM:
                if message.text:
                    system_instructions.append(message.text)
                for content in message.contents:
                    if content.type == "text" and content.text:
                        system_instructions.append(content.text)
                continue

            parts: list[genai_types.Part] = []
            for content in message.contents:
                part = self._content_to_part(content, call_name_by_id)
                if part is None:
                    continue
                if content.type == "function_call" and content.call_id and content.name:
                    call_name_by_id[content.call_id] = content.name
                parts.append(part)

            if message.text and not any(part.text == message.text for part in parts if hasattr(part, "text")):
                parts.insert(0, genai_types.Part.from_text(text=message.text))

            if not parts:
                continue

            role = "model" if message.role == Role.ASSISTANT else "user"
            conversation.append(genai_types.Content(role=role, parts=parts))

        return conversation, system_instructions

    def _tools_to_gemini(self, tools: Sequence[Any] | None) -> list[genai_types.Tool] | None:
        if not tools:
            return None

        declarations = []
        for tool in tools:
            schema = tool.parameters() if hasattr(tool, "parameters") else None
            declarations.append(
                genai_types.FunctionDeclaration(
                    name=getattr(tool, "name", None),
                    description=getattr(tool, "description", "") or "",
                    parametersJsonSchema=schema or {"type": "object", "properties": {}},
                )
            )

        return [genai_types.Tool(functionDeclarations=declarations)] if declarations else None

    def _build_config(
        self,
        *,
        options: dict[str, Any],
        system_instructions: list[str],
    ) -> genai_types.GenerateContentConfig:
        config_kwargs: dict[str, Any] = {}

        if system_instructions:
            config_kwargs["systemInstruction"] = "\n\n".join(system_instructions)

        tools = self._tools_to_gemini(options.get("tools"))
        if tools:
            config_kwargs["tools"] = tools
            config_kwargs["toolConfig"] = _build_tool_config(options.get("tool_choice"))

        option_map = {
            "temperature": "temperature",
            "top_p": "topP",
            "top_k": "topK",
            "max_tokens": "maxOutputTokens",
            "stop": "stopSequences",
        }
        for source_name, target_name in option_map.items():
            value = options.get(source_name)
            if value is not None:
                config_kwargs[target_name] = value

        return genai_types.GenerateContentConfig(**config_kwargs)

    def _response_contents_to_af(
        self,
        response: genai_types.GenerateContentResponse,
    ) -> list[Content]:
        af_contents: list[Content] = []

        if response.text:
            af_contents.append(Content.from_text(response.text))

        for function_call in response.function_calls or []:
            af_contents.append(
                Content.from_function_call(
                    call_id=function_call.id or uuid4().hex,
                    name=function_call.name or "tool_call",
                    arguments=json.dumps(function_call.args or {}, ensure_ascii=False),
                )
            )

        if not af_contents and response.text is None:
            af_contents.append(Content.from_text(""))

        return af_contents

    async def _inner_get_response(
        self,
        *,
        messages: MutableSequence[ChatMessage],
        options: dict[str, Any],
        **kwargs: Any,
    ) -> ChatResponse:
        client = await self._ensure_client()
        contents, system_instructions = self._messages_to_gemini(messages)
        response = await client.models.generate_content(
            model=self.model_id,
            contents=contents,
            config=self._build_config(options=options, system_instructions=system_instructions),
        )

        response_contents = self._response_contents_to_af(response)
        response_message = ChatMessage(role="assistant", contents=response_contents)
        return ChatResponse(
            messages=[response_message],
            text=response.text,
            model_id=self.model_id,
            raw_representation=response,
        )

    async def _inner_get_streaming_response(
        self,
        *,
        messages: MutableSequence[ChatMessage],
        options: dict[str, Any],
        **kwargs: Any,
    ):
        client = await self._ensure_client()
        contents, system_instructions = self._messages_to_gemini(messages)
        emitted_function_ids: set[str] = set()

        async for chunk in client.models.generate_content_stream(
            model=self.model_id,
            contents=contents,
            config=self._build_config(options=options, system_instructions=system_instructions),
        ):
            if chunk.text:
                yield ChatResponseUpdate(
                    text=chunk.text,
                    role="assistant",
                    model_id=self.model_id,
                    raw_representation=chunk,
                )

            for function_call in chunk.function_calls or []:
                call_id = function_call.id or uuid4().hex
                if call_id in emitted_function_ids:
                    continue
                emitted_function_ids.add(call_id)
                yield ChatResponseUpdate(
                    contents=[
                        Content.from_function_call(
                            call_id=call_id,
                            name=function_call.name or "tool_call",
                            arguments=json.dumps(function_call.args or {}, ensure_ascii=False),
                        )
                    ],
                    role="assistant",
                    model_id=self.model_id,
                    raw_representation=chunk,
                )


@use_function_invocation
@use_chat_middleware
class GeminiChatClient(_GeminiBaseChatClient):
    pass


def load_vertex_credentials(credentials_path: str | None = None) -> Credentials:
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
    if credentials_path:
        credentials = service_account.Credentials.from_service_account_file(credentials_path, scopes=scopes)
    else:
        credentials, _ = google.auth.default(scopes=scopes)
    return credentials
