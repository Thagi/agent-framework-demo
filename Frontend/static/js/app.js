// Global state
let isBusy = false;
let isMultiAgent = false;
let messages = [];
let messagesGuideline = [];
let messagesIdobata = [];
let currentMode = 'general'; // 'general' or 'guideline' or 'idobata'
let availableModels = [];
let defaultModelId = null;
let attachments = [];
let attachmentsGuideline = [];
let attachmentsIdobata = [];
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
const attachButton = document.getElementById('attachButton');
const fileInput = document.getElementById('fileInput');
const attachmentList = document.getElementById('attachmentList');

// DOM elements - guideline chat
const chatMessagesGuideline = document.getElementById('chatMessagesGuideline');
const welcomeScreenGuideline = document.getElementById('welcomeScreenGuideline');
const promptInputGuideline = document.getElementById('promptInputGuideline');
const sendButtonGuideline = document.getElementById('sendButtonGuideline');
const clearButtonGuideline = document.getElementById('clearButtonGuideline');
const statusIndicatorGuideline = document.getElementById('statusIndicatorGuideline');
const statusTextGuideline = document.getElementById('statusTextGuideline');
const modelSelectGuideline = document.getElementById('modelSelectGuideline');
const attachButtonGuideline = document.getElementById('attachButtonGuideline');
const fileInputGuideline = document.getElementById('fileInputGuideline');
const attachmentListGuideline = document.getElementById('attachmentListGuideline');

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
const attachButtonIdobata = document.getElementById('attachButtonIdobata');
const fileInputIdobata = document.getElementById('fileInputIdobata');
const attachmentListIdobata = document.getElementById('attachmentListIdobata');

// Settings toggles (responsive only: CSS hides on desktop)
const settingsButtonGeneral = document.getElementById('settingsButtonGeneral');
const settingsButtonGuideline = document.getElementById('settingsButtonGuideline');
const settingsButtonIdobata = document.getElementById('settingsButtonIdobata');

// Input areas for responsive streaming UI
const inputAreaGeneral = document.querySelector('#generalChat .chat-input-area');
const inputAreaGuideline = document.querySelector('#guidelineChat .chat-input-area');
const inputAreaIdobata = document.querySelector('#idobataChat .chat-input-area');
const modelSelects = [modelSelect, modelSelectGuideline, modelSelectIdobata];
const approvalDialog = document.getElementById('approvalDialog');
const approvalModeValue = document.getElementById('approvalModeValue');
const approvalModelValue = document.getElementById('approvalModelValue');
const approvalReasons = document.getElementById('approvalReasons');
const approvalApproveButton = document.getElementById('approvalApproveButton');
const approvalRejectButton = document.getElementById('approvalRejectButton');
const approvalReviseButton = document.getElementById('approvalReviseButton');
let approvalResolver = null;

const attachmentContexts = {
    general: {
        mode: 'general',
        sessionId,
        input: fileInput,
        button: attachButton,
        list: attachmentList,
        get items() {
            return attachments;
        },
        set items(value) {
            attachments = value;
        }
    },
    guideline: {
        mode: 'guideline',
        sessionId: sessionIdGuideline,
        input: fileInputGuideline,
        button: attachButtonGuideline,
        list: attachmentListGuideline,
        get items() {
            return attachmentsGuideline;
        },
        set items(value) {
            attachmentsGuideline = value;
        }
    },
    idobata: {
        mode: 'idobata',
        sessionId: sessionIdIdobata,
        input: fileInputIdobata,
        button: attachButtonIdobata,
        list: attachmentListIdobata,
        get items() {
            return attachmentsIdobata;
        },
        set items(value) {
            attachmentsIdobata = value;
        }
    }
};

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

function tf(key, values = {}) {
    let template = t(key);
    Object.entries(values).forEach(([name, value]) => {
        template = template.replaceAll(`{${name}}`, String(value));
    });
    return template;
}

function findModelDefinition(modelId) {
    return availableModels.find(model => model.id === modelId) || null;
}

function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeAttachment(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const id = typeof item.id === 'string' ? item.id : '';
    const name = typeof item.name === 'string' ? item.name : '';
    if (!id || !name) {
        return null;
    }

    return {
        id,
        name,
        kind: typeof item.kind === 'string' ? item.kind : 'text',
        content_type: typeof item.content_type === 'string' ? item.content_type : '',
        size_bytes: Number.isFinite(item.size_bytes) ? item.size_bytes : 0,
        preview_text: typeof item.preview_text === 'string' ? item.preview_text : '',
        text_length: Number.isFinite(item.text_length) ? item.text_length : 0,
        supports_multimodal: !!item.supports_multimodal
    };
}

