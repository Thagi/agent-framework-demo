// Global state
let isBusy = false;
let isMultiAgent = false;
let messages = [];
let messagesGuideline = [];
let messagesIdobata = [];
let currentMode = 'general'; // 'general' or 'guideline' or 'idobata'
let availableModels = [];
let defaultModelId = null;
const sessionId = 'default';
const sessionIdGuideline = 'guideline';
const sessionIdIdobata = 'idobata';

// DOM elements - general chat
const chatMessages = document.getElementById('chatMessages');
const welcomeScreen = document.getElementById('welcomeScreen');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const multiAgentButton = document.getElementById('multiAgentButton');
const clearButton = document.getElementById('clearButton');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const modelSelect = document.getElementById('modelSelect');

// DOM elements - guideline chat
const chatMessagesGuideline = document.getElementById('chatMessagesGuideline');
const welcomeScreenGuideline = document.getElementById('welcomeScreenGuideline');
const promptInputGuideline = document.getElementById('promptInputGuideline');
const sendButtonGuideline = document.getElementById('sendButtonGuideline');
const clearButtonGuideline = document.getElementById('clearButtonGuideline');
const statusIndicatorGuideline = document.getElementById('statusIndicatorGuideline');
const statusTextGuideline = document.getElementById('statusTextGuideline');
const modelSelectGuideline = document.getElementById('modelSelectGuideline');

// DOM elements - AI board meeting
const chatMessagesIdobata = document.getElementById('chatMessagesIdobata');
const welcomeScreenIdobata = document.getElementById('welcomeScreenIdobata');
const promptInputIdobata = document.getElementById('promptInputIdobata');
const sendButtonIdobata = document.getElementById('sendButtonIdobata');
const clearButtonIdobata = document.getElementById('clearButtonIdobata');
const statusIndicatorIdobata = document.getElementById('statusIndicatorIdobata');
const statusTextIdobata = document.getElementById('statusTextIdobata');
const modelSelectIdobata = document.getElementById('modelSelectIdobata');
const toneSelectIdobata = document.getElementById('toneSelectIdobata');

// Settings toggles (responsive only: CSS hides on desktop)
const settingsButtonGeneral = document.getElementById('settingsButtonGeneral');
const settingsButtonGuideline = document.getElementById('settingsButtonGuideline');
const settingsButtonIdobata = document.getElementById('settingsButtonIdobata');

// Input areas for responsive streaming UI
const inputAreaGeneral = document.querySelector('#generalChat .chat-input-area');
const inputAreaGuideline = document.querySelector('#guidelineChat .chat-input-area');
const inputAreaIdobata = document.querySelector('#idobataChat .chat-input-area');
const modelSelects = [modelSelect, modelSelectGuideline, modelSelectIdobata];

function setModelSelectPlaceholder(label) {
    modelSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = label;
        option.selected = true;
        select.appendChild(option);
        select.disabled = true;
    });
}

function renderModelSelects() {
    if (!Array.isArray(availableModels) || availableModels.length === 0) {
        setModelSelectPlaceholder(t('models_unavailable'));
        updateButtons();
        updateButtonsGuideline();
        updateButtonsIdobata();
        return;
    }

    modelSelects.forEach(select => {
        if (!select) return;
        const previousValue = select.value;
        select.innerHTML = '';

        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.label || model.id;
            if (model.provider) {
                option.dataset.provider = model.provider;
            }
            if (model.target) {
                option.dataset.target = model.target;
            }
            if (model.provider_label || model.target) {
                const details = [model.provider_label, model.target].filter(Boolean).join(': ');
                option.title = details;
            }
            if (previousValue && previousValue === model.id) {
                option.selected = true;
            }
            select.appendChild(option);
        });

        select.disabled = false;
        const selectedValue = previousValue && availableModels.some(model => model.id === previousValue)
            ? previousValue
            : (defaultModelId || availableModels[0].id);
        select.value = selectedValue;
    });

    updateButtons();
    updateButtonsGuideline();
    updateButtonsIdobata();
}

async function loadAvailableModels() {
    setModelSelectPlaceholder(t('models_loading'));

    try {
        const response = await fetch('/api/models');
        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        availableModels = Array.isArray(payload.models) ? payload.models : [];
        defaultModelId = payload.default_model || (availableModels[0] && availableModels[0].id) || null;
    } catch (error) {
        console.error('Model load error:', error);
        availableModels = [];
        defaultModelId = null;
    }

    renderModelSelects();
}

