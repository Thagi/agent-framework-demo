// i18n translation data
const translations = {
    ja: {
        // Header
        'app_title': 'Agent Streaming Chat',
        
        // Mode tabs
        'mode_general': '通常チャット',
        'mode_guideline': 'RAG検索',
        'mode_idobata': 'AI役員会議',
        
        // General chat
        'general_title': 'マルチエージェントチャットアシスタント',
        'general_subtitle': 'Powered by Microsoft Agent Framework',
        'model_label': 'モデル',
        'models_loading': 'モデル読込中...',
        'models_unavailable': '利用可能なモデルがありません',
        'settings': '設定',
        'clear_chat': 'チャットをクリア',
        'welcome': 'ようこそ！',
        'welcome_message': 'AIアシスタントに何でも質問してください',
        'doc_intelligence': 'Document Intelligence',
        
        // RAG search
        'guideline_title': 'RAG検索アシスタント',
        'guideline_subtitle': 'ナレッジベースに基づく引用付き回答',
        'guideline_welcome': 'RAG検索アシスタント',
        'guideline_welcome_message': 'ナレッジベースを検索して、出典付きで回答します',
        
        // AI board meeting
        'idobata_title': 'AI役員会議',
        'idobata_planning_title': 'AI役員会議プランニング',
        'idobata_subtitle': 'CEO/CTO/CFO/COOが経営議題を議論して実行プランを策定',
        'idobata_welcome': 'AI役員会議モード',
        'idobata_welcome_message': '経営会議の論点をCxOで協議します',
        'tone_label': '話し方',
        'tone_formal': 'フォーマル（堅実・公式）',
        'tone_balanced': 'バランス（標準）',
        'tone_casual': 'カジュアル（親しみやすい）',
        'tone_concise': '簡潔（要点のみ）',
        'tone_detailed': '詳細（丁寧な説明）',
        'plan_title': '実行計画',
        'plan_goal': 'ゴール',
        'plan_steps': 'ステップ',
        'plan_tools': '利用手段',
        'plan_completion': '完了条件',
        'trace_title': '実行ログ',
        'trace_query': '検索語',
        'trace_status': '状態',
        'trace_results': '結果件数',
        'trace_duration': '所要時間',
        'trace_message': '補足',
        'trace_tool_search': '検索ツール',
        'trace_status_success': '成功',
        'trace_status_no_results': '結果なし',
        'trace_status_error': 'エラー',
        'evidence_title': '根拠',
        'evidence_source': '出典',
        'review_title': '品質評価',
        'review_score': '評価',
        'review_verdict': '総評',
        'review_strengths': '良い点',
        'review_risks': '懸念点',
        'review_missing_info': '不足情報',
        'review_next_step': '次に補うこと',
        'review_fallback': '簡易レビューです',
        'command_deck_kicker': 'Agent Framework Console',
        'command_deck_title': 'Aegis Mission Deck',
        'command_deck_subtitle': '複数 Agent との対話、探索、会議、非同期実行を一つのデッキで扱います。',
        'telemetry_title': 'Telemetry',
        'telemetry_agents_label': 'Agents',
        'telemetry_memory_label': 'Memory',
        'telemetry_memory_value': '永続化された会話スレッド',
        'telemetry_jobs_label': 'Async',
        'telemetry_jobs_value': 'Mission queue 有効',
        'mission_kicker': 'Async Operations',
        'mission_title': 'Mission Queue',
        'mission_empty': 'まだ非同期ジョブはありません。',
        'mission_detail_placeholder': 'ジョブを選択すると詳細が表示されます。',
        'mission_mode_label': 'モード',
        'mission_status_label': '状態',
        'mission_model_label': 'モデル',
        'mission_created_label': '作成時刻',
        'mission_score_label': '評価',
        'mission_prompt_label': '指令',
        'mission_output_label': '最新出力',
        'mission_error_label': 'エラー',
        'audit_summary_title': 'Ops Ledger',
        'audit_panel_title': '監査ログ',
        'audit_total_runs_label': 'Runs',
        'audit_total_tokens_label': 'Tokens',
        'audit_total_cost_label': 'Cost',
        'audit_duration_label': '処理時間',
        'audit_prompt_tokens_label': '入力トークン',
        'audit_completion_tokens_label': '出力トークン',
        'audit_token_source_label': '集計種別',
        'audit_token_source_actual': '実測',
        'audit_token_source_estimated': '推定',
        'audit_token_source_mixed': '混在',
        'audit_token_source_unknown': '不明',
        'audit_tools_label': '利用ツール',
        'audit_attachments_label': '添付数',
        'audit_history_label': '履歴メッセージ数',
        'audit_empty': '監査ログはまだありません。',
        'queue_job_button': 'Queue Mission',
        'job_status_queued': '待機中',
        'job_status_running': '実行中',
        'job_status_completed': '完了',
        'job_status_failed': '失敗',
        'job_stage_planning': '計画生成',
        'job_stage_executing': '本処理',
        'job_stage_reviewing': '品質評価',

        // Input area
        'input_placeholder': 'メッセージを入力... (Enterで送信、Shift+Enterで改行)',
        'input_placeholder_guideline': 'RAG検索したい質問を入力... (Enterで送信、Shift+Enterで改行)',
        'input_placeholder_idobata': 'AI役員会議の議題を入力... (Enterで送信、Shift+Enterで改行)',
        'send_button': '通常チャット',
        'auto_route_button': '自動振分け',
        'multi_agent_button': 'マルチエージェント分析',
        'guideline_button': 'RAG検索',
        'idobata_button': 'AI役員会議',
        'attach_button': '添付',
        'attachment_remove': '添付を削除',
        'attachment_chars': '{count} 文字',
        'attachment_kind_text': 'テキスト',
        'attachment_kind_pdf': 'PDF',
        'attachment_kind_image': '画像',
        'attachment_multimodal_ready': 'マルチモーダル可',
        'model_capability_multimodal': 'マルチモーダル',
        'model_capability_text_only': 'テキスト中心',

        // Status
        'status_thinking': 'AI が考え中...',
        'status_routing': '最適なAgentを選択中...',
        'status_multi_agent_analyzing': 'マルチエージェント分析中...',
        'status_searching': 'RAG検索中...',
        'status_discussing': 'AI役員会議で協議中...',
        'route_info_title': 'Auto Route',
        'route_reason_label': '判断理由',
        'route_confidence_label': '信頼度',
        'route_mode_general': '通常チャット',
        'route_mode_guideline': 'RAG検索',
        'route_mode_multi_agent': 'マルチエージェント分析',
        'route_mode_idobata': 'AI役員会議',

        // Dialog
        'confirm_clear_chat': 'チャット履歴をクリアしますか？',
        'approval_title': '承認が必要です',
        'approval_message': 'この操作を実行する前に内容を確認してください。',
        'approval_mode': '操作',
        'approval_model': 'モデル',
        'approval_reasons': '承認理由',
        'approval_button_reject': '却下',
        'approval_button_revise': '内容を修正',
        'approval_button_approve': '承認して実行',
        'approval_reason_multi_agent': '並列エージェント分析を開始します。',
        'approval_reason_idobata': '複数役員による会議ワークフローを開始します。',
        'approval_reason_model_default': '{model} は承認対象として設定されています。',

        // Common strings
        'error_prefix': '❌ エラー: ',
        
        // Sample prompts
        'sample_general_1': 'AI エージェントは業務生産性を劇的に向上させるか？',
        'sample_general_2': '企業の中長期経営戦略（成長計画・デジタル戦略・資本政策等）を分析して意見を述べよ。',
        'sample_general_3': 'このプロダクト設計は、社内ガイドラインやポリシーに反していないか？',
        
        'sample_guideline_1': '株式売買についてのインサイダー取引規制とは？',
        'sample_guideline_2': 'インサイダー取引規制の対象は株式のみですか。',
        'sample_guideline_3': '金融分野におけるサイバーセキュリティに関するガイドラインの項目について教えてください。',
        
        'sample_idobata_1': 'デジタル口座開設の離脱率が高い。改善の経営プランを作成して。',
        'sample_idobata_2': '中小企業向け融資の審査を自動化したい。段階的な導入計画を策定して。',
        'sample_idobata_3': 'デジタルチャネルの収益化を強化したい。KPIと投資計画を含むプランを作って。',
        
        // Agent names
        'agent_critical': '批判的思考',
        'agent_positive': '創造的思考',
        'agent_synthesizer': '統合分析',
        'agent_ceo': 'CEO',
        'agent_cto': 'CTO',
        'agent_cfo': 'CFO',
        'agent_coo': 'COO',
        'agent_general': 'アシスタント',
        
        // Messages
        'user': 'あなた',
        'thinking': '考え中',
        'copy': 'コピー',
        'copied': 'コピーしました！',
    },
    en: {
        // Header
        'app_title': 'Agent Streaming Chat',
        
        // Mode tabs
        'mode_general': 'General Chat',
        'mode_guideline': 'RAG Search',
        'mode_idobata': 'AI Board',
        
        // General chat
        'general_title': 'Multi-Agent Chat Assistant',
        'general_subtitle': 'Powered by Microsoft Agent Framework',
        'model_label': 'Model',
        'models_loading': 'Loading models...',
        'models_unavailable': 'No models available',
        'settings': 'Settings',
        'clear_chat': 'Clear Chat',
        'welcome': 'Welcome!',
        'welcome_message': 'Ask your AI assistant anything',
        'doc_intelligence': 'Document Intelligence',
        
        // RAG Search
        'guideline_title': 'RAG Search Assistant',
        'guideline_subtitle': 'Answers with citations from your knowledge base',
        'guideline_welcome': 'RAG Search Assistant',
        'guideline_welcome_message': 'Ask a question and get an answer grounded in your knowledge base',
        
        // AI Board Meeting
        'idobata_title': 'AI Board Meeting',
        'idobata_planning_title': 'AI Board Meeting Planning',
        'idobata_subtitle': 'CEO/CTO/CFO/COO discuss management agenda and develop execution plans',
        'idobata_welcome': 'AI Board Meeting Mode',
        'idobata_welcome_message': 'CxO executives discuss management issues',
        'tone_label': 'Tone',
        'tone_formal': 'Formal (Professional)',
        'tone_balanced': 'Balanced (Standard)',
        'tone_casual': 'Casual (Friendly)',
        'tone_concise': 'Concise (Key points)',
        'tone_detailed': 'Detailed (Thorough)',
        'plan_title': 'Execution Plan',
        'plan_goal': 'Goal',
        'plan_steps': 'Steps',
        'plan_tools': 'Tools',
        'plan_completion': 'Completion',
        'trace_title': 'Execution Trace',
        'trace_query': 'Query',
        'trace_status': 'Status',
        'trace_results': 'Results',
        'trace_duration': 'Duration',
        'trace_message': 'Note',
        'trace_tool_search': 'Search Tool',
        'trace_status_success': 'Success',
        'trace_status_no_results': 'No results',
        'trace_status_error': 'Error',
        'evidence_title': 'Evidence',
        'evidence_source': 'Source',
        'review_title': 'Quality Review',
        'review_score': 'Score',
        'review_verdict': 'Verdict',
        'review_strengths': 'Strengths',
        'review_risks': 'Risks',
        'review_missing_info': 'Missing info',
        'review_next_step': 'Next step',
        'review_fallback': 'Fallback review',
        'command_deck_kicker': 'Agent Framework Console',
        'command_deck_title': 'Aegis Mission Deck',
        'command_deck_subtitle': 'Run conversation, retrieval, board workflows, and async jobs from one sci-fi command deck.',
        'telemetry_title': 'Telemetry',
        'telemetry_agents_label': 'Agents',
        'telemetry_memory_label': 'Memory',
        'telemetry_memory_value': 'Persistent session threads',
        'telemetry_jobs_label': 'Async',
        'telemetry_jobs_value': 'Mission queue enabled',
        'mission_kicker': 'Async Operations',
        'mission_title': 'Mission Queue',
        'mission_empty': 'No async jobs yet.',
        'mission_detail_placeholder': 'Select a job to inspect its details.',
        'mission_mode_label': 'Mode',
        'mission_status_label': 'Status',
        'mission_model_label': 'Model',
        'mission_created_label': 'Created',
        'mission_score_label': 'Score',
        'mission_prompt_label': 'Mission brief',
        'mission_output_label': 'Latest output',
        'mission_error_label': 'Error',
        'audit_summary_title': 'Ops Ledger',
        'audit_panel_title': 'Audit Log',
        'audit_total_runs_label': 'Runs',
        'audit_total_tokens_label': 'Tokens',
        'audit_total_cost_label': 'Cost',
        'audit_duration_label': 'Duration',
        'audit_prompt_tokens_label': 'Input Tokens',
        'audit_completion_tokens_label': 'Output Tokens',
        'audit_token_source_label': 'Token Source',
        'audit_token_source_actual': 'Actual',
        'audit_token_source_estimated': 'Estimated',
        'audit_token_source_mixed': 'Mixed',
        'audit_token_source_unknown': 'Unknown',
        'audit_tools_label': 'Tools',
        'audit_attachments_label': 'Attachments',
        'audit_history_label': 'History Messages',
        'audit_empty': 'No audit logs yet.',
        'queue_job_button': 'Queue Mission',
        'job_status_queued': 'Queued',
        'job_status_running': 'Running',
        'job_status_completed': 'Completed',
        'job_status_failed': 'Failed',
        'job_stage_planning': 'Planning',
        'job_stage_executing': 'Executing',
        'job_stage_reviewing': 'Reviewing',

        // Input area
        'input_placeholder': 'Enter message... (Enter to send, Shift+Enter for new line)',
        'input_placeholder_guideline': 'Ask a question to search with RAG... (Enter to send, Shift+Enter for new line)',
        'input_placeholder_idobata': 'Enter board meeting agenda... (Enter to send, Shift+Enter for new line)',
        'send_button': 'General Chat',
        'auto_route_button': 'Auto Route',
        'multi_agent_button': 'Multi-Agent Analysis',
        'guideline_button': 'RAG Search',
        'idobata_button': 'AI Board Meeting',
        'attach_button': 'Attach',
        'attachment_remove': 'Remove attachment',
        'attachment_chars': '{count} chars',
        'attachment_kind_text': 'text',
        'attachment_kind_pdf': 'pdf',
        'attachment_kind_image': 'image',
        'attachment_multimodal_ready': 'multimodal ready',
        'model_capability_multimodal': 'multimodal',
        'model_capability_text_only': 'text-first',

        // Status
        'status_thinking': 'AI is thinking...',
        'status_routing': 'Selecting the best agent route...',
        'status_multi_agent_analyzing': 'Analyzing with multiple agents...',
        'status_searching': 'Searching knowledge base...',
        'status_discussing': 'AI Board is discussing...',
        'route_info_title': 'Auto Route',
        'route_reason_label': 'Why this route',
        'route_confidence_label': 'Confidence',
        'route_mode_general': 'General Chat',
        'route_mode_guideline': 'RAG Search',
        'route_mode_multi_agent': 'Multi-Agent Analysis',
        'route_mode_idobata': 'AI Board Meeting',

        // Dialog
        'confirm_clear_chat': 'Clear chat history?',
        'approval_title': 'Approval Required',
        'approval_message': 'Review this action before it is executed.',
        'approval_mode': 'Action',
        'approval_model': 'Model',
        'approval_reasons': 'Approval reasons',
        'approval_button_reject': 'Reject',
        'approval_button_revise': 'Revise',
        'approval_button_approve': 'Approve and Run',
        'approval_reason_multi_agent': 'This will start a parallel multi-agent analysis workflow.',
        'approval_reason_idobata': 'This will start a multi-role board discussion workflow.',
        'approval_reason_model_default': '{model} is configured as an approval-gated model.',

        // Common strings
        'error_prefix': '❌ Error: ',
        
        // Sample prompts
        'sample_general_1': 'Can AI agents dramatically improve business productivity?',
        'sample_general_2': 'Analyze and comment on the company\'s medium to long-term strategy (growth plan, digital strategy, capital policy, etc.).',
        'sample_general_3': 'Does this product design comply with internal guidelines and policies?',
        
        'sample_guideline_1': 'What are the insider trading regulations related to stock trading?',
        'sample_guideline_2': 'Do insider trading regulations apply only to stocks?',
        'sample_guideline_3': 'Please explain the guideline items related to cybersecurity in the financial sector.',
        
        'sample_idobata_1': 'The digital account opening drop-off rate is high. Create a management plan for improvement.',
        'sample_idobata_2': 'We want to automate loan screening for SMEs. Develop a phased implementation plan.',
        'sample_idobata_3': 'We want to strengthen digital channel monetization. Create a plan including KPIs and investment plans.',
        
        // Agent names
        'agent_critical': 'Critical Thinking',
        'agent_positive': 'Creative Thinking',
        'agent_synthesizer': 'Synthesis',
        'agent_ceo': 'CEO',
        'agent_cto': 'CTO',
        'agent_cfo': 'CFO',
        'agent_coo': 'COO',
        'agent_general': 'Assistant',
        
        // Messages
        'user': 'You',
        'thinking': 'Thinking',
        'copy': 'Copy',
        'copied': 'Copied!',
    }
};

// Current language (default: Japanese)
let currentLanguage = 'ja';

// Translation helper
function t(key) {
    return translations[currentLanguage][key] || key;
}

// Set current language
function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        updateUI();
        // Persist in localStorage
        localStorage.setItem('language', lang);
    }
}

// Update UI
function updateUI() {
    // Update all elements with the data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = translation;
        } else if (element.hasAttribute('title')) {
            element.title = translation;
        } else if (element.hasAttribute('aria-label')) {
            element.setAttribute('aria-label', translation);
        } else {
            element.textContent = translation;
        }
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLanguage;
    
    // Update active class on language toggle buttons
    document.querySelectorAll('.lang-button').forEach(button => {
        if (button.getAttribute('data-lang') === currentLanguage) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    if (typeof window.renderDynamicUi === 'function') {
        window.renderDynamicUi();
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load language from localStorage (fallback: server-provided lang or default)
    const savedLang = localStorage.getItem('language');
    if (savedLang && translations[savedLang]) {
        setLanguage(savedLang);
    } else {
        // Use language provided by server
        const serverLang = document.documentElement.getAttribute('data-lang') || 'ja';
        setLanguage(serverLang);
    }
});
