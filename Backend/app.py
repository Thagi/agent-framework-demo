import os
import time
import logging
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from agent_framework import ChatAgent, ChatMessage, ConcurrentBuilder, AgentRunUpdateEvent, WorkflowOutputEvent, GroupChatBuilder
from agent_framework.azure import AzureOpenAIChatClient
# from agent_framework.azure import AzureAISearchContextProvider
from typing import Annotated
from pydantic import Field
from azure.search.documents import SearchClient
from azure.core.credentials import AzureKeyCredential
from azure.search.documents.models import QueryType
from session_state import SessionStore
from translations import get_text

load_dotenv()

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",   # Flask / .NET
        "https://localhost:5001",  # .NET (HTTPS)
        "http://localhost:8501",   # Streamlit
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Language setting
LANGUAGE = os.getenv("LANGUAGE", "ja")  # Default: Japanese

AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")

# Model name to Azure OpenAI deployment mapping
# Read from environment variables or use defaults
MODEL_DEPLOYMENT_MAP = {
    "gpt-4.1": os.getenv("AZURE_OPENAI_DEPLOYMENT_GPT41", AZURE_OPENAI_DEPLOYMENT),
    "gpt-4.1-mini": os.getenv("AZURE_OPENAI_DEPLOYMENT_GPT41_MINI", AZURE_OPENAI_DEPLOYMENT),
    "gpt-4.1-nano": os.getenv("AZURE_OPENAI_DEPLOYMENT_GPT41_NANO", AZURE_OPENAI_DEPLOYMENT),
    "gpt-5.2": os.getenv("AZURE_OPENAI_DEPLOYMENT_GPT52", AZURE_OPENAI_DEPLOYMENT),
    "gpt-5.2-chat": os.getenv("AZURE_OPENAI_DEPLOYMENT_GPT52_CHAT", AZURE_OPENAI_DEPLOYMENT),
}

# Azure AI Search settings
SEARCH_ENDPOINT = os.getenv("SEARCH_ENDPOINT")
SEARCH_API_KEY = os.getenv("SEARCH_API_KEY")
SEARCH_INDEX_NAME = os.getenv("SEARCH_INDEX_NAME")
SEARCH_SEMANTIC_CONFIG = os.getenv("SEARCH_SEMANTIC_CONFIG", "default")
SESSION_HISTORY_MESSAGES = max(int(os.getenv("SESSION_HISTORY_MESSAGES", "20")), 4)
PROMPT_HISTORY_MESSAGES = max(int(os.getenv("PROMPT_HISTORY_MESSAGES", "8")), 2)
MODE_GENERAL = "general"
MODE_GUIDELINE = "guideline"
MODE_IDOBATA = "idobata"

session_store = SessionStore(max_messages=SESSION_HISTORY_MESSAGES)

# Initialize Agent Framework Chat Client
chat_client = None

if AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT:
    chat_client = AzureOpenAIChatClient(
        api_key=AZURE_OPENAI_API_KEY,
        endpoint=AZURE_OPENAI_ENDPOINT,
        deployment_name=AZURE_OPENAI_DEPLOYMENT,
    )

def get_chat_client_for_model(model_name: str = None):
    """Return a chat client for the requested model."""
    if not AZURE_OPENAI_API_KEY or not AZURE_OPENAI_ENDPOINT:
        return None
    
    if not model_name or model_name not in MODEL_DEPLOYMENT_MAP:
        # Use default chat_client
        return chat_client
    
    deployment_name = MODEL_DEPLOYMENT_MAP.get(model_name, AZURE_OPENAI_DEPLOYMENT)
    logger.info(get_text('log_model_selected', LANGUAGE, model=model_name, deployment=deployment_name))
    
    return AzureOpenAIChatClient(
        api_key=AZURE_OPENAI_API_KEY,
        endpoint=AZURE_OPENAI_ENDPOINT,
        deployment_name=deployment_name,
    )


def get_session_id(body: dict, default: str = "default") -> str:
    session_id = str(body.get("session_id", default)).strip()
    return session_id or default