window.renderDynamicUi = renderModelSelects;

function setStreamingUi(busy) {
    [inputAreaGeneral, inputAreaGuideline, inputAreaIdobata].forEach(area => {
        if (!area) return;
        area.classList.toggle('is-streaming', !!busy);
    });
}

function closeAllSettings() {
    ['generalChat', 'guidelineChat', 'idobataChat'].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        container.classList.remove('settings-open');
    });
}

function toggleSettings(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const willOpen = !container.classList.contains('settings-open');
    closeAllSettings();
    if (willOpen) {
        container.classList.add('settings-open');
    }
}

// Mode switching
function switchMode(mode) {
    currentMode = mode;
    const generalChat = document.getElementById('generalChat');
    const guidelineChat = document.getElementById('guidelineChat');
    const idobataChat = document.getElementById('idobataChat');
    const modeTabs = document.querySelectorAll('.mode-tab');
    const body = document.body;
    
    modeTabs.forEach(tab => {
        if (tab.dataset.mode === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    if (mode === 'general') {
        generalChat.style.display = 'flex';
        guidelineChat.style.display = 'none';
        idobataChat.style.display = 'none';
        body.classList.remove('guideline-mode');
    } else if (mode === 'guideline') {
        generalChat.style.display = 'none';
        guidelineChat.style.display = 'flex';
        idobataChat.style.display = 'none';
        body.classList.add('guideline-mode');
    } else {
        generalChat.style.display = 'none';
        guidelineChat.style.display = 'none';
        idobataChat.style.display = 'flex';
        body.classList.remove('guideline-mode');
    }

    // Close settings dropdown on mode switch
    closeAllSettings();
}

// Event listeners - general chat
promptInput.addEventListener('input', updateButtons);
promptInput.addEventListener('keydown', handleKeyDown);
sendButton.addEventListener('click', () => startChat(false));
multiAgentButton.addEventListener('click', () => startChat(true));
clearButton.addEventListener('click', clearChat);

// Event listeners - guideline chat
promptInputGuideline.addEventListener('input', updateButtonsGuideline);
promptInputGuideline.addEventListener('keydown', handleKeyDownGuideline);
sendButtonGuideline.addEventListener('click', startGuidelineChat);
clearButtonGuideline.addEventListener('click', clearGuidelineChat);

// Event listeners - AI board meeting
promptInputIdobata.addEventListener('input', updateButtonsIdobata);
promptInputIdobata.addEventListener('keydown', handleKeyDownIdobata);
sendButtonIdobata.addEventListener('click', startIdobataChat);
clearButtonIdobata.addEventListener('click', clearIdobataChat);

// Settings button listeners
if (settingsButtonGeneral) {
    settingsButtonGeneral.addEventListener('click', () => toggleSettings('generalChat'));
}
if (settingsButtonGuideline) {
    settingsButtonGuideline.addEventListener('click', () => toggleSettings('guidelineChat'));
}
if (settingsButtonIdobata) {
    settingsButtonIdobata.addEventListener('click', () => toggleSettings('idobataChat'));
}

// Initialization
updateButtons();
updateButtonsGuideline();
updateButtonsIdobata();

// Marked.js config
if (typeof marked !== 'undefined') {
    marked.setOptions({
        breaks: true,        // Convert newlines to <br>
        gfm: true,          // GitHub Flavored Markdown
        headerIds: false,    // Disable header IDs
        mangle: false        // Disable email address mangling
    });
}

// Render markdown (if available)
function renderMarkdown(content) {
    if (typeof marked === 'undefined') {
        return content; // Fallback to plain text when marked.js is not loaded
    }
    
    try {
        return marked.parse(content);
    } catch (error) {
        console.error('Markdown parsing error:', error);
        return content;
    }
}

function updateButtons() {
    const hasText = promptInput.value.trim().length > 0;
    const hasModel = modelSelect && !modelSelect.disabled && !!modelSelect.value;
    sendButton.disabled = isBusy || !hasText || !hasModel;
    multiAgentButton.disabled = isBusy || !hasText || !hasModel;
}

function updateButtonsGuideline() {
    const hasText = promptInputGuideline.value.trim().length > 0;
    const hasModel = modelSelectGuideline && !modelSelectGuideline.disabled && !!modelSelectGuideline.value;
    sendButtonGuideline.disabled = isBusy || !hasText || !hasModel;
}

function updateButtonsIdobata() {
    const hasText = promptInputIdobata.value.trim().length > 0;
    const hasModel = modelSelectIdobata && !modelSelectIdobata.disabled && !!modelSelectIdobata.value;
    sendButtonIdobata.disabled = isBusy || !hasText || !hasModel;
}

function handleKeyDown(event) {
    // Do not submit while IME composition is active
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !isBusy) {
        event.preventDefault();
        startChat(false);
    }
}

function handleKeyDownGuideline(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !isBusy) {
        event.preventDefault();
        startGuidelineChat();
    }
}

function handleKeyDownIdobata(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !isBusy) {
        event.preventDefault();
        startIdobataChat();
    }
}

