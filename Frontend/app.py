from flask import Flask, render_template, request, jsonify, Response, stream_with_context
import httpx
import json
import time
import logging
from datetime import datetime
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['BACKEND_URL'] = os.getenv('BACKEND_URL', 'http://localhost:8000')
app.config['LANGUAGE'] = os.getenv('LANGUAGE', 'ja')


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


app.config['ENABLE_DI_LINK'] = _env_bool('ENABLE_DI_LINK', False)

# Session storage persisted to JSON files per session.
messages_store = {}
APP_DIR = Path(__file__).resolve().parent
MESSAGE_STORE_DIR = Path(os.getenv('FRONTEND_MESSAGE_STORE_PATH', 'data/frontend_messages'))
if not MESSAGE_STORE_DIR.is_absolute():
    MESSAGE_STORE_DIR = APP_DIR / MESSAGE_STORE_DIR
MESSAGE_STORE_DIR.mkdir(parents=True, exist_ok=True)


def _message_store_path(session_id: str) -> Path:
    safe_session_id = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '_' for ch in session_id)
    return MESSAGE_STORE_DIR / f'{safe_session_id or "default"}.json'


def _load_persisted_messages(session_id: str) -> list:
    path = _message_store_path(session_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return []


def _persist_messages(session_id: str) -> None:
    path = _message_store_path(session_id)
    payload = messages_store.get(session_id, [])
    temp_path = path.with_name(f'.{path.name}.tmp')
    temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    temp_path.replace(path)


def _append_message(session_id: str, message: dict) -> None:
    if session_id not in messages_store:
        messages_store[session_id] = _load_persisted_messages(session_id)
    messages_store[session_id].append(message)
    _persist_messages(session_id)


FRONT_TEXT = {
    "ja": {
        "log_front_request_received": "📨 フロントエンド: リクエスト受信 (model={model})",
        "log_front_send_backend": "🔗 バックエンドへリクエスト送信 (model={model})",
        "log_front_first_chunk": "⏱️ 最初のチャンク受信 (待機時間: {ms}ms)",
        "log_front_completed_chunks": "✅ フロントエンド完了 (総時間: {s}s, チャンク数: {count})",
        "log_front_guideline_request": "📨 RAG検索リクエスト受信 (model={model})",
        "log_front_multi_request_received": "📨 フロントエンド: マルチエージェントリクエスト受信 (model={model})",
        "log_front_send_multi_backend": "🔗 バックエンドへマルチエージェントリクエスト送信 (model={model})",
        "log_front_first_response": "⏱️ 最初のレスポンス受信 (待機時間: {ms}ms)",
        "log_front_completed_lines": "✅ フロントエンド完了 (総時間: {s}s, ライン数: {count})",
        "log_front_board_request_received": "📨 フロントエンド: 井戸端会議リクエスト受信 (model={model}, tone={tone})",
        "log_front_send_phase1_backend": "🔗 バックエンドへフェーズ1リクエスト送信 (model={model}, tone={tone})",
        "label_multi_agent": "🔀 [マルチエージェント分析]",
        "label_idobata": "🗣️ [井戸端会議]",
        "error_block": "\n\n❌ エラー: {error}",
        "error_inline": "❌ エラー: {error}",
    },
    "en": {
        "log_front_request_received": "📨 Frontend: Request received (model={model})",
        "log_front_send_backend": "🔗 Sending request to backend (model={model})",
        "log_front_first_chunk": "⏱️ First chunk received (wait time: {ms}ms)",
        "log_front_completed_chunks": "✅ Frontend completed (total time: {s}s, chunks: {count})",
        "log_front_guideline_request": "📨 RAG search request received (model={model})",
        "log_front_multi_request_received": "📨 Frontend: Multi-agent request received (model={model})",
        "log_front_send_multi_backend": "🔗 Sending multi-agent request to backend (model={model})",
        "log_front_first_response": "⏱️ First response received (wait time: {ms}ms)",
        "log_front_completed_lines": "✅ Frontend completed (total time: {s}s, lines: {count})",
        "log_front_board_request_received": "📨 Frontend: AI board meeting request received (model={model}, tone={tone})",
        "log_front_send_phase1_backend": "🔗 Sending phase 1 request to backend (model={model}, tone={tone})",
        "label_multi_agent": "🔀 [Multi-Agent Analysis]",
        "label_idobata": "🗣️ [AI Board Meeting]",
        "error_block": "\n\n❌ Error: {error}",
        "error_inline": "❌ Error: {error}",
    },
}


def front_text(key: str, **kwargs) -> str:
    """Return a localized frontend text for the configured LANGUAGE."""
    lang = app.config.get("LANGUAGE", "ja")
    table = FRONT_TEXT.get(lang) or FRONT_TEXT["ja"]
    template = table.get(key) or FRONT_TEXT["ja"].get(key) or key
    return template.format(**kwargs)


def clear_backend_session(mode: str, session_id: str) -> None:
    """Best-effort clear for backend-side Agent Framework session memory."""
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                f"{app.config['BACKEND_URL']}/api/sessions/clear",
                json={"mode": mode, "session_id": session_id},
            )
            response.raise_for_status()
    except Exception as exc:
        logger.warning("Backend session clear failed (mode=%s, session=%s): %s", mode, session_id, exc)