def _message_role_value(message: ChatMessage) -> str:
    role = getattr(message, "role", "")
    return getattr(role, "value", str(role))


def _format_history_messages(messages: list[ChatMessage]) -> str:
    formatted = []
    for message in messages:
        text = (message.text or "").strip()
        if not text:
            continue
        role = _message_role_value(message)
        if role == "system":
            continue
        speaker = message.author_name or ("User" if role == "user" else "Assistant")
        collapsed_text = "\n".join(line.rstrip() for line in text.splitlines()).strip()
        formatted.append(f"{speaker}: {collapsed_text[:1200]}")
    return "\n\n".join(formatted)


async def build_prompt_with_history(prompt: str, mode: str, session_id: str) -> str:
    session = await session_store.get_session(mode, session_id)
    if session.thread.message_store is None:
        return prompt

    history_messages = await session.thread.message_store.list_messages()
    history_block = _format_history_messages(history_messages[-PROMPT_HISTORY_MESSAGES:])
    if not history_block:
        return prompt

    return (
        "Use the relevant information from the prior conversation when responding. "
        "If the history is not relevant, prioritize the latest request.\n\n"
        f"Conversation history:\n{history_block}\n\n"
        f"Latest user request:\n{prompt}"
    )


async def append_session_exchange(mode: str, session_id: str, user_prompt: str, assistant_reply: str) -> None:
    if not assistant_reply.strip():
        return

    session = await session_store.get_session(mode, session_id)
    await session.thread.on_new_messages(
        [
            ChatMessage(role="user", text=user_prompt),
            ChatMessage(role="assistant", text=assistant_reply),
        ]
    )


def search_tool(
    query: Annotated[str, Field(description="Search query")],
) -> str:
    """Tool to search for guidelines in the financial sector"""
    try:
        if not query or not query.strip():
            return get_text('search_empty_query', LANGUAGE)
        
        # Initialize Azure AI Search client
        search_client = SearchClient(
            endpoint=SEARCH_ENDPOINT,
            index_name=SEARCH_INDEX_NAME,
            credential=AzureKeyCredential(SEARCH_API_KEY)
        )
        
        # Execute semantic search
        results = search_client.search(
            search_text=query,
            query_type=QueryType.SEMANTIC,
            semantic_configuration_name=SEARCH_SEMANTIC_CONFIG,
            top=3,
            select=["content", "metadata_storage_name"]
        )
        
        # Format results
        formatted_results = []
        file_label = get_text('search_file_label', LANGUAGE)
        content_label = get_text('search_content_label', LANGUAGE)
        
        for result in results:
            content = result.get("content", "")
            file_name = result.get("metadata_storage_name", "Unknown")
            if content and content.strip():  # Only add non-empty content
                formatted_results.append(f"{file_label}: {file_name}\n{content_label}: {content}\n")
        
        if formatted_results:
            logger.info(get_text('log_search_success', LANGUAGE, count=len(formatted_results)))
            return "\n---\n".join(formatted_results)
        else:
            return get_text('search_no_results', LANGUAGE, query=query)
            
    except Exception as e:
        error_msg = get_text('search_error', LANGUAGE, error=str(e))
        logger.error(error_msg)
        return error_msg