function setPrompt(text) {
    promptInput.value = text;
    promptInput.focus();
    updateButtons();
}

function setPromptGuideline(text) {
    promptInputGuideline.value = text;
    promptInputGuideline.focus();
    updateButtonsGuideline();
}

function setPromptIdobata(text) {
    promptInputIdobata.value = text;
    promptInputIdobata.focus();
    updateButtonsIdobata();
}

function isPcFullWidth() {
    return window.innerWidth >= 1200;
}

function scrollToBottom() {
    if (isPcFullWidth()) return;
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function scrollToBottomIdobata() {
    // For AI board meeting, always suppress auto-scroll
    return;
}

function formatTime(date) {
    const value = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(value.getTime())) {
        return '--:--';
    }
    return value.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
}

function normalizeStoredMessage(message) {
    const normalized = {
        ...message,
        timestamp: message.timestamp ? new Date(message.timestamp) : new Date(),
        is_streaming: false,
        critical_streaming: false,
        positive_streaming: false,
        synthesis_streaming: false,
        element: null
    };

    if (normalized.is_multi_agent) {
        normalized.critical_content = normalized.critical_content || '';
        normalized.positive_content = normalized.positive_content || '';
        normalized.synthesis_content = normalized.synthesis_content || '';
    }

    if (normalized.is_planning) {
        normalized.planning_content = normalized.planning_content || '';
        normalized.tech_content = normalized.tech_content || '';
        normalized.business_content = normalized.business_content || '';
        normalized.synthesis_content = normalized.synthesis_content || '';
    }

    return normalized;
}

async function loadHistory(sessionKey, targetMessages, renderFn, showWelcomeFn, hideWelcomeFn) {
    try {
        const response = await fetch(`/api/messages?session_id=${encodeURIComponent(sessionKey)}`);
        if (!response.ok) {
            showWelcomeFn();
            return;
        }

        const storedMessages = await response.json();
        if (!Array.isArray(storedMessages) || storedMessages.length === 0) {
            showWelcomeFn();
            return;
        }

        targetMessages.length = 0;
        storedMessages.forEach(item => {
            const normalized = normalizeStoredMessage(item);
            targetMessages.push(normalized);
            renderFn(normalized);
        });
        hideWelcomeFn();
    } catch (error) {
        console.error('History load error:', error);
        showWelcomeFn();
    }
}

async function initializeHistories() {
    await loadHistory(sessionId, messages, renderMessage, showWelcomeScreen, hideWelcomeScreen);
    await loadHistory(sessionIdGuideline, messagesGuideline, renderMessageGuideline, showWelcomeScreenGuideline, hideWelcomeScreenGuideline);
    await loadHistory(sessionIdIdobata, messagesIdobata, renderMessageIdobata, showWelcomeScreenIdobata, hideWelcomeScreenIdobata);
}

async function initializeApp() {
    await loadAvailableModels();
    await initializeHistories();
}

function hideWelcomeScreen() {
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    clearButton.style.display = 'block';
}

function showWelcomeScreen() {
    if (messages.length === 0) {
        if (welcomeScreen) {
            welcomeScreen.style.display = 'flex';
        }
        clearButton.style.display = 'none';
    }
}

function showWelcomeScreenIdobata() {
    if (messagesIdobata.length === 0) {
        if (welcomeScreenIdobata) {
            welcomeScreenIdobata.style.display = 'flex';
        }
        clearButtonIdobata.style.display = 'none';
    }
}

function hideWelcomeScreenIdobata() {
    if (welcomeScreenIdobata) {
        welcomeScreenIdobata.style.display = 'none';
    }
    clearButtonIdobata.style.display = 'block';
}