@app.route('/')
def index():
    """Main page"""
    language = app.config['LANGUAGE']
    enable_di_link = app.config.get('ENABLE_DI_LINK', False)
    return render_template('index.html', language=language, enable_di_link=enable_di_link)


@app.route('/api/models', methods=['GET'])
def get_models():
    """Proxy the backend model list so the browser stays same-origin."""
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{app.config['BACKEND_URL']}/api/models")
            response.raise_for_status()
            return jsonify(response.json())
    except Exception as exc:
        logger.error("Failed to fetch backend model list: %s", exc)
        return jsonify({"default_model": None, "models": [], "error": str(exc)}), 502


@app.route('/api/files', methods=['GET'])
def get_uploaded_files():
    session_id = request.args.get('session_id', 'default')
    mode = request.args.get('mode', 'general')

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.get(
                f"{app.config['BACKEND_URL']}/api/files",
                params={'session_id': session_id, 'mode': mode},
            )
            response.raise_for_status()
            return jsonify(response.json())
    except Exception as exc:
        logger.error("Failed to fetch uploaded files: %s", exc)
        return jsonify({"files": [], "error": str(exc)}), 502


@app.route('/api/files', methods=['POST'])
def upload_files():
    session_id = request.form.get('session_id', 'default')
    mode = request.form.get('mode', 'general')
    files = request.files.getlist('files')

    if not files:
        return jsonify({'error': 'files required'}), 400

    backend_files = []
    for uploaded in files:
        backend_files.append(
            (
                'files',
                (
                    uploaded.filename or 'uploaded-file',
                    uploaded.read(),
                    uploaded.mimetype or 'application/octet-stream',
                ),
            )
        )

    try:
        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                f"{app.config['BACKEND_URL']}/api/files",
                data={'session_id': session_id, 'mode': mode},
                files=backend_files,
            )
            return jsonify(response.json()), response.status_code
    except Exception as exc:
        logger.error("Failed to upload files: %s", exc)
        return jsonify({"files": [], "error": str(exc)}), 502


@app.route('/api/files/<file_id>', methods=['DELETE'])
def delete_uploaded_file(file_id: str):
    session_id = request.args.get('session_id', 'default')
    mode = request.args.get('mode', 'general')

    try:
        with httpx.Client(timeout=20.0) as client:
            response = client.delete(
                f"{app.config['BACKEND_URL']}/api/files/{file_id}",
                params={'session_id': session_id, 'mode': mode},
            )
            return jsonify(response.json()), response.status_code
    except Exception as exc:
        logger.error("Failed to delete uploaded file: %s", exc)
        return jsonify({"files": [], "error": str(exc)}), 502


@app.route('/api/messages', methods=['GET'])
def get_messages():
    """Get message history"""
    session_id = request.args.get('session_id', 'default')
    messages = messages_store.get(session_id)
    if messages is None:
        messages = _load_persisted_messages(session_id)
        messages_store[session_id] = messages
    return jsonify(messages)