function renderAttachmentList(context) {
    if (!context.list) return;
    context.list.innerHTML = '';

    context.items.forEach(item => {
        const chip = document.createElement('div');
        chip.className = 'attachment-chip';

        const main = document.createElement('div');
        main.className = 'attachment-chip-main';

        const name = document.createElement('div');
        name.className = 'attachment-chip-name';
        name.textContent = item.name;

        const meta = document.createElement('div');
        meta.className = 'attachment-chip-meta';
        const metaParts = [formatBytes(item.size_bytes), t(`attachment_kind_${item.kind}`)];
        if (item.text_length > 0) {
            metaParts.push(tf('attachment_chars', { count: item.text_length }));
        } else if (item.supports_multimodal) {
            metaParts.push(t('attachment_multimodal_ready'));
        }
        meta.textContent = metaParts.join(' / ');

        main.appendChild(name);
        main.appendChild(meta);

        if (item.preview_text) {
            const preview = document.createElement('div');
            preview.className = 'attachment-chip-preview';
            preview.textContent = item.preview_text;
            main.appendChild(preview);
        }

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'attachment-chip-remove';
        remove.title = t('attachment_remove');
        remove.setAttribute('aria-label', t('attachment_remove'));
        remove.innerHTML = '<i class="fas fa-xmark"></i>';
        remove.addEventListener('click', () => removeAttachment(context.mode, item.id));

        chip.appendChild(main);
        chip.appendChild(remove);
        context.list.appendChild(chip);
    });
}

async function loadAttachments(mode) {
    const context = attachmentContexts[mode];
    if (!context) return;

    try {
        const response = await fetch(`/api/files?session_id=${encodeURIComponent(context.sessionId)}&mode=${encodeURIComponent(mode)}`);
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }
        context.items = Array.isArray(payload.files) ? payload.files.map(normalizeAttachment).filter(Boolean) : [];
    } catch (error) {
        console.error('Attachment load error:', error);
        context.items = [];
    }

    renderAttachmentList(context);
}

async function uploadSelectedFiles(mode) {
    const context = attachmentContexts[mode];
    if (!context || !context.input || !context.input.files || context.input.files.length === 0) {
        return;
    }

    const formData = new FormData();
    formData.append('session_id', context.sessionId);
    formData.append('mode', mode);
    Array.from(context.input.files).forEach(file => {
        formData.append('files', file);
    });

    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            body: formData
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        context.items = Array.isArray(payload.all_files) ? payload.all_files.map(normalizeAttachment).filter(Boolean) : context.items;
        renderAttachmentList(context);
    } catch (error) {
        alert(error.message);
    } finally {
        context.input.value = '';
    }
}