function addUserMessage(content, isMultiAgentMode = false) {
    const timestamp = new Date();
    const prefix = isMultiAgentMode ? `🔀 [${t('multi_agent_button')}] ` : '';
    const message = {
        is_user: true,
        content: prefix + content,
        timestamp: timestamp
    };
    messages.push(message);
    renderMessage(message);
    hideWelcomeScreen();
    scrollToBottom();
}

function addUserMessageIdobata(content) {
    const timestamp = new Date();
    const message = {
        is_user: true,
        content: `🗣️ [${t('idobata_title')}] ${content}`,
        timestamp: timestamp
    };
    messagesIdobata.push(message);
    renderMessageIdobata(message);
    hideWelcomeScreenIdobata();
    scrollToBottomIdobata();
}

function addAiMessage(isMultiAgentMode = false) {
    const timestamp = new Date();
    const message = {
        is_user: false,
        content: '',
        timestamp: timestamp,
        is_streaming: true,
        is_multi_agent: isMultiAgentMode,
        critical_content: '',
        positive_content: '',
        synthesis_content: '',
        critical_streaming: isMultiAgentMode,
        positive_streaming: isMultiAgentMode,
        synthesis_streaming: false,
        element: null
    };
    messages.push(message);
    renderMessage(message);
    scrollToBottom();
    return message;
}

function addAiMessageIdobata() {
    const timestamp = new Date();
    const message = {
        is_user: false,
        is_planning: true,
        timestamp: timestamp,
        planning_content: '',
        tech_content: '',
        business_content: '',
        synthesis_content: '',
        element: null
    };
    messagesIdobata.push(message);
    renderMessageIdobata(message);
    scrollToBottomIdobata();
    return message;
}

function renderMessage(message) {
    if (message.is_multi_agent) {
        renderMultiAgentMessage(message);
    } else {
        renderNormalMessage(message);
    }
}

function renderMessageIdobata(message) {
    if (message.is_planning) {
        renderPlanningMessage(message);
    } else {
        renderNormalMessageIdobata(message);
    }
}

function renderNormalMessage(message) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${message.is_user ? 'user-wrapper' : 'ai-wrapper'}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.is_user ? 'user-message' : 'ai-message'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<span class="avatar-icon">${message.is_user ? '👤' : '🤖'}</span>`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
        <strong>${message.is_user ? t('user') : t('agent_general')}</strong>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    
    // User messages are plain text; AI messages are rendered as Markdown
    if (message.is_user) {
        textDiv.textContent = message.content;
    } else {
        textDiv.innerHTML = renderMarkdown(message.content);
    }
    
    if (message.is_streaming) {
        const indicator = document.createElement('span');
        indicator.className = 'typing-indicator';
        indicator.textContent = '▊';
        textDiv.appendChild(indicator);
    }
    
    contentDiv.appendChild(header);
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessages.appendChild(wrapper);
    
    message.element = textDiv;
}

function renderMultiAgentMessage(message) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai-wrapper';
    
    const container = document.createElement('div');
    container.className = 'multi-agent-container';
    
    const header = document.createElement('div');
    header.className = 'multi-agent-header';
    header.innerHTML = `
        <span class="multi-agent-icon">🔀</span>
        <strong>${t('multi_agent_button')}</strong>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;
    
    const grid = document.createElement('div');
    grid.className = 'agents-grid';
    
    // Critical panel
    const criticalPanel = document.createElement('div');
    criticalPanel.className = 'agent-panel critical-panel';
    criticalPanel.innerHTML = `
        <div class="agent-panel-header">
            <span class="agent-icon">🔍</span>
            <span class="agent-title">${t('agent_critical')}</span>
        </div>
        <div class="agent-content" data-agent="critical"></div>
    `;
    
    // Positive panel
    const positivePanel = document.createElement('div');
    positivePanel.className = 'agent-panel positive-panel';
    positivePanel.innerHTML = `
        <div class="agent-panel-header">
            <span class="agent-icon">✨</span>
            <span class="agent-title">${t('agent_positive')}</span>
        </div>
        <div class="agent-content" data-agent="positive"></div>
    `;
    
    grid.appendChild(criticalPanel);
    grid.appendChild(positivePanel);
    
    // Synthesis panel
    const synthesisPanel = document.createElement('div');
    synthesisPanel.className = 'synthesis-panel';
    synthesisPanel.style.display = 'none';
    synthesisPanel.innerHTML = `
        <div class="synthesis-header">
            <span class="synthesis-icon">🎯</span>
            <span class="synthesis-title">${t('agent_synthesizer')}</span>
        </div>
        <div class="synthesis-content" data-agent="synthesis"></div>
    `;
    
    container.appendChild(header);
    container.appendChild(grid);
    container.appendChild(synthesisPanel);
    wrapper.appendChild(container);
    chatMessages.appendChild(wrapper);
    
    message.element = {
        critical: criticalPanel.querySelector('[data-agent="critical"]'),
        positive: positivePanel.querySelector('[data-agent="positive"]'),
        synthesis: synthesisPanel.querySelector('[data-agent="synthesis"]'),
        synthesisPanel: synthesisPanel
    };
}