@app.route('/api/messages/clear', methods=['POST'])
def clear_messages():
    """Clear message history"""
    data = request.json
    session_id = data.get('session_id', 'default')
    mode = data.get('mode', 'general')
    messages_store[session_id] = []
    path = _message_store_path(session_id)
    if path.exists():
        path.unlink()
    clear_backend_session(mode, session_id)
    return jsonify({'status': 'ok'})


@app.route('/api/chat/stream', methods=['POST'])
def chat_stream():
    """Regular chat streaming"""
    start_time = time.time()
    request_id = f"front_req_{int(start_time * 1000)}"
    
    data = request.json
    prompt = data.get('prompt', '')
    session_id = data.get('session_id', 'default')
    model = data.get('model', 'gpt-4.1-mini')
    
    logger.info(f"[{request_id}] {front_text('log_front_request_received', model=model)}")
    
    if not prompt:
        return jsonify({'error': 'prompt required'}), 400
    
    # Save user message
    user_message = {
        'is_user': True,
        'content': prompt,
        'timestamp': datetime.now().isoformat()
    }
    _append_message(session_id, user_message)
    
    def generate():
        """Generate streaming response"""
        ai_content = ""
        plan_payload = None
        try:
            backend_request_start = time.time()
            logger.info(f"[{request_id}] {front_text('log_front_send_backend', model=model)}")
            with httpx.Client(timeout=60.0) as client:
                with client.stream(
                    'POST',
                    f"{app.config['BACKEND_URL']}/api/stream",
                    json={'prompt': prompt, 'model': model, 'session_id': session_id}
                ) as response:
                    response.raise_for_status()
                    first_chunk = True
                    chunk_count = 0
                    for line in response.iter_lines():
                        if not line.strip():
                            continue
                        if first_chunk:
                            logger.info(
                                f"[{request_id}] {front_text('log_front_first_chunk', ms=f'{(time.time() - backend_request_start)*1000:.2f}') }"
                            )
                            first_chunk = False
                        chunk_count += 1
                        yield line + '\n'
                        try:
                            payload = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if payload.get('type') == 'plan':
                            plan_payload = payload.get('plan')
                        elif payload.get('type') == 'delta' and payload.get('content'):
                            ai_content += payload['content']
            
            total_time = time.time() - start_time
            logger.info(
                f"[{request_id}] {front_text('log_front_completed_chunks', s=f'{total_time:.2f}', count=chunk_count)}"
            )
            
            # Save AI message
            ai_message = {
                'is_user': False,
                'content': ai_content,
                'plan': plan_payload,
                'timestamp': datetime.now().isoformat(),
                'is_streaming': False
            }
            _append_message(session_id, ai_message)
            
        except Exception as e:
            error_data = {'type': 'error', 'message': str(e)}
            yield json.dumps(error_data) + '\n'
            
            ai_message = {
                'is_user': False,
                'content': ai_content + front_text('error_block', error=str(e)),
                'plan': plan_payload,
                'timestamp': datetime.now().isoformat(),
                'is_streaming': False
            }
            _append_message(session_id, ai_message)
    
    return Response(stream_with_context(generate()), content_type='application/x-ndjson')