async function removeAttachment(mode, fileId) {
    const context = attachmentContexts[mode];
    if (!context || !fileId) return;

    try {
        const response = await fetch(
            `/api/files/${encodeURIComponent(fileId)}?session_id=${encodeURIComponent(context.sessionId)}&mode=${encodeURIComponent(mode)}`,
            { method: 'DELETE' }
        );
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        context.items = Array.isArray(payload.files) ? payload.files.map(normalizeAttachment).filter(Boolean) : [];
        renderAttachmentList(context);
    } catch (error) {
        alert(error.message);
    }
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
            option.dataset.multimodal = model.supports_multimodal ? 'true' : 'false';
            option.dataset.imageInput = model.supports_image_input ? 'true' : 'false';
            option.dataset.pdfInput = model.supports_pdf_input ? 'true' : 'false';
            if (model.provider_label || model.target) {
                const details = [
                    model.provider_label,
                    model.target,
                    model.supports_multimodal ? t('model_capability_multimodal') : t('model_capability_text_only')
                ].filter(Boolean).join(' / ');
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

function updateAttachmentButtons() {
    Object.values(attachmentContexts).forEach(context => {
        if (context.button) {
            context.button.disabled = !!isBusy;
        }
        if (context.input) {
            context.input.disabled = !!isBusy;
        }
    });
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

window.renderDynamicUi = () => {
    renderModelSelects();
    Object.values(attachmentContexts).forEach(renderAttachmentList);
};

function setStreamingUi(busy) {
    [inputAreaGeneral, inputAreaGuideline, inputAreaIdobata].forEach(area => {
        if (!area) return;
        area.classList.toggle('is-streaming', !!busy);
    });
    updateAttachmentButtons();
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

Object.values(attachmentContexts).forEach(context => {
    if (context.button && context.input) {
        context.button.addEventListener('click', () => context.input.click());
    }
    if (context.input) {
        context.input.addEventListener('change', () => uploadSelectedFiles(context.mode));
    }
});

if (approvalApproveButton) {
    approvalApproveButton.addEventListener('click', () => closeApprovalDialog('approve'));
}
if (approvalRejectButton) {
    approvalRejectButton.addEventListener('click', () => closeApprovalDialog('reject'));
}
if (approvalReviseButton) {
    approvalReviseButton.addEventListener('click', () => closeApprovalDialog('revise'));
}
if (approvalDialog) {
    approvalDialog.addEventListener('click', event => {
        if (event.target === approvalDialog) {
            closeApprovalDialog('reject');
        }
    });
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && approvalResolver) {
        closeApprovalDialog('reject');
    }
});

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
updateAttachmentButtons();

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

function closeApprovalDialog(decision) {
    if (approvalDialog) {
        approvalDialog.hidden = true;
    }

    const resolver = approvalResolver;
    approvalResolver = null;
    if (resolver) {
        resolver(decision);
    }
}

function getApprovalModeLabel(mode) {
    if (mode === 'multi_agent') return t('multi_agent_button');
    if (mode === 'guideline') return t('mode_guideline');
    if (mode === 'idobata') return t('idobata_title');
    return t('mode_general');
}

function buildApprovalRequest(mode, modelId) {
    const model = findModelDefinition(modelId);
    const reasons = [];

    if (mode === 'multi_agent') {
        reasons.push(t('approval_reason_multi_agent'));
    }
    if (mode === 'idobata') {
        reasons.push(t('approval_reason_idobata'));
    }
    if (model && model.approval_required) {
        reasons.push(model.approval_reason || tf('approval_reason_model_default', { model: model.label || model.id }));
    }

    return {
        modeLabel: getApprovalModeLabel(mode),
        modelLabel: (model && (model.label || model.id)) || modelId || '-',
        reasons
    };
}

function requestApproval(details) {
    if (!approvalDialog) {
        return Promise.resolve('approve');
    }

    approvalModeValue.textContent = details.modeLabel || '-';
    approvalModelValue.textContent = details.modelLabel || '-';
    approvalReasons.innerHTML = '';

    details.reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        approvalReasons.appendChild(li);
    });

    approvalDialog.hidden = false;

    return new Promise(resolve => {
        approvalResolver = resolve;
    });
}