function renderNormalMessageIdobata(message) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${message.is_user ? 'user-wrapper' : 'ai-wrapper'}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.is_user ? 'user-message' : 'ai-message'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<span class="avatar-icon">${message.is_user ? '👤' : '🗣️'}</span>`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
        <strong>${message.is_user ? t('user') : t('idobata_title')}</strong>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    if (message.is_user) {
        textDiv.textContent = message.content;
    } else {
        textDiv.innerHTML = renderMarkdown(message.content);
    }

    if (message.is_streaming) {
        const indicator = document.createElement('span');
        indicator.className = 'typing-indicator';
        indicator.textContent = '▊';
        textDiv.appendChild(indicator);
    }

    contentDiv.appendChild(header);
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessagesIdobata.appendChild(wrapper);

    message.element = textDiv;
}

function renderPlanningMessage(message) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai-wrapper';

    const container = document.createElement('div');
    container.className = 'multi-agent-container';

    const header = document.createElement('div');
    header.className = 'multi-agent-header';
    header.innerHTML = `
        <span class="multi-agent-icon">🗣️</span>
        <strong>${t('idobata_planning_title')}</strong>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;

    const grid = document.createElement('div');
    grid.className = 'agents-grid planning-grid';

    const planningPanel = document.createElement('div');
    planningPanel.className = 'agent-panel planning-panel';
    planningPanel.innerHTML = `
        <div class="agent-panel-header">
            <span class="agent-icon">🧭</span>
            <span class="agent-title">${t('agent_ceo')}</span>
        </div>
        <div class="agent-content" data-agent="planning"></div>
    `;

    const techPanel = document.createElement('div');
    techPanel.className = 'agent-panel tech-panel';
    techPanel.innerHTML = `
        <div class="agent-panel-header">
            <span class="agent-icon">🧪</span>
            <span class="agent-title">${t('agent_cto')}</span>
        </div>
        <div class="agent-content" data-agent="tech"></div>
    `;

    const businessPanel = document.createElement('div');
    businessPanel.className = 'agent-panel business-panel';
    businessPanel.innerHTML = `
        <div class="agent-panel-header">
            <span class="agent-icon">📈</span>
            <span class="agent-title">${t('agent_cfo')}</span>
        </div>
        <div class="agent-content" data-agent="business"></div>
    `;

    const synthesisPanel = document.createElement('div');
    synthesisPanel.className = 'agent-panel synthesis-panel';
    synthesisPanel.innerHTML = `
        <div class="agent-panel-header">
            <span class="agent-icon">🧩</span>
            <span class="agent-title">${t('agent_coo')}</span>
        </div>
        <div class="agent-content" data-agent="synthesis"></div>
    `;

    grid.appendChild(planningPanel);
    grid.appendChild(techPanel);
    grid.appendChild(businessPanel);
    grid.appendChild(synthesisPanel);

    container.appendChild(header);
    container.appendChild(grid);
    wrapper.appendChild(container);
    chatMessagesIdobata.appendChild(wrapper);

    message.element = {
        planning: planningPanel.querySelector('[data-agent="planning"]'),
        tech: techPanel.querySelector('[data-agent="tech"]'),
        business: businessPanel.querySelector('[data-agent="business"]'),
        synthesis: synthesisPanel.querySelector('[data-agent="synthesis"]')
    };
}