@app.post("/api/stream")
async def api_stream(request: Request):
    start_time = time.time()
    request_id = f"req_{int(start_time * 1000)}"
    logger.info(f"[{request_id}] {get_text('log_request_received', LANGUAGE)}")
    
    body = await request.json()
    prompt = body.get("prompt", "")
    model_name = body.get("model", "gpt-4.1-mini")  # Default model
    session_id = get_session_id(body)

    logger.info(f"[{request_id}] {get_text('log_model_info', LANGUAGE, model=model_name)}")
    
    if not prompt:
        return JSONResponse({"error": "prompt required"}, status_code=400)
    
    parse_time = time.time()
    logger.info(f"[{request_id}] {get_text('log_request_parsed', LANGUAGE, time=f'{(parse_time - start_time)*1000:.2f}')}")

    async def generator():
        # Get a chat client for the requested model
        model_chat_client = get_chat_client_for_model(model_name)
        if model_chat_client is None:
            yield get_text('error_config_missing', LANGUAGE)
            return

        session = await session_store.get_session(MODE_GENERAL, session_id)
        async with session.lock:
            # Create a simple agent
            agent_start = time.time()
            logger.info(f"[{request_id}] {get_text('log_agent_creating', LANGUAGE)}")
            simple_agent = ChatAgent(
                name="SimpleAgent",
                chat_client=model_chat_client,
                instructions=get_text('agent_simple_instructions', LANGUAGE),
            )
            logger.info(f"[{request_id}] {get_text('log_agent_created', LANGUAGE, time=f'{(time.time() - agent_start)*1000:.2f}')}")

            # Stream response
            stream_start = time.time()
            logger.info(f"[{request_id}] {get_text('log_streaming_start', LANGUAGE, length=len(prompt))}")
            first_chunk = True
            chunk_count = 0
            async for update in simple_agent.run_stream(prompt, thread=session.thread):
                if update.text:
                    if first_chunk:
                        logger.info(f"[{request_id}] {get_text('log_first_chunk', LANGUAGE, time=f'{(time.time() - stream_start)*1000:.2f}')}")
                        first_chunk = False
                    chunk_count += 1
                    yield update.text

            total_time = time.time() - start_time
            logger.info(f"[{request_id}] {get_text('log_completed', LANGUAGE, time=f'{total_time:.2f}', count=chunk_count)}")

    return StreamingResponse(generator(), media_type="text/plain")


@app.post("/api/rag/stream")
@app.post("/api/guideline/stream")
async def api_guideline_stream(request: Request):
    """Streaming endpoint for RAG-style referenced responses"""
    start_time = time.time()
    request_id = f"rag_{int(start_time * 1000)}"
    logger.info(f"[{request_id}] {get_text('log_guideline_request', LANGUAGE)}")
    
    body = await request.json()
    prompt = body.get("prompt", "")
    model_name = body.get("model", "gpt-4.1-mini")  # Default model
    session_id = get_session_id(body, "guideline")

    logger.info(f"[{request_id}] {get_text('log_model_info', LANGUAGE, model=model_name)}")
    
    if not prompt:
        return JSONResponse({"error": "prompt required"}, status_code=400)
    
    parse_time = time.time()
    logger.info(f"[{request_id}] {get_text('log_request_parsed', LANGUAGE, time=f'{(parse_time - start_time)*1000:.2f}')}")

    async def generator():
        # Get a chat client for the requested model
        model_chat_client = get_chat_client_for_model(model_name)
        if model_chat_client is None:
            yield get_text('error_config_missing', LANGUAGE)
            return

        session = await session_store.get_session(MODE_GUIDELINE, session_id)
        async with session.lock:
            try:
                # Agent using Azure AI Search tool
                agent_start = time.time()
                logger.info(f"[{request_id}] {get_text('log_search_agent_creating', LANGUAGE)}")
                search_agent = ChatAgent(
                    chat_client=model_chat_client,
                    instructions=get_text('agent_guideline_instructions', LANGUAGE),
                    tools=[search_tool],
                )
                logger.info(f"[{request_id}] {get_text('log_search_agent_created', LANGUAGE, time=f'{(time.time() - agent_start)*1000:.2f}')}")

                # Stream response
                stream_start = time.time()
                logger.info(f"[{request_id}] {get_text('log_streaming_start', LANGUAGE, length=len(prompt))}")
                first_chunk = True
                chunk_count = 0
                async for update in search_agent.run_stream(prompt, thread=session.thread):
                    if update.text:
                        if first_chunk:
                            logger.info(f"[{request_id}] {get_text('log_first_chunk', LANGUAGE, time=f'{(time.time() - stream_start)*1000:.2f}')}")
                            first_chunk = False
                        chunk_count += 1
                        yield update.text

                total_time = time.time() - start_time
                logger.info(f"[{request_id}] {get_text('log_completed', LANGUAGE, time=f'{total_time:.2f}', count=chunk_count)}")

            except Exception as e:
                error_msg = get_text('error_search_processing', LANGUAGE, error=str(e))
                logger.error(f"[{request_id}] ❌ {error_msg}")
                yield get_text('error_retry_message', LANGUAGE, error=error_msg)

    return StreamingResponse(generator(), media_type="text/plain")