async function ensureApprovalBeforeRun(mode, modelId, inputElement) {
    const approvalRequest = buildApprovalRequest(mode, modelId);
    if (!approvalRequest.reasons.length) {
        return true;
    }

    const decision = await requestApproval(approvalRequest);
    if (decision === 'approve') {
        return true;
    }

    if (decision === 'revise' && inputElement) {
        inputElement.focus();
        const contentLength = inputElement.value.length;
        inputElement.setSelectionRange(contentLength, contentLength);
    }

    return false;
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
        plan: message.plan || null,
        traces: Array.isArray(message.traces) ? message.traces : [],
        evidence: Array.isArray(message.evidence) ? message.evidence : [],
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

async function initializeAttachments() {
    await loadAttachments('general');
    await loadAttachments('guideline');
    await loadAttachments('idobata');
}

async function initializeApp() {
    await loadAvailableModels();
    await initializeHistories();
    await initializeAttachments();
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
        plan: null,
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
        plan: null,
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

function normalizePlanData(plan) {
    if (!plan || typeof plan !== 'object') {
        return null;
    }

    const normalizeItems = value => {
        if (!Array.isArray(value)) return [];
        return value
            .map(item => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean);
    };

    const normalized = {
        goal: typeof plan.goal === 'string' ? plan.goal.trim() : '',
        steps: normalizeItems(plan.steps),
        tools: normalizeItems(plan.tools),
        completion_criteria: normalizeItems(plan.completion_criteria)
    };

    if (!normalized.goal && normalized.steps.length === 0 && normalized.tools.length === 0 && normalized.completion_criteria.length === 0) {
        return null;
    }

    return normalized;
}

function createPlanSection(title) {
    const section = document.createElement('div');
    section.className = 'execution-plan-section';

    const heading = document.createElement('div');
    heading.className = 'execution-plan-section-title';
    heading.textContent = title;

    const body = document.createElement('div');
    body.className = 'execution-plan-section-body';

    section.appendChild(heading);
    section.appendChild(body);

    return { section, body };
}

function createExecutionPlanPanel() {
    const panel = document.createElement('div');
    panel.className = 'execution-plan-panel';
    panel.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'execution-plan-header';
    header.innerHTML = `
        <span class="execution-plan-icon">🧭</span>
        <span class="execution-plan-title">${t('plan_title')}</span>
    `;

    const goal = createPlanSection(t('plan_goal'));
    const steps = createPlanSection(t('plan_steps'));
    const tools = createPlanSection(t('plan_tools'));
    const completion = createPlanSection(t('plan_completion'));

    panel.appendChild(header);
    panel.appendChild(goal.section);
    panel.appendChild(steps.section);
    panel.appendChild(tools.section);
    panel.appendChild(completion.section);

    return {
        panel,
        goal: goal.body,
        steps: steps.body,
        tools: tools.body,
        completion: completion.body
    };
}

function renderPlanItems(container, items) {
    container.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
        return;
    }

    const list = document.createElement('ul');
    list.className = 'execution-plan-list';
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
    container.appendChild(list);
}

function applyExecutionPlan(planRefs, plan) {
    const normalized = normalizePlanData(plan);
    if (!planRefs || !planRefs.panel) return null;

    if (!normalized) {
        planRefs.panel.style.display = 'none';
        return null;
    }

    planRefs.goal.textContent = normalized.goal;
    renderPlanItems(planRefs.steps, normalized.steps);
    renderPlanItems(planRefs.tools, normalized.tools);
    renderPlanItems(planRefs.completion, normalized.completion_criteria);
    planRefs.panel.style.display = 'block';
    return normalized;
}

function updateMessagePlan(message, plan) {
    if (!message || message.is_user) return;
    const planRefs = message.element && message.element.plan ? message.element.plan : null;
    const normalized = applyExecutionPlan(planRefs, plan);
    if (normalized) {
        message.plan = normalized;
    }
}

function updateMultiAgentPlan(message, plan) {
    const planRefs = message.element && message.element.plan ? message.element.plan : null;
    const normalized = applyExecutionPlan(planRefs, plan);
    if (normalized) {
        message.plan = normalized;
    }
}

function normalizeTraceItems(traces) {
    if (!Array.isArray(traces)) {
        return [];
    }

    return traces
        .map(trace => {
            if (!trace || typeof trace !== 'object') {
                return null;
            }

            return {
                tool: typeof trace.tool === 'string' ? trace.tool.trim() : '',
                query: typeof trace.query === 'string' ? trace.query.trim() : '',
                status: typeof trace.status === 'string' ? trace.status.trim() : '',
                result_count: Number.isFinite(trace.result_count) ? trace.result_count : 0,
                duration_ms: Number.isFinite(trace.duration_ms) ? trace.duration_ms : null,
                message: typeof trace.message === 'string' ? trace.message.trim() : ''
            };
        })
        .filter(trace => trace && (trace.tool || trace.query || trace.message));
}

function normalizeEvidenceItems(evidence) {
    if (!Array.isArray(evidence)) {
        return [];
    }

    return evidence
        .map(item => {
            if (!item || typeof item !== 'object') {
                return null;
            }

            return {
                source: typeof item.source === 'string' ? item.source.trim() : '',
                excerpt: typeof item.excerpt === 'string' ? item.excerpt.trim() : ''
            };
        })
        .filter(item => item && item.source && item.excerpt);
}

function createDiagnosticsPanel() {
    const panel = document.createElement('div');
    panel.className = 'diagnostics-panel';
    panel.style.display = 'none';

    const traceSection = document.createElement('div');
    traceSection.className = 'diagnostics-section';

    const traceTitle = document.createElement('div');
    traceTitle.className = 'diagnostics-title';
    traceTitle.textContent = t('trace_title');

    const traceBody = document.createElement('div');
    traceBody.className = 'diagnostics-body';

    traceSection.appendChild(traceTitle);
    traceSection.appendChild(traceBody);

    const evidenceSection = document.createElement('div');
    evidenceSection.className = 'diagnostics-section';

    const evidenceTitle = document.createElement('div');
    evidenceTitle.className = 'diagnostics-title';
    evidenceTitle.textContent = t('evidence_title');

    const evidenceBody = document.createElement('div');
    evidenceBody.className = 'diagnostics-body';

    evidenceSection.appendChild(evidenceTitle);
    evidenceSection.appendChild(evidenceBody);

    panel.appendChild(traceSection);
    panel.appendChild(evidenceSection);

    return {
        panel,
        traceSection,
        traceBody,
        evidenceSection,
        evidenceBody
    };
}

function getTraceToolLabel(tool) {
    if (tool === 'search_tool') {
        return t('trace_tool_search');
    }
    return tool || '-';
}

function getTraceStatusLabel(status) {
    if (status === 'success') return t('trace_status_success');
    if (status === 'no_results') return t('trace_status_no_results');
    if (status === 'error') return t('trace_status_error');
    return status || '-';
}

function renderTraceItems(container, traces) {
    container.innerHTML = '';
    if (!traces.length) {
        return;
    }

    const list = document.createElement('ul');
    list.className = 'diagnostics-list';

    traces.forEach(trace => {
        const item = document.createElement('li');
        item.className = 'diagnostics-item';

        const heading = document.createElement('div');
        heading.className = 'diagnostics-item-heading';
        heading.textContent = getTraceToolLabel(trace.tool);

        const query = document.createElement('div');
        query.className = 'diagnostics-item-line';
        query.textContent = `${t('trace_query')}: ${trace.query || '-'}`;

        const metaParts = [
            `${t('trace_status')}: ${getTraceStatusLabel(trace.status)}`,
            `${t('trace_results')}: ${trace.result_count}`
        ];
        if (trace.duration_ms !== null) {
            metaParts.push(`${t('trace_duration')}: ${trace.duration_ms}ms`);
        }

        const meta = document.createElement('div');
        meta.className = 'diagnostics-item-line';
        meta.textContent = metaParts.join(' / ');

        item.appendChild(heading);
        item.appendChild(query);
        item.appendChild(meta);

        if (trace.message) {
            const note = document.createElement('div');
            note.className = 'diagnostics-item-line';
            note.textContent = `${t('trace_message')}: ${trace.message}`;
            item.appendChild(note);
        }

        list.appendChild(item);
    });

    container.appendChild(list);
}

function renderEvidenceItems(container, evidence) {
    container.innerHTML = '';
    if (!evidence.length) {
        return;
    }

    const list = document.createElement('ul');
    list.className = 'diagnostics-list';

    evidence.forEach(item => {
        const li = document.createElement('li');
        li.className = 'diagnostics-item';

        const source = document.createElement('div');
        source.className = 'diagnostics-item-heading';
        source.textContent = `${t('evidence_source')}: ${item.source}`;

        const excerpt = document.createElement('div');
        excerpt.className = 'diagnostics-item-line';
        excerpt.textContent = item.excerpt;

        li.appendChild(source);
        li.appendChild(excerpt);
        list.appendChild(li);
    });

    container.appendChild(list);
}

function applyGuidelineDiagnostics(refs, traces, evidence) {
    if (!refs || !refs.panel) {
        return { traces: [], evidence: [] };
    }

    const normalizedTraces = normalizeTraceItems(traces);
    const normalizedEvidence = normalizeEvidenceItems(evidence);

    renderTraceItems(refs.traceBody, normalizedTraces);
    renderEvidenceItems(refs.evidenceBody, normalizedEvidence);

    refs.traceSection.style.display = normalizedTraces.length ? 'block' : 'none';
    refs.evidenceSection.style.display = normalizedEvidence.length ? 'block' : 'none';
    refs.panel.style.display = normalizedTraces.length || normalizedEvidence.length ? 'block' : 'none';

    return { traces: normalizedTraces, evidence: normalizedEvidence };
}

function updateGuidelineDiagnostics(message, traces = message.traces, evidence = message.evidence) {
    if (!message || message.is_user) {
        return;
    }

    const diagnosticsRefs = message.element && message.element.diagnostics ? message.element.diagnostics : null;
    const normalized = applyGuidelineDiagnostics(diagnosticsRefs, traces, evidence);
    message.traces = normalized.traces;
    message.evidence = normalized.evidence;
}

function parseJsonLine(line) {
    if (!line || !line.trim()) {
        return null;
    }

    try {
        return JSON.parse(line);
    } catch (error) {
        console.error('JSON parse error:', error);
        return null;
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

    let planRefs = null;
    if (!message.is_user) {
        planRefs = createExecutionPlanPanel();
    }
    
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
    if (planRefs) {
        contentDiv.appendChild(planRefs.panel);
    }
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessages.appendChild(wrapper);
    
    message.element = message.is_user ? textDiv : { text: textDiv, plan: planRefs };
    if (!message.is_user && message.plan) {
        updateMessagePlan(message, message.plan);
    }
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

    const planRefs = createExecutionPlanPanel();
    
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
    container.appendChild(planRefs.panel);
    container.appendChild(grid);
    container.appendChild(synthesisPanel);
    wrapper.appendChild(container);
    chatMessages.appendChild(wrapper);
    
    message.element = {
        plan: planRefs,
        critical: criticalPanel.querySelector('[data-agent="critical"]'),
        positive: positivePanel.querySelector('[data-agent="positive"]'),
        synthesis: synthesisPanel.querySelector('[data-agent="synthesis"]'),
        synthesisPanel: synthesisPanel
    };
    if (message.plan) {
        updateMultiAgentPlan(message, message.plan);
    }
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
    let planRefs = null;

    if (!message.is_user) {
        planRefs = createExecutionPlanPanel();
    }

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
    if (planRefs) {
        contentDiv.appendChild(planRefs.panel);
    }
    contentDiv.appendChild(textDiv);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessagesIdobata.appendChild(wrapper);

    message.element = message.is_user ? textDiv : { text: textDiv, plan: planRefs };
    if (!message.is_user && message.plan) {
        updateMessagePlan(message, message.plan);
    }
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

    const planRefs = createExecutionPlanPanel();

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
    container.appendChild(planRefs.panel);
    container.appendChild(grid);
    wrapper.appendChild(container);
    chatMessagesIdobata.appendChild(wrapper);

    message.element = {
        plan: planRefs,
        planning: planningPanel.querySelector('[data-agent="planning"]'),
        tech: techPanel.querySelector('[data-agent="tech"]'),
        business: businessPanel.querySelector('[data-agent="business"]'),
        synthesis: synthesisPanel.querySelector('[data-agent="synthesis"]')
    };
    if (message.plan) {
        updateMultiAgentPlan(message, message.plan);
    }
}

function updateMessageContent(message, content) {
    if (message.is_multi_agent) {
        return;
    }
    
    message.content = content;
    const textElement = message.element && message.element.text ? message.element.text : message.element;
    if (textElement) {
        // User messages are plain text; AI messages are rendered as Markdown
        if (message.is_user) {
            textElement.textContent = content;
        } else {
            textElement.innerHTML = renderMarkdown(content);
        }

        // Remove existing typing indicator (dedupe / hide on completion)
        const existingIndicator = textElement.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (message.is_streaming) {
            const indicator = document.createElement('span');
            indicator.className = 'typing-indicator';
            indicator.textContent = '▊';
            textElement.appendChild(indicator);
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

    const selectedModel = modelSelect.value;
    const approved = await ensureApprovalBeforeRun(
        multiAgent ? 'multi_agent' : 'general',
        selectedModel,
        promptInput
    );
    if (!approved) return;
    
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
    let buffer = '';

    const handleLine = line => {
        const data = parseJsonLine(line);
        if (!data) return;

        if (data.type === 'plan' && data.plan) {
            updateMessagePlan(aiMessage, data.plan);
            scrollToBottom();
        } else if (data.type === 'delta' && data.content) {
            aiMessage.content += data.content;
            updateMessageContent(aiMessage, aiMessage.content);
            scrollToBottom();
        } else if (data.type === 'error' && data.message) {
            throw new Error(data.message);
        }
    };
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            handleLine(line);
        }
    }

    if (buffer.trim()) {
        handleLine(buffer);
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

    const handleLine = line => {
        const data = parseJsonLine(line);
        if (!data) return;

        if (data.type === 'plan' && data.plan) {
            updateMultiAgentPlan(aiMessage, data.plan);
            scrollToBottom();
        } else if (data.type === 'synthesis_start') {
            aiMessage.synthesis_streaming = true;
        } else if (data.agent && data.content) {
            updateMultiAgentContent(aiMessage, data.agent, data.content);
            scrollToBottom();
        } else if (data.type === 'error' && data.message) {
            throw new Error(data.message);
        }
    };
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
            handleLine(line);
        }
    }

    if (buffer.trim()) {
        handleLine(buffer);
    }
}

// AI board meeting chat
async function startIdobataChat() {
    const prompt = promptInputIdobata.value.trim();
    if (!prompt || isBusy) return;

    const selectedModel = modelSelectIdobata.value;
    const approved = await ensureApprovalBeforeRun('idobata', selectedModel, promptInputIdobata);
    if (!approved) return;

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

    const handleLine = line => {
        const data = parseJsonLine(line);
        if (!data) return;

        if (data.type === 'plan' && data.plan) {
            updateMultiAgentPlan(aiMessage, data.plan);
            scrollToBottomIdobata();
        } else if (data.agent && data.content) {
            updatePlanningContent(aiMessage, data.agent, data.content);
            scrollToBottomIdobata();
        } else if (data.type === 'error' && data.message) {
            throw new Error(data.message);
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            handleLine(line);
        }
    }

    if (buffer.trim()) {
        handleLine(buffer);
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
    attachments = [];
    renderAttachmentList(attachmentContexts.general);
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
    attachmentsIdobata = [];
    renderAttachmentList(attachmentContexts.idobata);
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
    attachmentsGuideline = [];
    renderAttachmentList(attachmentContexts.guideline);
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

    const selectedModel = modelSelectGuideline.value;
    const approved = await ensureApprovalBeforeRun('guideline', selectedModel, promptInputGuideline);
    if (!approved) return;
    
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
        plan: null,
        traces: [],
        evidence: [],
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
    let planRefs = null;
    let diagnosticsRefs = null;

    if (!message.is_user) {
        planRefs = createExecutionPlanPanel();
        diagnosticsRefs = createDiagnosticsPanel();
    }
    
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
    if (planRefs) {
        contentDiv.appendChild(planRefs.panel);
    }
    contentDiv.appendChild(textDiv);
    if (diagnosticsRefs) {
        contentDiv.appendChild(diagnosticsRefs.panel);
    }
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessagesGuideline.appendChild(wrapper);
    
    message.element = message.is_user ? textDiv : { text: textDiv, plan: planRefs, diagnostics: diagnosticsRefs };
    if (!message.is_user && message.plan) {
        updateMessagePlan(message, message.plan);
    }
    if (!message.is_user && (message.traces.length || message.evidence.length)) {
        updateGuidelineDiagnostics(message);
    }
}

function updateMessageContentGuideline(message, content) {
    message.content = content;
    const textElement = message.element && message.element.text ? message.element.text : message.element;
    if (textElement) {
        if (message.is_user) {
            textElement.textContent = content;
        } else {
            textElement.innerHTML = renderMarkdown(content);
        }

        // Remove existing typing indicator (dedupe / hide on completion)
        const existingIndicator = textElement.querySelector('.typing-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        if (message.is_streaming) {
            const indicator = document.createElement('span');
            indicator.className = 'typing-indicator';
            indicator.textContent = '▊';
            textElement.appendChild(indicator);
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
    let buffer = '';

    const handleLine = line => {
        const data = parseJsonLine(line);
        if (!data) return;

        if (data.type === 'plan' && data.plan) {
            updateMessagePlan(aiMessage, data.plan);
            scrollToBottomGuideline();
        } else if (data.type === 'delta' && data.content) {
            aiMessage.content += data.content;
            updateMessageContentGuideline(aiMessage, aiMessage.content);
            scrollToBottomGuideline();
        } else if (data.type === 'trace' && data.trace) {
            aiMessage.traces = [...(aiMessage.traces || []), data.trace];
            updateGuidelineDiagnostics(aiMessage);
            scrollToBottomGuideline();
        } else if (data.type === 'evidence' && data.evidence) {
            aiMessage.evidence = data.evidence;
            updateGuidelineDiagnostics(aiMessage);
            scrollToBottomGuideline();
        } else if (data.type === 'error' && data.message) {
            throw new Error(data.message);
        }
    };
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            handleLine(line);
        }
    }

    if (buffer.trim()) {
        handleLine(buffer);
    }
}

void initializeApp();