function updateMessageContent(message, content) {
    if (message.is_multi_agent) {
        return;
    }
    
    message.content = content;
    if (message.element) {
        // User messages are plain text; AI messages are rendered as Markdown
        if (message.is_user) {
            message.element.textContent = content;
        } else {
            message.element.innerHTML = renderMarkdown(content);
        }

        // Remove existing typing indicator (dedupe / hide on completion)
        const existingIndicator = message.element.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (message.is_streaming) {
            const indicator = document.createElement('span');
            indicator.className = 'typing-indicator';
            indicator.textContent = '▊';
            message.element.appendChild(indicator);
        }
    }
}

function updateMultiAgentContent(message, agent, content) {
    if (!message.element) return;
    
    // Collapse excessive blank lines
    const normalizedContent = content.replace(/\n{3,}/g, '\n\n');
    
    if (agent === 'CriticalAnalyst') {
        message.critical_content += content;
        const normalized = message.critical_content.replace(/\n{3,}/g, '\n\n');
        message.element.critical.innerHTML = renderMarkdown(normalized);
    } else if (agent === 'PositiveAdvocate') {
        message.positive_content += content;
        const normalized = message.positive_content.replace(/\n{3,}/g, '\n\n');
        message.element.positive.innerHTML = renderMarkdown(normalized);
    } else if (agent === 'Synthesizer') {
        message.synthesis_content += content;
        const normalized = message.synthesis_content.replace(/\n{3,}/g, '\n\n');
        message.element.synthesis.innerHTML = renderMarkdown(normalized);
        message.element.synthesisPanel.style.display = 'block';
    }
}

function updatePlanningContent(message, agent, content) {
    if (!message.element) return;

    if (agent === 'CEO') {
        message.planning_content += content;
        const normalized = message.planning_content.replace(/\n{2,}/g, '\n');
        message.element.planning.innerHTML = renderMarkdown(normalized);
    } else if (agent === 'CTO') {
        message.tech_content += content;
        const normalized = message.tech_content.replace(/\n{2,}/g, '\n');
        message.element.tech.innerHTML = renderMarkdown(normalized);
    } else if (agent === 'CFO') {
        message.business_content += content;
        const normalized = message.business_content.replace(/\n{2,}/g, '\n');
        message.element.business.innerHTML = renderMarkdown(normalized);
    } else if (agent === 'COO') {
        message.synthesis_content += content;
        const normalized = message.synthesis_content.replace(/\n{2,}/g, '\n');
        message.element.synthesis.innerHTML = renderMarkdown(normalized);
    }
}

function setStatus(busy, multiAgent = false) {
    isBusy = busy;
    isMultiAgent = multiAgent;
    
    setStreamingUi(busy);
    
    promptInput.disabled = busy;
    updateButtons();
    updateButtonsGuideline();
    updateButtonsIdobata();
    
    if (busy) {
        statusIndicator.style.display = 'flex';
        statusText.textContent = multiAgent ? t('status_multi_agent_analyzing') : t('status_thinking');
        
        // Swap button icon while streaming
        if (multiAgent) {
            multiAgentButton.innerHTML = '<span class="spinner-icon">⟳</span>';
        } else {
            sendButton.innerHTML = '<span class="spinner-icon">⟳</span>';
        }
    } else {
        statusIndicator.style.display = 'none';
        sendButton.innerHTML = '<i class="fa-regular fa-paper-plane"></i>';
        multiAgentButton.innerHTML = '<i class="fas fa-users"></i>';
    }
}

async function startChat(multiAgent = false) {
    const prompt = promptInput.value.trim();
    if (!prompt || isBusy) return;
    
    promptInput.value = '';
    updateButtons();
    
    addUserMessage(prompt, multiAgent);
    const aiMessage = addAiMessage(multiAgent);
    
    setStatus(true, multiAgent);
    
    try {
        if (multiAgent) {
            await streamMultiAgentChat(prompt, aiMessage);
        } else {
            await streamNormalChat(prompt, aiMessage);
        }
    } catch (error) {
        const errorMsg = `\n\n${t('error_prefix')}${error.message}`;
        if (multiAgent) {
            aiMessage.synthesis_content = errorMsg;
            updateMultiAgentContent(aiMessage, 'Synthesizer', errorMsg);
        } else {
            updateMessageContent(aiMessage, aiMessage.content + errorMsg);
        }
    } finally {
        aiMessage.is_streaming = false;
        aiMessage.critical_streaming = false;
        aiMessage.positive_streaming = false;
        aiMessage.synthesis_streaming = false;

        // Re-render on completion to remove typing indicator
        if (!aiMessage.is_multi_agent) {
            updateMessageContent(aiMessage, aiMessage.content);
        }
        setStatus(false);
    }
}