@app.post("/api/multi-agent-stream")
async def multi_agent_stream(request: Request):
    start_time = time.time()
    request_id = f"multi_{int(start_time * 1000)}"
    logger.info(f"[{request_id}] {get_text('log_multi_agent_request', LANGUAGE)}")
    
    body = await request.json()
    prompt = body.get("prompt", "")
    model_name = body.get("model", "gpt-4.1-mini")  # Default model
    session_id = get_session_id(body)

    logger.info(f"[{request_id}] {get_text('log_model_info', LANGUAGE, model=model_name)}")
    
    if not prompt:
        return JSONResponse({"error": "prompt required"}, status_code=400)
    
    parse_time = time.time()
    logger.info(f"[{request_id}] {get_text('log_multi_agent_parsed', LANGUAGE, time=f'{(parse_time - start_time)*1000:.2f}')}")

    async def generator():
        import json

        # Get a chat client for the requested model
        model_chat_client = get_chat_client_for_model(model_name)
        if model_chat_client is None:
            yield json.dumps(
                {"type": "error", "message": get_text('error_config_missing', LANGUAGE)},
                ensure_ascii=False,
            ) + "\n"
            return
        
        session = await session_store.get_session(MODE_GENERAL, session_id)
        async with session.lock:
            # Create model-specific agents
            model_critical_agent = ChatAgent(
                name="CriticalAnalyst",
                chat_client=model_chat_client,
                instructions=get_text('agent_critical_instructions', LANGUAGE),
            )

            model_positive_agent = ChatAgent(
                name="PositiveAdvocate",
                chat_client=model_chat_client,
                instructions=get_text('agent_positive_instructions', LANGUAGE),
            )

            model_synthesizer_agent = ChatAgent(
                name="Synthesizer",
                chat_client=model_chat_client,
                instructions=get_text('agent_synthesizer_instructions', LANGUAGE),
            )

            try:
                yield json.dumps(
                    {"type": "ui_message", "message": get_text('ui_multi_agent_start', LANGUAGE)},
                    ensure_ascii=False,
                ) + "\n"
                yield json.dumps({"type": "start"}, ensure_ascii=False) + "\n"

                workflow_prompt = await build_prompt_with_history(prompt, MODE_GENERAL, session_id)

                # Use ConcurrentBuilder to create parallel workflow
                workflow_start = time.time()
                logger.info(f"[{request_id}] {get_text('log_workflow_building', LANGUAGE)}")
                agents = [model_critical_agent, model_positive_agent]
                workflow = ConcurrentBuilder().participants(agents).build()
                logger.info(f"[{request_id}] {get_text('log_workflow_built', LANGUAGE, time=f'{(time.time() - workflow_start)*1000:.2f}')}")

                # Store agent results
                agent_results = {}

                # Execute workflow with streaming
                workflow_exec_start = time.time()
                logger.info(f"[{request_id}] {get_text('log_parallel_execution_start', LANGUAGE, length=len(prompt))}")
                event_count = 0
                async for event in workflow.run_stream(workflow_prompt):
                    event_count += 1
                    # AgentRunUpdateEvent: Streaming updates from agents
                    if isinstance(event, AgentRunUpdateEvent):
                        agent_name = event.executor_id

                        if event.data and hasattr(event.data, 'text') and event.data.text:
                            data = {
                                "agent": agent_name,
                                "content": event.data.text,
                                "is_final": False
                            }
                            yield json.dumps(data, ensure_ascii=False) + "\n"

                    elif isinstance(event, WorkflowOutputEvent):
                        if event.data:
                            for msg in event.data:
                                if hasattr(msg, 'author_name') and hasattr(msg, 'text'):
                                    agent_results[msg.author_name] = msg.text

                agents_time = time.time() - workflow_exec_start
                logger.info(f"[{request_id}] {get_text('log_parallel_execution_complete', LANGUAGE, time=f'{agents_time:.2f}', count=event_count)}")
                yield json.dumps({"type": "agents_complete"}, ensure_ascii=False) + "\n"

                # Stream synthesis analysis
                synthesis_start = time.time()
                logger.info(f"[{request_id}] {get_text('log_synthesis_start', LANGUAGE)}")
                yield json.dumps({"type": "synthesis_start"}, ensure_ascii=False) + "\n"

                critical_content = agent_results.get("CriticalAnalyst", "")
                positive_content = agent_results.get("PositiveAdvocate", "")

                synthesis_prompt = f"""
Integrate the following two perspectives to provide a balanced analysis.

Original question: {prompt}

Critical perspective:
{critical_content}

Positive perspective:
{positive_content}
"""

                synthesis_parts = []
                synthesis_chunk_count = 0
                async for update in model_synthesizer_agent.run_stream(synthesis_prompt):
                    if update.text:
                        synthesis_chunk_count += 1
                        synthesis_parts.append(update.text)
                        data = {
                            "agent": "Synthesizer",
                            "content": update.text,
                            "is_final": False
                        }
                        yield json.dumps(data, ensure_ascii=False) + "\n"

                synthesis_text = "".join(synthesis_parts).strip()
                assistant_summary = (
                    "Critical perspective:\n"
                    f"{critical_content}\n\n"
                    "Positive perspective:\n"
                    f"{positive_content}\n\n"
                    "Synthesis:\n"
                    f"{synthesis_text}"
                )
                await append_session_exchange(MODE_GENERAL, session_id, prompt, assistant_summary)

                synthesis_time = time.time() - synthesis_start
                total_time = time.time() - start_time
                logger.info(f"[{request_id}] {get_text('log_synthesis_complete', LANGUAGE, time=f'{synthesis_time:.2f}', count=synthesis_chunk_count)}")
                logger.info(f"[{request_id}] {get_text('log_overall_complete', LANGUAGE, time=f'{total_time:.2f}')}")
                yield json.dumps({"type": "complete"}, ensure_ascii=False) + "\n"

            except Exception as e:
                import traceback
                error_data = {
                    "type": "error",
                    "message": str(e),
                    "traceback": traceback.format_exc()
                }
                yield json.dumps(error_data, ensure_ascii=False) + "\n"

    return StreamingResponse(generator(), media_type="text/plain")