@app.route('/api/rag/stream', methods=['POST'])
@app.route('/api/guideline/stream', methods=['POST'])
def guideline_stream():
    """RAG search chat streaming (backward compatible with /api/guideline/stream)"""
    data = request.json
    prompt = data.get('prompt', '')
    model = data.get('model', 'gpt-4.1-mini')
    session_id = data.get('session_id', 'guideline')

    logger.info(front_text('log_front_guideline_request', model=model))
    
    if not prompt:
        return jsonify({'error': 'prompt required'}), 400

    user_message = {
        'is_user': True,
        'content': prompt,
        'timestamp': datetime.now().isoformat()
    }
    _append_message(session_id, user_message)
    
    def generate():
        """Generate streaming response"""
        ai_content = ""
        plan_payload = None
        trace_payloads = []
        evidence_payload = []
        try:
            with httpx.Client(timeout=60.0) as client:
                with client.stream(
                    'POST',
                    f"{app.config['BACKEND_URL']}/api/rag/stream",
                    json={'prompt': prompt, 'model': model, 'session_id': session_id}
                ) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if not line.strip():
                            continue
                        yield line + '\n'
                        try:
                            payload = json.loads(line)
                        except json.JSONDecodeError:
                            continue

                        if payload.get('type') == 'plan':
                            plan_payload = payload.get('plan')
                        elif payload.get('type') == 'delta' and payload.get('content'):
                            ai_content += payload['content']
                        elif payload.get('type') == 'trace' and payload.get('trace'):
                            trace_payloads.append(payload.get('trace'))
                        elif payload.get('type') == 'evidence' and payload.get('evidence'):
                            evidence_payload = payload.get('evidence')

            _append_message(
                session_id,
                {
                    'is_user': False,
                    'content': ai_content,
                    'plan': plan_payload,
                    'traces': trace_payloads,
                    'evidence': evidence_payload,
                    'timestamp': datetime.now().isoformat(),
                    'is_streaming': False
                }
            )
            
        except Exception as e:
            yield json.dumps({'type': 'error', 'message': str(e)}) + '\n'
            _append_message(
                session_id,
                {
                    'is_user': False,
                    'content': ai_content + front_text('error_block', error=str(e)),
                    'plan': plan_payload,
                    'traces': trace_payloads,
                    'evidence': evidence_payload,
                    'timestamp': datetime.now().isoformat(),
                    'is_streaming': False
                }
            )
    
    return Response(stream_with_context(generate()), content_type='application/x-ndjson')


@app.route('/api/chat/multi-agent-stream', methods=['POST'])
def multi_agent_stream():
    """Multi-agent chat streaming"""
    start_time = time.time()
    request_id = f"front_multi_{int(start_time * 1000)}"
    
    data = request.json
    prompt = data.get('prompt', '')
    session_id = data.get('session_id', 'default')
    model = data.get('model', 'gpt-4.1-mini')
    
    logger.info(f"[{request_id}] {front_text('log_front_multi_request_received', model=model)}")
    
    if not prompt:
        return jsonify({'error': 'prompt required'}), 400
    
    # Save user message
    user_message = {
        'is_user': True,
        'content': f"{front_text('label_multi_agent')} {prompt}",
        'timestamp': datetime.now().isoformat()
    }
    _append_message(session_id, user_message)
    
    def generate():
        """Generate multi-agent streaming response"""
        ai_message = {
            'is_user': False,
            'is_multi_agent': True,
            'timestamp': datetime.now().isoformat(),
            'plan': None,
            'critical_content': '',
            'positive_content': '',
            'synthesis_content': ''
        }
        
        try:
            backend_request_start = time.time()
            logger.info(f"[{request_id}] {front_text('log_front_send_multi_backend', model=model)}")
            first_response = True
            line_count = 0
            with httpx.Client(timeout=120.0) as client:
                with client.stream(
                    'POST',
                    f"{app.config['BACKEND_URL']}/api/multi-agent-stream",
                    json={'prompt': prompt, 'model': model, 'session_id': session_id}
                ) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if line.strip():
                            try:
                                if first_response:
                                    logger.info(
                                        f"[{request_id}] {front_text('log_front_first_response', ms=f'{(time.time() - backend_request_start)*1000:.2f}') }"
                                    )
                                    first_response = False
                                line_count += 1
                                # Send in JSON-Lines format
                                yield line + '\n'
                                
                                # Update message store
                                data = json.loads(line)
                                if data.get('type') == 'plan':
                                    ai_message['plan'] = data.get('plan')
                                if 'agent' in data and 'content' in data:
                                    agent = data['agent']
                                    content = data['content']
                                    
                                    if agent == 'CriticalAnalyst':
                                        ai_message['critical_content'] += content
                                    elif agent == 'PositiveAdvocate':
                                        ai_message['positive_content'] += content
                                    elif agent == 'Synthesizer':
                                        ai_message['synthesis_content'] += content
                            except json.JSONDecodeError:
                                continue
            
            total_time = time.time() - start_time
            logger.info(
                f"[{request_id}] {front_text('log_front_completed_lines', s=f'{total_time:.2f}', count=line_count)}"
            )
            
            # Save AI message
            _append_message(session_id, ai_message)
            
        except Exception as e:
            error_data = {'type': 'error', 'message': str(e)}
            yield json.dumps(error_data) + '\n'
            
            ai_message['synthesis_content'] = front_text('error_inline', error=str(e))
            _append_message(session_id, ai_message)
    
    return Response(stream_with_context(generate()), content_type='application/x-ndjson')