async function streamNormalChat(prompt, aiMessage) {
    const selectedModel = modelSelect.value;
    const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, session_id: sessionId, model: selectedModel })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        aiMessage.content += chunk;
        updateMessageContent(aiMessage, aiMessage.content);
        scrollToBottom();
    }
}

async function streamMultiAgentChat(prompt, aiMessage) {
    const selectedModel = modelSelect.value;
    const response = await fetch('/api/chat/multi-agent-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, session_id: sessionId, model: selectedModel })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            if (line.trim()) {
                try {
                    const data = JSON.parse(line);
                    
                    if (data.type === 'synthesis_start') {
                        aiMessage.synthesis_streaming = true;
                    } else if (data.agent && data.content) {
                        updateMultiAgentContent(aiMessage, data.agent, data.content);
                        scrollToBottom();
                    }
                } catch (e) {
                    console.error('JSON parse error:', e);
                }
            }
        }
    }
}

// AI board meeting chat
async function startIdobataChat() {
    const prompt = promptInputIdobata.value.trim();
    if (!prompt || isBusy) return;

    promptInputIdobata.value = '';
    updateButtonsIdobata();

    addUserMessageIdobata(prompt);
    const aiMessage = addAiMessageIdobata();

    setStatusIdobata(true);

    try {
        await streamIdobataChat(prompt, aiMessage);
    } catch (error) {
        const errorMsg = `\n\n${t('error_prefix')}${error.message}`;
        aiMessage.synthesis_content += errorMsg;
        updatePlanningContent(aiMessage, 'SynthesisAgent', errorMsg);
    } finally {
        setStatusIdobata(false);
    }
}

async function streamIdobataChat(prompt, aiMessage) {
    const selectedModel = modelSelectIdobata.value;
    const selectedTone = toneSelectIdobata.value;
    const response = await fetch('/api/chat/idobata-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, session_id: sessionIdIdobata, model: selectedModel, tone: selectedTone })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const data = JSON.parse(line);
                    if (data.agent && data.content) {
                        updatePlanningContent(aiMessage, data.agent, data.content);
                        scrollToBottomIdobata();
                    }
                } catch (e) {
                    console.error('JSON parse error:', e);
                }
            }
        }
    }
}

function clearChat() {
    if (!confirm(t('confirm_clear_chat'))) return;
    
    fetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, mode: 'general' })
    });
    
    messages = [];
    // Keep welcome screen; remove other elements to reset UI
    Array.from(chatMessages.children).forEach(child => {
        if (welcomeScreen && child !== welcomeScreen) {
            child.remove();
        }
    });
    showWelcomeScreen();
}

function clearIdobataChat() {
    if (!confirm(t('confirm_clear_chat'))) return;

    fetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionIdIdobata, mode: 'idobata' })
    });

    messagesIdobata = [];
    Array.from(chatMessagesIdobata.children).forEach(child => {
        if (welcomeScreenIdobata && child !== welcomeScreenIdobata) {
            child.remove();
        }
    });
    showWelcomeScreenIdobata();
}

function clearGuidelineChat() {
    if (!confirm(t('confirm_clear_chat'))) return;

    fetch('/api/messages/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionIdGuideline, mode: 'guideline' })
    });

    messagesGuideline = [];
    // Keep guideline welcome screen; remove other elements to reset UI
    Array.from(chatMessagesGuideline.children).forEach(child => {
        if (welcomeScreenGuideline && child !== welcomeScreenGuideline) {
            child.remove();
        }
    });
    showWelcomeScreenGuideline();
}

function showWelcomeScreenGuideline() {
    if (messagesGuideline.length === 0) {
        if (welcomeScreenGuideline) {
            welcomeScreenGuideline.style.display = 'flex';
        }
        clearButtonGuideline.style.display = 'none';
    }
}

function hideWelcomeScreenGuideline() {
    if (welcomeScreenGuideline) {
        welcomeScreenGuideline.style.display = 'none';
    }
    clearButtonGuideline.style.display = 'block';
}