@app.post("/api/phase1/stream")
async def phase1_planning_stream(request: Request):
    start_time = time.time()
    request_id = f"phase1_{int(start_time * 1000)}"
    logger.info(f"[{request_id}] {get_text('log_idobata_request', LANGUAGE)}")

    body = await request.json()
    prompt = body.get("prompt", "")
    model_name = body.get("model", "gpt-4.1-mini")
    tone = body.get("tone", "balanced")
    session_id = get_session_id(body, "idobata")

    logger.info(f"[{request_id}] {get_text('log_model_info', LANGUAGE, model=model_name)}")
    logger.info(f"[{request_id}] {get_text('log_tone_setting', LANGUAGE, tone=tone)}")

    if not prompt:
        return JSONResponse({"error": "prompt required"}, status_code=400)

    parse_time = time.time()
    logger.info(f"[{request_id}] {get_text('log_request_parsed', LANGUAGE, time=f'{(parse_time - start_time)*1000:.2f}')}")
    
    # Tone-specific speaking style instructions
    tone_instructions = {
        "formal": get_text('tone_formal', LANGUAGE),
        "balanced": get_text('tone_balanced', LANGUAGE),
        "casual": get_text('tone_casual', LANGUAGE),
        "concise": get_text('tone_concise', LANGUAGE),
        "detailed": get_text('tone_detailed', LANGUAGE)
    }
    
    tone_suffix = tone_instructions.get(tone, tone_instructions["balanced"])

    async def generator():
        model_chat_client = get_chat_client_for_model(model_name)
        if model_chat_client is None:
            yield get_text('error_config_missing', LANGUAGE) + "\n"
            return

        import json

        AGENT_SEQUENCE = [
            "CEO",
            "CTO",
            "CFO",
            "COO",
        ]

        def _pick_participant_name(*candidates: Optional[str]) -> Optional[str]:
            """Return the first candidate that matches a known participant name."""
            for candidate in candidates:
                if not candidate:
                    continue
                value = str(candidate).strip()
                if value in AGENT_SEQUENCE:
                    return value
            return None

        session = await session_store.get_session(MODE_IDOBATA, session_id)
        async with session.lock:
            # AI Board Meeting: Create CxO agents
            logger.info(f"[{request_id}] {get_text('log_planning_agent_creating', LANGUAGE)}")
            ceo_agent = ChatAgent(
                name="CEO",
                chat_client=model_chat_client,
                description="CEO leading the management meeting and presenting strategic direction",
                instructions=get_text('agent_board_ceo_instructions', LANGUAGE, tone_suffix=tone_suffix),
            )

            cto_agent = ChatAgent(
                name="CTO",
                chat_client=model_chat_client,
                description="Evaluates technical strategy and feasibility",
                instructions=get_text('agent_board_cto_instructions', LANGUAGE, tone_suffix=tone_suffix),
            )

            cfo_agent = ChatAgent(
                name="CFO",
                chat_client=model_chat_client,
                description="Evaluates financial viability and business potential",
                instructions=get_text('agent_board_cfo_instructions', LANGUAGE, tone_suffix=tone_suffix),
            )

            coo_agent = ChatAgent(
                name="COO",
                chat_client=model_chat_client,
                description="Integrates CxO opinions and creates execution plan",
                instructions=get_text('agent_board_coo_instructions', LANGUAGE, tone_suffix=tone_suffix),
            )

            logger.info(f"[{request_id}] {get_text('log_planning_agent_created', LANGUAGE)}")

            # Build workflow (create new instance to reset)
            workflow_id = f"wf_{int(time.time() * 1000)}"
            logger.info(f"[{request_id}] {get_text('log_board_workflow_building', LANGUAGE, id=workflow_id)}")

            selector_state = {
                "calls": 0,
                "last_returned": None,
            }

            def planning_selector(state) -> Optional[str]:
                round_idx = getattr(state, "current_round", None)
                if round_idx is None:
                    round_idx = getattr(state, "round_index", 0) or 0

                history = getattr(state, "conversation", None)
                if history is None:
                    history = getattr(state, "history", ()) or ()

                MAX_ROUNDS = 10
                if round_idx >= MAX_ROUNDS:
                    logger.warning(f"[{request_id}] {get_text('warning_max_rounds', LANGUAGE, max=MAX_ROUNDS)}")
                    return None

                MAX_SELECTOR_CALLS = 50
                if selector_state["calls"] >= MAX_SELECTOR_CALLS:
                    logger.warning(f"[{request_id}] {get_text('warning_max_selector_calls', LANGUAGE, max=MAX_SELECTOR_CALLS)}")
                    return None

                for turn in reversed(history):
                    text = ""
                    if hasattr(turn, "text"):
                        text = turn.text or ""
                    elif hasattr(turn, "message") and hasattr(turn.message, "text"):
                        text = turn.message.text or ""
                    if text and "PLAN_READY:" in text:
                        logger.info(f"[{request_id}] {get_text('log_plan_ready', LANGUAGE)}")
                        return None

                last_agent_speaker: Optional[str] = None
                for turn in reversed(history):
                    speaker = None
                    if hasattr(turn, "author_name"):
                        speaker = turn.author_name
                    elif hasattr(turn, "speaker"):
                        speaker = turn.speaker
                    elif hasattr(turn, "message") and hasattr(turn.message, "author_name"):
                        speaker = turn.message.author_name
                    speaker = _pick_participant_name(speaker)
                    if speaker:
                        last_agent_speaker = speaker
                        break

                if not last_agent_speaker:
                    next_speaker = AGENT_SEQUENCE[0]
                else:
                    current_index = AGENT_SEQUENCE.index(last_agent_speaker)
                    next_speaker = AGENT_SEQUENCE[(current_index + 1) % len(AGENT_SEQUENCE)]

                if next_speaker == selector_state.get("last_returned"):
                    current_index = AGENT_SEQUENCE.index(next_speaker)
                    next_speaker = AGENT_SEQUENCE[(current_index + 1) % len(AGENT_SEQUENCE)]

                selector_state["calls"] += 1
                selector_state["last_returned"] = next_speaker
                return next_speaker

            planning_workflow = (
                GroupChatBuilder()
                .participants([
                    ceo_agent,
                    cto_agent,
                    cfo_agent,
                    coo_agent,
                ])
                .with_select_speaker_func(planning_selector, orchestrator_name="PlanningOrchestrator")
                .build()
            )

            logger.info(f"[{request_id}] {get_text('log_board_workflow_built', LANGUAGE, id=workflow_id)}")

            workflow_prompt = await build_prompt_with_history(prompt, MODE_IDOBATA, session_id)
            workflow_exec_start = time.time()
            logger.info(f"[{request_id}] {get_text('log_board_workflow_start', LANGUAGE, length=len(prompt))}")
            event_count = 0
            seq = 0
            board_notes = {
                "CEO": [],
                "CTO": [],
                "CFO": [],
                "COO": [],
            }

            async for event in planning_workflow.run_stream(workflow_prompt):
                event_count += 1
                if isinstance(event, AgentRunUpdateEvent):
                    author_name = None
                    if event.data is not None:
                        if hasattr(event.data, "author_name") and event.data.author_name:
                            author_name = event.data.author_name
                        elif hasattr(event.data, "message") and hasattr(event.data.message, "author_name"):
                            author_name = event.data.message.author_name

                    agent_name = _pick_participant_name(author_name, event.executor_id)
                    if not agent_name:
                        continue

                    text = ""
                    if event.data is not None and hasattr(event.data, "text"):
                        text = event.data.text or ""
                    elif event.data is not None and hasattr(event.data, "message") and hasattr(event.data.message, "text"):
                        text = event.data.message.text or ""
                    elif event.data is not None:
                        text = str(event.data)
                    if text:
                        board_notes[agent_name].append(text)
                        seq += 1
                        data = {
                            "agent": agent_name,
                            "seq": seq,
                            "content": text,
                            "is_final": False,
                            "executor_id": getattr(event, "executor_id", None),
                            "author_name": author_name,
                        }
                        yield json.dumps(data, ensure_ascii=False) + "\n"
                elif isinstance(event, WorkflowOutputEvent):
                    pass

            assistant_summary = (
                "CEO:\n"
                f"{''.join(board_notes['CEO']).strip()}\n\n"
                "CTO:\n"
                f"{''.join(board_notes['CTO']).strip()}\n\n"
                "CFO:\n"
                f"{''.join(board_notes['CFO']).strip()}\n\n"
                "COO:\n"
                f"{''.join(board_notes['COO']).strip()}"
            )
            await append_session_exchange(MODE_IDOBATA, session_id, prompt, assistant_summary)

            total_time = time.time() - start_time
            workflow_time = time.time() - workflow_exec_start
            logger.info(f"[{request_id}] {get_text('log_board_complete', LANGUAGE, workflow_time=f'{workflow_time:.2f}', count=event_count, total_time=f'{total_time:.2f}')}")
            yield json.dumps({"type": "complete"}, ensure_ascii=False) + "\n"

    return StreamingResponse(generator(), media_type="text/plain")


@app.post("/api/sessions/clear")
async def clear_session(request: Request):
    body = await request.json()
    session_id = get_session_id(body)
    mode = str(body.get("mode", MODE_GENERAL)).strip() or MODE_GENERAL
    await session_store.clear_session(mode, session_id)
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"status": "ok", "framework": "Microsoft Agent Framework"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print("=== Agent Framework (Workflow Edition) Backend Starting ===")
    print(f"URL: http://localhost:{port}")
    print(f"Docs: http://localhost:{port}/docs")
    print("\nCtrl+C to stop\n")
    uvicorn.run(app, host=host, port=port)