@app.route('/api/chat/idobata-stream', methods=['POST'])
def idobata_stream():
    """AI Board Meeting (Phase 1 Planning) streaming"""
    start_time = time.time()
    request_id = f"front_idobata_{int(start_time * 1000)}"

    data = request.json
    prompt = data.get('prompt', '')
    session_id = data.get('session_id', 'idobata')
    model = data.get('model', 'gpt-4.1-mini')
    tone = data.get('tone', 'balanced')

    logger.info(
        f"[{request_id}] {front_text('log_front_board_request_received', model=model, tone=tone)}"
    )

    if not prompt:
        return jsonify({'error': 'prompt required'}), 400

    user_message = {
        'is_user': True,
        'content': f"{front_text('label_idobata')} {prompt}",
        'timestamp': datetime.now().isoformat()
    }
    _append_message(session_id, user_message)

    def generate():
        ai_message = {
            'is_user': False,
            'is_planning': True,
            'timestamp': datetime.now().isoformat(),
            'plan': None,
            'planning_content': '',
            'tech_content': '',
            'business_content': '',
            'synthesis_content': ''
        }

        try:
            backend_request_start = time.time()
            logger.info(
                f"[{request_id}] {front_text('log_front_send_phase1_backend', model=model, tone=tone)}"
            )
            first_response = True
            line_count = 0
            with httpx.Client(timeout=180.0) as client:
                with client.stream(
                    'POST',
                    f"{app.config['BACKEND_URL']}/api/phase1/stream",
                    json={'prompt': prompt, 'model': model, 'tone': tone, 'session_id': session_id}
                ) as response:
                    response.raise_for_status()
                    for line in response.iter_lines():
                        if line.strip():
                            try:
                                if first_response:
                                    logger.info(
                                        f"[{request_id}] {front_text('log_front_first_response', ms=f'{(time.time() - backend_request_start)*1000:.2f}') }"
                                    )
                                    first_response = False
                                line_count += 1
                                yield line + '\n'

                                data = json.loads(line)
                                if data.get('type') == 'plan':
                                    ai_message['plan'] = data.get('plan')
                                if 'agent' in data and 'content' in data:
                                    agent = data['agent']
                                    content = data['content']

                                    # Backend (/api/phase1/stream) returns CEO/CTO/CFO/COO
                                    if agent == 'CEO':
                                        ai_message['planning_content'] += content
                                    elif agent == 'CTO':
                                        ai_message['tech_content'] += content
                                    elif agent == 'CFO':
                                        ai_message['business_content'] += content
                                    elif agent == 'COO':
                                        ai_message['synthesis_content'] += content
                            except json.JSONDecodeError:
                                continue

            total_time = time.time() - start_time
            logger.info(
                f"[{request_id}] {front_text('log_front_completed_lines', s=f'{total_time:.2f}', count=line_count)}"
            )

            _append_message(session_id, ai_message)

        except Exception as e:
            error_data = {'type': 'error', 'message': str(e)}
            yield json.dumps(error_data) + '\n'

            ai_message['synthesis_content'] = front_text('error_inline', error=str(e))
            _append_message(session_id, ai_message)

    return Response(stream_with_context(generate()), content_type='application/x-ndjson')


if __name__ == '__main__':
    port = int(os.getenv("PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "0").lower() in ("1", "true", "yes", "on")
    host = os.getenv("HOST", "0.0.0.0")
    app.run(debug=debug, host=host, port=port, threaded=True)