// Guideline chat
async function startGuidelineChat() {
    const prompt = promptInputGuideline.value.trim();
    if (!prompt || isBusy) return;
    
    promptInputGuideline.value = '';
    updateButtonsGuideline();
    
    addUserMessageGuideline(prompt);
    const aiMessage = addAiMessageGuideline();
    
    setStatusGuideline(true);
    
    try {
        await streamGuidelineChat(prompt, aiMessage);
    } catch (error) {
        const errorMsg = `\n\n${t('error_prefix')}${error.message}`;
        updateMessageContentGuideline(aiMessage, aiMessage.content + errorMsg);
    } finally {
        aiMessage.is_streaming = false;

        // Re-render on completion to remove typing indicator
        updateMessageContentGuideline(aiMessage, aiMessage.content);
        setStatusGuideline(false);
    }
}

function addUserMessageGuideline(content) {
    const timestamp = new Date();
    const message = {
        is_user: true,
        content: content,
        timestamp: timestamp
    };
    messagesGuideline.push(message);
    renderMessageGuideline(message);
    hideWelcomeScreenGuideline();
    scrollToBottomGuideline();
}

function addAiMessageGuideline() {
    const timestamp = new Date();
    const message = {
        is_user: false,
        content: '',
        timestamp: timestamp,
        is_streaming: true,
        element: null
    };
    messagesGuideline.push(message);
    renderMessageGuideline(message);
    scrollToBottomGuideline();
    return message;
}

function renderMessageGuideline(message) {
    const wrapper = document.createElement('div');
    wrapper.className = `message-wrapper ${message.is_user ? 'user-wrapper' : 'ai-wrapper'}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.is_user ? 'user-message' : 'ai-message'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<span class="avatar-icon">${message.is_user ? '👤' : '📊'}</span>`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
        <strong>${message.is_user ? t('user') : t('guideline_title')}</strong>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    
    if (message.is_user) {
        textDiv.textContent = message.content;
    } else {
        textDiv.innerHTML = renderMarkdown(message.content);
    }
    
    if (message.is_streaming) {
        const indicator = document.createElement('span');
        indicator.className = 'typing-indicator';
        indicator.textContent = '▊';
        textDiv.appendChild(indicator);
    }
    
    contentDiv.appendChild(header);
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessagesGuideline.appendChild(wrapper);
    
    message.element = textDiv;
}

function updateMessageContentGuideline(message, content) {
    message.content = content;
    if (message.element) {
        if (message.is_user) {
            message.element.textContent = content;
        } else {
            message.element.innerHTML = renderMarkdown(content);
        }

        // Remove existing typing indicator (dedupe / hide on completion)
        const existingIndicator = message.element.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (message.is_streaming) {
            const indicator = document.createElement('span');
            indicator.className = 'typing-indicator';
            indicator.textContent = '▊';
            message.element.appendChild(indicator);
        }
    }
}

function scrollToBottomGuideline() {
    if (isPcFullWidth()) return;
    chatMessagesGuideline.scrollTop = chatMessagesGuideline.scrollHeight;
}

function setStatusGuideline(busy) {
    isBusy = busy;
    
    setStreamingUi(busy);
    
    promptInputGuideline.disabled = busy;
    updateButtonsGuideline();
    updateButtons();
    updateButtonsIdobata();
    
    if (busy) {
        statusIndicatorGuideline.style.display = 'flex';
        statusTextGuideline.textContent = t('status_searching');
        sendButtonGuideline.innerHTML = '<span class="spinner-icon">⟳</span>';
    } else {
        statusIndicatorGuideline.style.display = 'none';
        sendButtonGuideline.innerHTML = '<i class="fa-regular fa-paper-plane"></i>';
    }
}

function setStatusIdobata(busy) {
    isBusy = busy;

    setStreamingUi(busy);

    promptInputIdobata.disabled = busy;
    updateButtonsIdobata();
    updateButtons();
    updateButtonsGuideline();

    if (busy) {
        statusIndicatorIdobata.style.display = 'flex';
        statusTextIdobata.textContent = t('status_discussing');
        sendButtonIdobata.innerHTML = '<span class="spinner-icon">⟳</span>';
    } else {
        statusIndicatorIdobata.style.display = 'none';
        sendButtonIdobata.innerHTML = '<i class="fas fa-users"></i>';
    }
}

async function streamGuidelineChat(prompt, aiMessage) {
    const selectedModel = modelSelectGuideline.value;
    const response = await fetch('/api/rag/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, session_id: sessionIdGuideline, model: selectedModel })
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        aiMessage.content += chunk;
        updateMessageContentGuideline(aiMessage, aiMessage.content);
        scrollToBottomGuideline();
    }
}

void initializeApp();
