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
        
        // Input area
        'input_placeholder': 'メッセージを入力... (Enterで送信、Shift+Enterで改行)',
        'input_placeholder_guideline': 'RAG検索したい質問を入力... (Enterで送信、Shift+Enterで改行)',
        'input_placeholder_idobata': 'AI役員会議の議題を入力... (Enterで送信、Shift+Enterで改行)',
        'send_button': '通常チャット',
        'multi_agent_button': 'マルチエージェント分析',
        'guideline_button': 'RAG検索',
        'idobata_button': 'AI役員会議',
        
        // Status
        'status_thinking': 'AI が考え中...',
        'status_multi_agent_analyzing': 'マルチエージェント分析中...',
        'status_searching': 'RAG検索中...',
        'status_discussing': 'AI役員会議で協議中...',

        // Dialog
        'confirm_clear_chat': 'チャット履歴をクリアしますか？',

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
        
        // Input area
        'input_placeholder': 'Enter message... (Enter to send, Shift+Enter for new line)',
        'input_placeholder_guideline': 'Ask a question to search with RAG... (Enter to send, Shift+Enter for new line)',
        'input_placeholder_idobata': 'Enter board meeting agenda... (Enter to send, Shift+Enter for new line)',
        'send_button': 'General Chat',
        'multi_agent_button': 'Multi-Agent Analysis',
        'guideline_button': 'RAG Search',
        'idobata_button': 'AI Board Meeting',
        
        // Status
        'status_thinking': 'AI is thinking...',
        'status_multi_agent_analyzing': 'Analyzing with multiple agents...',
        'status_searching': 'Searching knowledge base...',
        'status_discussing': 'AI Board is discussing...',

        // Dialog
        'confirm_clear_chat': 'Clear chat history?',

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
