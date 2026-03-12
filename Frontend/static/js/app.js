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
let missionJobs = [];
let selectedJobId = null;
let auditSummary = null;
let auditEvents = [];
let accessBootstrap = { default_user_id: null, users: [], workspaces: [] };
let currentUserId = null;
let currentWorkspaceId = null;
const RAW_SESSION_IDS = Object.freeze({
    general: 'default',
    guideline: 'guideline',
    idobata: 'idobata'
});
const sessionId = RAW_SESSION_IDS.general;
const sessionIdGuideline = RAW_SESSION_IDS.guideline;
const sessionIdIdobata = RAW_SESSION_IDS.idobata;
const JOB_POLL_INTERVAL_MS = 5000;
const AUDIT_POLL_INTERVAL_MS = 10000;
const ACCESS_STORAGE_KEY = 'aegis-access-context';

// DOM elements - general chat
const chatMessages = document.getElementById('chatMessages');
const welcomeScreen = document.getElementById('welcomeScreen');
const promptInput = document.getElementById('promptInput');
const sendButton = document.getElementById('sendButton');
const queueJobButton = document.getElementById('queueJobButton');
const autoRouteButton = document.getElementById('autoRouteButton');
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
const queueJobButtonGuideline = document.getElementById('queueJobButtonGuideline');
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
const queueJobButtonIdobata = document.getElementById('queueJobButtonIdobata');
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
const missionList = document.getElementById('missionList');
const missionEmpty = document.getElementById('missionEmpty');
const missionDetail = document.getElementById('missionDetail');
const refreshJobsButton = document.getElementById('refreshJobsButton');
const auditTotalRunsValue = document.getElementById('auditTotalRunsValue');
const auditTotalTokensValue = document.getElementById('auditTotalTokensValue');
const auditTotalCostValue = document.getElementById('auditTotalCostValue');
const auditEventList = document.getElementById('auditEventList');
const auditEventEmpty = document.getElementById('auditEventEmpty');
const accessUserSelect = document.getElementById('accessUserSelect');
const accessWorkspaceSelect = document.getElementById('accessWorkspaceSelect');
const accessRoleValue = document.getElementById('accessRoleValue');
const accessVisibilityValue = document.getElementById('accessVisibilityValue');
const accessWorkspaceDescription = document.getElementById('accessWorkspaceDescription');
const accessMembersValue = document.getElementById('accessMembersValue');
let approvalResolver = null;

const attachmentContexts = {
    general: {
        mode: 'general',
        get sessionId() {
            return getRawSessionId(this.mode);
        },
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
        get sessionId() {
            return getRawSessionId(this.mode);
        },
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
        get sessionId() {
            return getRawSessionId(this.mode);
        },
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

function getRawSessionId(mode) {
    return RAW_SESSION_IDS[mode] || RAW_SESSION_IDS.general;
}

function getAccessPayload() {
    return {
        user_id: currentUserId,
        workspace_id: currentWorkspaceId
    };
}

function buildScopedSessionId(rawSessionId) {
    const userPart = currentUserId || 'default-user';
    const workspacePart = currentWorkspaceId || 'default-space';
    return `workspace:${workspacePart}::user:${userPart}::session:${rawSessionId || 'default'}`;
}

function buildAccessQuery(params = {}) {
    const search = new URLSearchParams();
    Object.entries({ ...params, ...getAccessPayload() }).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            search.set(key, String(value));
        }
    });
    return search.toString();
}

function getAccessStorageSnapshot() {
    return {
        user_id: currentUserId,
        workspace_id: currentWorkspaceId
    };
}

function persistAccessSelection() {
    try {
        window.localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(getAccessStorageSnapshot()));
    } catch (error) {
        console.warn('Access selection persist failed:', error);
    }
}

function readStoredAccessSelection() {
    try {
        const raw = window.localStorage.getItem(ACCESS_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        console.warn('Access selection restore failed:', error);
        return {};
    }
}

function getUserDefinition(userId) {
    return (accessBootstrap.users || []).find(user => user.id === userId) || null;
}

function getWorkspaceDefinition(workspaceId) {
    return (accessBootstrap.workspaces || []).find(workspace => workspace.id === workspaceId) || null;
}

function getWorkspacesForUser(userId) {
    return (accessBootstrap.workspaces || []).filter(workspace => Array.isArray(workspace.member_ids) && workspace.member_ids.includes(userId));
}

function normalizeAccessSelection(userId, workspaceId) {
    const users = Array.isArray(accessBootstrap.users) ? accessBootstrap.users : [];
    const fallbackUserId = accessBootstrap.default_user_id || (users[0] && users[0].id) || null;
    const resolvedUserId = users.some(user => user.id === userId) ? userId : fallbackUserId;
    const userDefinition = getUserDefinition(resolvedUserId);
    const availableWorkspaces = getWorkspacesForUser(resolvedUserId);
    const defaultWorkspaceId = userDefinition && userDefinition.default_workspace_id;
    const fallbackWorkspaceId = (defaultWorkspaceId && availableWorkspaces.some(item => item.id === defaultWorkspaceId))
        ? defaultWorkspaceId
        : (availableWorkspaces[0] && availableWorkspaces[0].id) || null;
    const resolvedWorkspaceId = availableWorkspaces.some(workspace => workspace.id === workspaceId)
        ? workspaceId
        : fallbackWorkspaceId;
    return {
        userId: resolvedUserId,
        workspaceId: resolvedWorkspaceId
    };
}

function renderAccessControls() {
    if (!accessUserSelect || !accessWorkspaceSelect) {
        return;
    }

    accessUserSelect.innerHTML = '';
    (accessBootstrap.users || []).forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.role ? `${user.name} / ${user.role}` : user.name;
        if (user.id === currentUserId) {
            option.selected = true;
        }
        accessUserSelect.appendChild(option);
    });

    accessWorkspaceSelect.innerHTML = '';
    getWorkspacesForUser(currentUserId).forEach(workspace => {
        const option = document.createElement('option');
        option.value = workspace.id;
        option.textContent = workspace.name;
        if (workspace.id === currentWorkspaceId) {
            option.selected = true;
        }
        accessWorkspaceSelect.appendChild(option);
    });

    const user = getUserDefinition(currentUserId);
    const workspace = getWorkspaceDefinition(currentWorkspaceId);
    if (accessRoleValue) {
        accessRoleValue.textContent = user && user.role ? user.role : '-';
    }
    if (accessVisibilityValue) {
        accessVisibilityValue.textContent = workspace ? t(`access_visibility_${workspace.visibility}`) : '-';
    }
    if (accessWorkspaceDescription) {
        accessWorkspaceDescription.textContent = workspace && workspace.description ? workspace.description : t('access_loading');
    }
    if (accessMembersValue) {
        const memberNames = workspace
            ? (workspace.member_ids || [])
                .map(memberId => getUserDefinition(memberId))
                .filter(Boolean)
                .map(member => member.name)
            : [];
        accessMembersValue.textContent = memberNames.length
            ? `${t('access_members_prefix')}: ${memberNames.join(', ')}`
            : '-';
    }
}

function resetConversationPane(container, welcomeElement, showWelcomeFn) {
    Array.from(container.children).forEach(child => {
        if (welcomeElement && child !== welcomeElement) {
            child.remove();
        }
    });
    showWelcomeFn();
}

function resetScopedUiState() {
    messages = [];
    messagesGuideline = [];
    messagesIdobata = [];
    attachments = [];
    attachmentsGuideline = [];
    attachmentsIdobata = [];
    missionJobs = [];
    selectedJobId = null;
    auditSummary = null;
    auditEvents = [];

    resetConversationPane(chatMessages, welcomeScreen, showWelcomeScreen);
    resetConversationPane(chatMessagesGuideline, welcomeScreenGuideline, showWelcomeScreenGuideline);
    resetConversationPane(chatMessagesIdobata, welcomeScreenIdobata, showWelcomeScreenIdobata);
    Object.values(attachmentContexts).forEach(renderAttachmentList);
    renderMissionList();
    renderMissionDetail(null);
    renderAuditSummary();
    renderAuditEventFeed();
}

async function refreshScopedData() {
    resetScopedUiState();
    await initializeHistories();
    await initializeAttachments();
    await refreshJobs(false);
    await refreshAuditDashboard();
}

async function applyAccessSelection(userId, workspaceId, { reload = true } = {}) {
    const normalized = normalizeAccessSelection(userId, workspaceId);
    currentUserId = normalized.userId;
    currentWorkspaceId = normalized.workspaceId;
    persistAccessSelection();
    renderAccessControls();
    if (reload) {
        await refreshScopedData();
    }
}

async function loadAccessBootstrap() {
    const response = await fetch('/api/access/bootstrap');
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    accessBootstrap = {
        default_user_id: payload.default_user_id || null,
        users: Array.isArray(payload.users) ? payload.users : [],
        workspaces: Array.isArray(payload.workspaces) ? payload.workspaces : [],
    };

    const stored = readStoredAccessSelection();
    await applyAccessSelection(stored.user_id, stored.workspace_id, { reload: false });
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
        const query = buildAccessQuery({ session_id: context.sessionId, mode });
        const response = await fetch(`/api/files?${query}`);
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
    const accessPayload = getAccessPayload();
    if (accessPayload.user_id) {
        formData.append('user_id', accessPayload.user_id);
    }
    if (accessPayload.workspace_id) {
        formData.append('workspace_id', accessPayload.workspace_id);
    }
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
        const query = buildAccessQuery({ session_id: context.sessionId, mode });
        const response = await fetch(
            `/api/files/${encodeURIComponent(fileId)}?${query}`,
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
    renderAccessControls();
    Object.values(attachmentContexts).forEach(renderAttachmentList);
    renderMissionList();
    const activeJob = selectedJobId ? missionJobs.find(job => job.job_id === selectedJobId) || null : null;
    renderMissionDetail(activeJob);
    renderAuditSummary();
    renderAuditEventFeed();
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
        body.classList.remove('idobata-mode');
    } else if (mode === 'guideline') {
        generalChat.style.display = 'none';
        guidelineChat.style.display = 'flex';
        idobataChat.style.display = 'none';
        body.classList.add('guideline-mode');
        body.classList.remove('idobata-mode');
    } else {
        generalChat.style.display = 'none';
        guidelineChat.style.display = 'none';
        idobataChat.style.display = 'flex';
        body.classList.remove('guideline-mode');
        body.classList.add('idobata-mode');
    }

    // Close settings dropdown on mode switch
    closeAllSettings();
}

// Event listeners - general chat
promptInput.addEventListener('input', updateButtons);
promptInput.addEventListener('keydown', handleKeyDown);
sendButton.addEventListener('click', () => startChat(false));
queueJobButton.addEventListener('click', () => startQueuedJob('general'));
autoRouteButton.addEventListener('click', startAutoRouteChat);
multiAgentButton.addEventListener('click', () => startChat(true));
clearButton.addEventListener('click', clearChat);

// Event listeners - guideline chat
promptInputGuideline.addEventListener('input', updateButtonsGuideline);
promptInputGuideline.addEventListener('keydown', handleKeyDownGuideline);
sendButtonGuideline.addEventListener('click', startGuidelineChat);
queueJobButtonGuideline.addEventListener('click', () => startQueuedJob('guideline'));
clearButtonGuideline.addEventListener('click', clearGuidelineChat);

// Event listeners - AI board meeting
promptInputIdobata.addEventListener('input', updateButtonsIdobata);
promptInputIdobata.addEventListener('keydown', handleKeyDownIdobata);
sendButtonIdobata.addEventListener('click', startIdobataChat);
queueJobButtonIdobata.addEventListener('click', () => startQueuedJob('idobata'));
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
if (refreshJobsButton) {
    refreshJobsButton.addEventListener('click', () => {
        refreshJobs(false);
        refreshAuditDashboard();
    });
}
if (accessUserSelect) {
    accessUserSelect.addEventListener('change', async event => {
        await applyAccessSelection(event.target.value, null);
    });
}
if (accessWorkspaceSelect) {
    accessWorkspaceSelect.addEventListener('change', async event => {
        await applyAccessSelection(currentUserId, event.target.value);
    });
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
    queueJobButton.disabled = isBusy || !hasText || !hasModel;
    autoRouteButton.disabled = isBusy || !hasText || !hasModel;
    multiAgentButton.disabled = isBusy || !hasText || !hasModel;
}

function updateButtonsGuideline() {
    const hasText = promptInputGuideline.value.trim().length > 0;
    const hasModel = modelSelectGuideline && !modelSelectGuideline.disabled && !!modelSelectGuideline.value;
    sendButtonGuideline.disabled = isBusy || !hasText || !hasModel;
    queueJobButtonGuideline.disabled = isBusy || !hasText || !hasModel;
}

function updateButtonsIdobata() {
    const hasText = promptInputIdobata.value.trim().length > 0;
    const hasModel = modelSelectIdobata && !modelSelectIdobata.disabled && !!modelSelectIdobata.value;
    sendButtonIdobata.disabled = isBusy || !hasText || !hasModel;
    queueJobButtonIdobata.disabled = isBusy || !hasText || !hasModel;
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

function getRouteModeLabel(mode) {
    if (mode === 'guideline') return t('route_mode_guideline');
    if (mode === 'multi_agent') return t('route_mode_multi_agent');
    if (mode === 'idobata') return t('route_mode_idobata');
    return t('route_mode_general');
}

function buildStoredUserContent(prompt, route) {
    return `🧭 [${t('auto_route_button')} → ${getRouteModeLabel(route.mode)}] ${prompt}`;
}

function createRouteInfoPanel(message) {
    if (!message || !message.route_mode) {
        return null;
    }

    const panel = document.createElement('div');
    panel.className = 'route-info-panel';
    panel.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'route-info-header';
    header.innerHTML = `<span>🧭</span><span>${t('route_info_title')}: ${getRouteModeLabel(message.route_mode)}</span>`;

    const body = document.createElement('div');
    body.className = 'route-info-body';

    panel.appendChild(header);
    panel.appendChild(body);

    return { panel, body };
}

function updateRouteInfoPanel(message) {
    if (!message || message.is_user || !message.element || !message.element.routeInfo) {
        return;
    }

    const refs = message.element.routeInfo;
    const hasReason = typeof message.route_reason === 'string' && message.route_reason.trim().length > 0;
    const hasConfidence = Number.isFinite(message.route_confidence);
    refs.body.innerHTML = '';

    if (!message.route_mode) {
        refs.panel.style.display = 'none';
        return;
    }

    if (hasReason) {
        const reason = document.createElement('div');
        reason.textContent = `${t('route_reason_label')}: ${message.route_reason.trim()}`;
        refs.body.appendChild(reason);
    }

    if (hasConfidence) {
        const meta = document.createElement('div');
        meta.className = 'route-info-meta';
        meta.textContent = `${t('route_confidence_label')}: ${Math.round(message.route_confidence * 100)}%`;
        refs.body.appendChild(meta);
    }

    refs.panel.style.display = 'block';
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
        review: normalizeReviewData(message.review),
        audit: normalizeAuditData(message.audit),
        traces: Array.isArray(message.traces) ? message.traces : [],
        evidence: Array.isArray(message.evidence) ? message.evidence : [],
        route_mode: typeof message.route_mode === 'string' ? message.route_mode : null,
        route_reason: typeof message.route_reason === 'string' ? message.route_reason : '',
        route_confidence: Number.isFinite(message.route_confidence) ? message.route_confidence : Number(message.route_confidence),
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

    if (!Number.isFinite(normalized.route_confidence)) {
        normalized.route_confidence = null;
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
        const query = buildAccessQuery({ session_id: sessionKey });
        const response = await fetch(`/api/messages?${query}`);
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
    await loadAccessBootstrap();
    await loadAvailableModels();
    await initializeHistories();
    await initializeAttachments();
    await refreshJobs(false);
    await refreshAuditDashboard();
    window.setInterval(() => {
        refreshJobs();
    }, JOB_POLL_INTERVAL_MS);
    window.setInterval(() => {
        refreshAuditDashboard();
    }, AUDIT_POLL_INTERVAL_MS);
}

function normalizeJob(job) {
    if (!job || typeof job !== 'object' || !job.job_id) {
        return null;
    }

    const rawReviewScore = Number(job.review_score);

    return {
        ...job,
        created_at: job.created_at ? new Date(job.created_at) : null,
        updated_at: job.updated_at ? new Date(job.updated_at) : null,
        started_at: job.started_at ? new Date(job.started_at) : null,
        completed_at: job.completed_at ? new Date(job.completed_at) : null,
        review_score: Number.isFinite(rawReviewScore) ? rawReviewScore : null,
        result: job.result && typeof job.result === 'object' ? job.result : null,
        summary_text: typeof job.summary_text === 'string' ? job.summary_text : '',
        error_message: typeof job.error_message === 'string' ? job.error_message : '',
        progress_stage: typeof job.progress_stage === 'string' ? job.progress_stage : 'queued',
        status: typeof job.status === 'string' ? job.status : 'queued',
    };
}

function formatJobTimestamp(value) {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return '---';
    }
    return value.toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getJobModeLabel(mode) {
    if (mode === 'guideline') return t('route_mode_guideline');
    if (mode === 'idobata') return t('route_mode_idobata');
    return t('route_mode_general');
}

function getJobStatusLabel(status) {
    if (status === 'running') return t('job_status_running');
    if (status === 'completed') return t('job_status_completed');
    if (status === 'failed') return t('job_status_failed');
    return t('job_status_queued');
}

function getJobStageLabel(stage) {
    if (stage === 'planning') return t('job_stage_planning');
    if (stage === 'executing') return t('job_stage_executing');
    if (stage === 'reviewing') return t('job_stage_reviewing');
    if (stage === 'completed') return t('job_status_completed');
    if (stage === 'failed') return t('job_status_failed');
    return t('job_status_queued');
}

function getJobSummary(job) {
    if (job.summary_text) return job.summary_text;
    if (job.result && typeof job.result.content === 'string' && job.result.content.trim()) {
        return job.result.content.trim();
    }
    if (job.result && typeof job.result.synthesis_content === 'string' && job.result.synthesis_content.trim()) {
        return job.result.synthesis_content.trim();
    }
    return job.prompt || '';
}

function createMissionMeta(label, value) {
    const row = document.createElement('div');
    row.className = 'mission-meta-row';

    const heading = document.createElement('div');
    heading.className = 'mission-meta-label';
    heading.textContent = label;

    const body = document.createElement('div');
    body.className = 'mission-meta-value';
    body.textContent = value || '---';

    row.appendChild(heading);
    row.appendChild(body);
    return row;
}

function createMissionSection(title, content, { markdown = false } = {}) {
    const section = document.createElement('section');
    section.className = 'mission-section';

    const heading = document.createElement('h3');
    heading.className = 'mission-section-title';
    heading.textContent = title;

    const body = document.createElement('div');
    body.className = 'mission-section-body';
    if (markdown) {
        body.innerHTML = renderMarkdown(content || '');
    } else {
        body.textContent = content || '---';
    }

    section.appendChild(heading);
    section.appendChild(body);
    return section;
}

function createMissionList(items, title) {
    const wrapper = document.createElement('section');
    wrapper.className = 'mission-section';

    const heading = document.createElement('h3');
    heading.className = 'mission-section-title';
    heading.textContent = title;
    wrapper.appendChild(heading);

    const normalized = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!normalized.length) {
        const body = document.createElement('div');
        body.className = 'mission-section-body';
        body.textContent = '---';
        wrapper.appendChild(body);
        return wrapper;
    }

    const list = document.createElement('ul');
    list.className = 'mission-list-items';
    normalized.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
    wrapper.appendChild(list);
    return wrapper;
}

function renderMissionList() {
    if (!missionList || !missionEmpty) return;

    missionList.innerHTML = '';
    missionEmpty.style.display = missionJobs.length ? 'none' : 'block';

    missionJobs.forEach(job => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `mission-card status-${job.status}${job.job_id === selectedJobId ? ' selected' : ''}`;
        button.addEventListener('click', () => selectJob(job.job_id));

        const header = document.createElement('div');
        header.className = 'mission-card-header';

        const mode = document.createElement('div');
        mode.className = 'mission-card-mode';
        mode.textContent = getJobModeLabel(job.mode);

        const status = document.createElement('div');
        status.className = `mission-card-status status-${job.status}`;
        status.textContent = getJobStatusLabel(job.status);

        header.appendChild(mode);
        header.appendChild(status);

        const prompt = document.createElement('div');
        prompt.className = 'mission-card-prompt';
        prompt.textContent = _truncateClientText(job.prompt, 120);

        const meta = document.createElement('div');
        meta.className = 'mission-card-meta';
        const metaParts = [formatJobTimestamp(job.updated_at), getJobStageLabel(job.progress_stage)];
        if (Number.isFinite(job.review_score)) {
            metaParts.push(`${t('mission_score_label')}: ${job.review_score}/5`);
        }
        meta.textContent = metaParts.join(' / ');

        const summary = document.createElement('div');
        summary.className = 'mission-card-summary';
        summary.textContent = _truncateClientText(getJobSummary(job), 180);

        button.appendChild(header);
        button.appendChild(prompt);
        button.appendChild(meta);
        button.appendChild(summary);
        missionList.appendChild(button);
    });
}

function renderMissionDetail(job) {
    if (!missionDetail) return;

    missionDetail.innerHTML = '';
    if (!job) {
        const placeholder = document.createElement('div');
        placeholder.className = 'mission-detail-placeholder';
        placeholder.textContent = t('mission_detail_placeholder');
        missionDetail.appendChild(placeholder);
        return;
    }

    const header = document.createElement('div');
    header.className = 'mission-detail-header';
    header.appendChild(createMissionMeta(t('mission_mode_label'), getJobModeLabel(job.mode)));
    header.appendChild(createMissionMeta(t('mission_status_label'), `${getJobStatusLabel(job.status)} / ${getJobStageLabel(job.progress_stage)}`));
    header.appendChild(createMissionMeta(t('mission_model_label'), job.model_name || '---'));
    header.appendChild(createMissionMeta(t('mission_created_label'), formatJobTimestamp(job.created_at)));
    if (Number.isFinite(job.review_score)) {
        header.appendChild(createMissionMeta(t('mission_score_label'), `${job.review_score}/5`));
    }
    missionDetail.appendChild(header);
    missionDetail.appendChild(createMissionSection(t('mission_prompt_label'), job.prompt));

    if (job.error_message) {
        missionDetail.appendChild(createMissionSection(t('mission_error_label'), job.error_message));
    }

    if (job.result) {
        const result = job.result;
        const primaryOutput = result.content || result.synthesis_content || result.planning_content || '';
        if (primaryOutput) {
            missionDetail.appendChild(createMissionSection(t('mission_output_label'), primaryOutput, { markdown: true }));
        }
        if (result.planning_content) {
            missionDetail.appendChild(createMissionSection(t('agent_ceo'), result.planning_content, { markdown: true }));
        }
        if (result.tech_content) {
            missionDetail.appendChild(createMissionSection(t('agent_cto'), result.tech_content, { markdown: true }));
        }
        if (result.business_content) {
            missionDetail.appendChild(createMissionSection(t('agent_cfo'), result.business_content, { markdown: true }));
        }
        if (result.synthesis_content && result.content !== result.synthesis_content) {
            missionDetail.appendChild(createMissionSection(t('agent_coo'), result.synthesis_content, { markdown: true }));
        }

        const normalizedPlan = normalizePlanData(result.plan);
        if (normalizedPlan) {
            missionDetail.appendChild(createMissionSection(t('plan_goal'), normalizedPlan.goal));
            missionDetail.appendChild(createMissionList(normalizedPlan.steps, t('plan_steps')));
            missionDetail.appendChild(createMissionList(normalizedPlan.tools, t('plan_tools')));
        }

        const normalizedReview = normalizeReviewData(result.review);
        if (normalizedReview) {
            missionDetail.appendChild(createMissionSection(t('review_verdict'), normalizedReview.verdict));
            missionDetail.appendChild(createMissionList(normalizedReview.strengths, t('review_strengths')));
            missionDetail.appendChild(createMissionList(normalizedReview.risks, t('review_risks')));
            missionDetail.appendChild(createMissionList(normalizedReview.missing_info, t('review_missing_info')));
            missionDetail.appendChild(createMissionSection(t('review_next_step'), normalizedReview.recommended_next_step));
        }

        const normalizedAudit = normalizeAuditData(result.audit);
        if (normalizedAudit) {
            const auditLines = [
                `- ${t('audit_duration_label')}: ${normalizedAudit.duration_ms ?? '-'}`,
                `- ${t('audit_total_tokens_label')}: ${normalizedAudit.total_tokens ?? '-'}`,
                `- ${t('audit_prompt_tokens_label')}: ${normalizedAudit.prompt_tokens ?? '-'}`,
                `- ${t('audit_completion_tokens_label')}: ${normalizedAudit.completion_tokens ?? '-'}`,
                `- ${t('audit_token_source_label')}: ${t(`audit_token_source_${normalizedAudit.token_source}`)}`,
                `- ${t('audit_total_cost_label')}: ${formatAuditCost(normalizedAudit)}`,
            ];
            if (normalizedAudit.tool_names.length) {
                auditLines.push(`- ${t('audit_tools_label')}: ${normalizedAudit.tool_names.join(', ')}`);
            }
            missionDetail.appendChild(createMissionSection(t('audit_panel_title'), auditLines.join('\n'), { markdown: true }));
        }
    }
}

async function loadJobDetail(jobId) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}?${buildAccessQuery()}`);
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    const job = normalizeJob(payload);
    if (!job) return null;

    missionJobs = missionJobs.map(item => item.job_id === job.job_id ? { ...item, ...job } : item);
    selectedJobId = job.job_id;
    renderMissionList();
    renderMissionDetail(job);
    return job;
}

async function refreshJobs(preserveSelection = true) {
    try {
        const response = await fetch(`/api/jobs?${buildAccessQuery({ limit: 30 })}`);
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        missionJobs = Array.isArray(payload.jobs) ? payload.jobs.map(normalizeJob).filter(Boolean) : [];
        if (!preserveSelection) {
            selectedJobId = null;
        }

        if (selectedJobId && !missionJobs.some(job => job.job_id === selectedJobId)) {
            selectedJobId = null;
        }
        if (!selectedJobId && missionJobs.length) {
            selectedJobId = missionJobs[0].job_id;
        }

        renderMissionList();
        if (selectedJobId) {
            await loadJobDetail(selectedJobId);
        } else {
            renderMissionDetail(null);
        }
    } catch (error) {
        console.error('Job refresh error:', error);
    }
}

function formatCompactNumber(value) {
    return new Intl.NumberFormat('ja-JP').format(Number(value) || 0);
}

function renderAuditSummary() {
    if (auditTotalRunsValue) {
        auditTotalRunsValue.textContent = auditSummary ? formatCompactNumber(auditSummary.total_runs) : '0';
    }
    if (auditTotalTokensValue) {
        auditTotalTokensValue.textContent = auditSummary ? formatCompactNumber(auditSummary.total_tokens) : '0';
    }
    if (auditTotalCostValue) {
        if (auditSummary && auditSummary.currency && Number.isFinite(Number(auditSummary.total_estimated_cost))) {
            auditTotalCostValue.textContent = `${Number(auditSummary.total_estimated_cost).toFixed(4)} ${auditSummary.currency || 'USD'}`;
        } else {
            auditTotalCostValue.textContent = '-';
        }
    }
}

function renderAuditEventFeed() {
    if (!auditEventList || !auditEventEmpty) return;
    auditEventList.innerHTML = '';

    const normalizedEvents = Array.isArray(auditEvents)
        ? auditEvents.map(normalizeAuditData).filter(Boolean)
        : [];

    auditEventEmpty.style.display = normalizedEvents.length ? 'none' : 'block';
    if (!normalizedEvents.length) {
        return;
    }

    normalizedEvents.forEach(event => {
        const item = document.createElement('div');
        item.className = 'audit-feed-item';

        const header = document.createElement('div');
        header.className = 'audit-feed-header';
        header.textContent = `${getRouteModeLabel(event.mode || 'general')} / ${event.model_name || '-'}`;

        const meta = document.createElement('div');
        meta.className = 'audit-feed-meta';
        const metaParts = [];
        if (event.duration_ms !== null) metaParts.push(`${event.duration_ms}ms`);
        if (event.total_tokens !== null) metaParts.push(`${event.total_tokens} tok`);
        if (Number.isFinite(event.estimated_cost)) metaParts.push(formatAuditCost(event));
        meta.textContent = metaParts.join(' / ');

        const excerpt = document.createElement('div');
        excerpt.className = 'audit-feed-excerpt';
        excerpt.textContent = event.error_message || event.request_id || '-';

        item.appendChild(header);
        item.appendChild(meta);
        item.appendChild(excerpt);
        auditEventList.appendChild(item);
    });
}

async function refreshAuditDashboard() {
    try {
        const [summaryResponse, eventsResponse] = await Promise.all([
            fetch(`/api/audit/summary?${buildAccessQuery()}`),
            fetch(`/api/audit/events?${buildAccessQuery({ limit: 6 })}`),
        ]);

        const summaryPayload = await summaryResponse.json();
        const eventsPayload = await eventsResponse.json();

        if (!summaryResponse.ok) {
            throw new Error(summaryPayload.error || `HTTP ${summaryResponse.status}`);
        }
        if (!eventsResponse.ok) {
            throw new Error(eventsPayload.error || `HTTP ${eventsResponse.status}`);
        }

        auditSummary = summaryPayload && typeof summaryPayload === 'object' ? summaryPayload : null;
        auditEvents = Array.isArray(eventsPayload.events) ? eventsPayload.events : [];
    } catch (error) {
        console.error('Audit dashboard refresh error:', error);
        auditSummary = null;
        auditEvents = [];
    }

    renderAuditSummary();
    renderAuditEventFeed();
}

async function selectJob(jobId) {
    try {
        await loadJobDetail(jobId);
    } catch (error) {
        console.error('Job detail error:', error);
    }
}

function _truncateClientText(value, limit = 160) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) {
        return text;
    }
    return `${text.slice(0, limit).trim()}...`;
}

async function startQueuedJob(mode) {
    if (isBusy) return;

    let prompt = '';
    let model = '';
    let tone = null;
    let input = null;
    let updateFn = null;

    if (mode === 'guideline') {
        prompt = promptInputGuideline.value.trim();
        model = modelSelectGuideline.value;
        input = promptInputGuideline;
        updateFn = updateButtonsGuideline;
    } else if (mode === 'idobata') {
        prompt = promptInputIdobata.value.trim();
        model = modelSelectIdobata.value;
        tone = toneSelectIdobata.value;
        input = promptInputIdobata;
        updateFn = updateButtonsIdobata;
    } else {
        prompt = promptInput.value.trim();
        model = modelSelect.value;
        input = promptInput;
        updateFn = updateButtons;
    }

    if (!prompt || !model) return;

    const approved = await ensureApprovalBeforeRun(mode, model, input);
    if (!approved) return;

    try {
        const response = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                mode,
                model,
                tone,
                ...getAccessPayload(),
            })
        });
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.error || `HTTP ${response.status}`);
        }

        input.value = '';
        if (typeof updateFn === 'function') {
            updateFn();
        }

        await refreshJobs(false);
        if (payload.job_id) {
            await selectJob(payload.job_id);
        }
    } catch (error) {
        console.error('Job start error:', error);
        alert(`${t('error_prefix')}${error.message}`);
    }
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
    const prefix = isMultiAgentMode ? `🔀 [${t('multi_agent_button')}] ` : '';
    addUserMessageToGeneral(prefix + content);
}

function addUserMessageToGeneral(content) {
    const timestamp = new Date();
    const message = {
        is_user: true,
        content,
        timestamp,
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
        review: null,
        audit: null,
        traces: [],
        evidence: [],
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

function addAiMessageForRoute(route) {
    const timestamp = new Date();
    const routeFields = {
        route_mode: route.mode,
        route_reason: route.reason || '',
        route_confidence: Number.isFinite(route.confidence) ? route.confidence : null,
    };

    let message;
    if (route.mode === 'multi_agent') {
        message = {
            is_user: false,
            timestamp,
            plan: null,
            review: null,
            audit: null,
            is_streaming: true,
            is_multi_agent: true,
            critical_content: '',
            positive_content: '',
            synthesis_content: '',
            critical_streaming: true,
            positive_streaming: true,
            synthesis_streaming: false,
            element: null,
            ...routeFields,
        };
    } else if (route.mode === 'idobata') {
        message = {
            is_user: false,
            is_planning: true,
            timestamp,
            plan: null,
            review: null,
            audit: null,
            planning_content: '',
            tech_content: '',
            business_content: '',
            synthesis_content: '',
            element: null,
            ...routeFields,
        };
    } else {
        message = {
            is_user: false,
            content: '',
            plan: null,
            review: null,
            audit: null,
            traces: [],
            evidence: [],
            timestamp,
            is_streaming: true,
            is_multi_agent: false,
            critical_content: '',
            positive_content: '',
            synthesis_content: '',
            critical_streaming: false,
            positive_streaming: false,
            synthesis_streaming: false,
            element: null,
            ...routeFields,
        };
    }

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
        review: null,
        audit: null,
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
    if (message.is_planning) {
        renderPlanningMessageInContainer(message, chatMessages, t('idobata_planning_title'));
    } else if (message.is_multi_agent) {
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

function normalizeReviewData(review) {
    if (!review || typeof review !== 'object') {
        return null;
    }

    const normalizeItems = value => {
        if (!Array.isArray(value)) return [];
        return value
            .map(item => typeof item === 'string' ? item.trim() : '')
            .filter(Boolean)
            .slice(0, 3);
    };

    const rawScore = Number(review.score);
    const normalized = {
        score: Number.isFinite(rawScore) ? Math.max(1, Math.min(Math.round(rawScore), 5)) : null,
        verdict: typeof review.verdict === 'string' ? review.verdict.trim() : '',
        strengths: normalizeItems(review.strengths),
        risks: normalizeItems(review.risks),
        missing_info: normalizeItems(review.missing_info),
        recommended_next_step: typeof review.recommended_next_step === 'string' ? review.recommended_next_step.trim() : '',
        fallback_used: !!review.fallback_used,
    };

    if (!normalized.score && !normalized.verdict && !normalized.strengths.length && !normalized.risks.length && !normalized.missing_info.length && !normalized.recommended_next_step) {
        return null;
    }

    return normalized;
}

function createReviewSection(title) {
    const section = document.createElement('div');
    section.className = 'review-section';

    const heading = document.createElement('div');
    heading.className = 'review-section-title';
    heading.textContent = title;

    const body = document.createElement('div');
    body.className = 'review-section-body';

    section.appendChild(heading);
    section.appendChild(body);

    return { section, body };
}

function createReviewPanel() {
    const panel = document.createElement('div');
    panel.className = 'review-panel';
    panel.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'review-header';

    const title = document.createElement('div');
    title.className = 'review-title';
    title.innerHTML = `<span>🧪</span><span>${t('review_title')}</span>`;

    const score = document.createElement('div');
    score.className = 'review-score';

    header.appendChild(title);
    header.appendChild(score);

    const verdict = createReviewSection(t('review_verdict'));
    const strengths = createReviewSection(t('review_strengths'));
    const risks = createReviewSection(t('review_risks'));
    const missing = createReviewSection(t('review_missing_info'));
    const nextStep = createReviewSection(t('review_next_step'));

    const fallback = document.createElement('div');
    fallback.className = 'review-fallback-note';
    fallback.style.display = 'none';
    fallback.textContent = t('review_fallback');

    panel.appendChild(header);
    panel.appendChild(verdict.section);
    panel.appendChild(strengths.section);
    panel.appendChild(risks.section);
    panel.appendChild(missing.section);
    panel.appendChild(nextStep.section);
    panel.appendChild(fallback);

    return {
        panel,
        score,
        verdictSection: verdict.section,
        verdict: verdict.body,
        strengthsSection: strengths.section,
        strengths: strengths.body,
        risksSection: risks.section,
        risks: risks.body,
        missingSection: missing.section,
        missing: missing.body,
        nextStepSection: nextStep.section,
        nextStep: nextStep.body,
        fallback,
    };
}

function renderReviewItems(container, items) {
    container.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
        return false;
    }

    const list = document.createElement('ul');
    list.className = 'review-list';
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
    container.appendChild(list);
    return true;
}

function applyQualityReview(reviewRefs, review) {
    if (!reviewRefs || !reviewRefs.panel) {
        return null;
    }

    const normalized = normalizeReviewData(review);
    if (!normalized) {
        reviewRefs.panel.style.display = 'none';
        return null;
    }

    reviewRefs.score.textContent = normalized.score ? `${t('review_score')}: ${normalized.score}/5` : '';
    reviewRefs.verdict.textContent = normalized.verdict || '-';
    const hasStrengths = renderReviewItems(reviewRefs.strengths, normalized.strengths);
    const hasRisks = renderReviewItems(reviewRefs.risks, normalized.risks);
    const hasMissing = renderReviewItems(reviewRefs.missing, normalized.missing_info);
    reviewRefs.nextStep.textContent = normalized.recommended_next_step || '-';
    reviewRefs.strengthsSection.style.display = hasStrengths ? 'block' : 'none';
    reviewRefs.risksSection.style.display = hasRisks ? 'block' : 'none';
    reviewRefs.missingSection.style.display = hasMissing ? 'block' : 'none';
    reviewRefs.verdictSection.style.display = normalized.verdict ? 'block' : 'none';
    reviewRefs.nextStepSection.style.display = normalized.recommended_next_step ? 'block' : 'none';
    reviewRefs.fallback.style.display = normalized.fallback_used ? 'block' : 'none';
    reviewRefs.panel.style.display = 'block';
    return normalized;
}

function updateMessageReview(message, review = message.review) {
    if (!message || message.is_user) {
        return;
    }

    const reviewRefs = message.element && message.element.review ? message.element.review : null;
    const normalized = applyQualityReview(reviewRefs, review);
    if (normalized) {
        message.review = normalized;
    }
}

function normalizeAuditData(audit) {
    if (!audit || typeof audit !== 'object') {
        return null;
    }

    const toInt = value => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : null;
    };
    const toFloat = value => {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    };
    const toolNames = Array.isArray(audit.tool_names)
        ? audit.tool_names.map(item => typeof item === 'string' ? item.trim() : '').filter(Boolean)
        : [];

    const normalized = {
        request_id: typeof audit.request_id === 'string' ? audit.request_id : '',
        mode: typeof audit.mode === 'string' ? audit.mode : '',
        model_name: typeof audit.model_name === 'string' ? audit.model_name : '',
        provider: typeof audit.provider === 'string' ? audit.provider : '',
        target: typeof audit.target === 'string' ? audit.target : '',
        status: typeof audit.status === 'string' ? audit.status : 'completed',
        duration_ms: toInt(audit.duration_ms),
        planning_duration_ms: toInt(audit.planning_duration_ms),
        execution_duration_ms: toInt(audit.execution_duration_ms),
        review_duration_ms: toInt(audit.review_duration_ms),
        prompt_tokens: toInt(audit.prompt_tokens),
        completion_tokens: toInt(audit.completion_tokens),
        total_tokens: toInt(audit.total_tokens),
        token_source: typeof audit.token_source === 'string' ? audit.token_source : 'unknown',
        estimated_cost: toFloat(audit.estimated_cost),
        currency: typeof audit.currency === 'string' ? audit.currency : '',
        tool_names: toolNames,
        trace_count: toInt(audit.trace_count) || 0,
        evidence_count: toInt(audit.evidence_count) || 0,
        attachment_count: toInt(audit.attachment_count) || 0,
        history_message_count: toInt(audit.history_message_count) || 0,
        review_score: toInt(audit.review_score),
        created_at: typeof audit.created_at === 'string' ? audit.created_at : '',
        error_message: typeof audit.error_message === 'string' ? audit.error_message.trim() : '',
    };

    if (!normalized.request_id && !normalized.model_name && normalized.total_tokens === null && normalized.duration_ms === null) {
        return null;
    }
    return normalized;
}

function formatAuditCost(audit) {
    if (!audit || !Number.isFinite(audit.estimated_cost)) {
        return '-';
    }
    const currency = audit.currency || 'USD';
    return `${audit.estimated_cost.toFixed(4)} ${currency}`;
}

function createAuditPanel() {
    const panel = document.createElement('div');
    panel.className = 'audit-panel';
    panel.style.display = 'none';

    const header = document.createElement('div');
    header.className = 'audit-header';
    header.innerHTML = `<span>🛰️</span><span>${t('audit_panel_title')}</span>`;

    const primary = document.createElement('div');
    primary.className = 'audit-primary';

    const meta = document.createElement('div');
    meta.className = 'audit-meta';

    const details = document.createElement('div');
    details.className = 'audit-details';

    panel.appendChild(header);
    panel.appendChild(primary);
    panel.appendChild(meta);
    panel.appendChild(details);

    return { panel, primary, meta, details };
}

function applyAuditPanel(auditRefs, audit) {
    if (!auditRefs || !auditRefs.panel) {
        return null;
    }

    const normalized = normalizeAuditData(audit);
    if (!normalized) {
        auditRefs.panel.style.display = 'none';
        return null;
    }

    const primaryParts = [];
    if (normalized.duration_ms !== null) {
        primaryParts.push(`${t('audit_duration_label')}: ${normalized.duration_ms}ms`);
    }
    if (normalized.total_tokens !== null) {
        primaryParts.push(`${t('audit_total_tokens_label')}: ${normalized.total_tokens}`);
    }
    if (normalized.review_score !== null) {
        primaryParts.push(`${t('mission_score_label')}: ${normalized.review_score}/5`);
    }
    if (Number.isFinite(normalized.estimated_cost)) {
        primaryParts.push(`${t('audit_total_cost_label')}: ${formatAuditCost(normalized)}`);
    }
    auditRefs.primary.textContent = primaryParts.join(' / ') || '-';

    const metaParts = [];
    if (normalized.model_name) {
        metaParts.push(`${t('mission_model_label')}: ${normalized.model_name}`);
    }
    if (normalized.provider) {
        metaParts.push(normalized.provider);
    }
    if (normalized.token_source) {
        metaParts.push(`${t('audit_token_source_label')}: ${t(`audit_token_source_${normalized.token_source}`)}`);
    }
    auditRefs.meta.textContent = metaParts.join(' / ');

    const detailParts = [];
    if (normalized.prompt_tokens !== null) {
        detailParts.push(`${t('audit_prompt_tokens_label')}: ${normalized.prompt_tokens}`);
    }
    if (normalized.completion_tokens !== null) {
        detailParts.push(`${t('audit_completion_tokens_label')}: ${normalized.completion_tokens}`);
    }
    if (normalized.tool_names.length) {
        detailParts.push(`${t('audit_tools_label')}: ${normalized.tool_names.join(', ')}`);
    }
    if (normalized.trace_count) {
        detailParts.push(`${t('trace_title')}: ${normalized.trace_count}`);
    }
    if (normalized.evidence_count) {
        detailParts.push(`${t('evidence_title')}: ${normalized.evidence_count}`);
    }
    if (normalized.attachment_count) {
        detailParts.push(`${t('audit_attachments_label')}: ${normalized.attachment_count}`);
    }
    if (normalized.history_message_count) {
        detailParts.push(`${t('audit_history_label')}: ${normalized.history_message_count}`);
    }
    if (normalized.error_message) {
        detailParts.push(`${t('mission_error_label')}: ${normalized.error_message}`);
    }
    auditRefs.details.textContent = detailParts.join(' / ');
    auditRefs.panel.style.display = 'block';
    return normalized;
}

function updateMessageAudit(message, audit = message.audit) {
    if (!message || message.is_user) {
        return;
    }

    const auditRefs = message.element && message.element.audit ? message.element.audit : null;
    const normalized = applyAuditPanel(auditRefs, audit);
    if (normalized) {
        message.audit = normalized;
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
    let routeInfoRefs = null;
    let reviewRefs = null;
    let diagnosticsRefs = null;
    let auditRefs = null;
    if (!message.is_user) {
        planRefs = createExecutionPlanPanel();
        routeInfoRefs = createRouteInfoPanel(message);
        reviewRefs = createReviewPanel();
        diagnosticsRefs = createDiagnosticsPanel();
        auditRefs = createAuditPanel();
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
    if (routeInfoRefs) {
        contentDiv.appendChild(routeInfoRefs.panel);
    }
    if (planRefs) {
        contentDiv.appendChild(planRefs.panel);
    }
    contentDiv.appendChild(textDiv);
    if (reviewRefs) {
        contentDiv.appendChild(reviewRefs.panel);
    }
    if (auditRefs) {
        contentDiv.appendChild(auditRefs.panel);
    }
    if (diagnosticsRefs) {
        contentDiv.appendChild(diagnosticsRefs.panel);
    }
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessages.appendChild(wrapper);
    
    message.element = message.is_user ? textDiv : { text: textDiv, plan: planRefs, routeInfo: routeInfoRefs, review: reviewRefs, audit: auditRefs, diagnostics: diagnosticsRefs };
    if (!message.is_user && message.plan) {
        updateMessagePlan(message, message.plan);
    }
    if (!message.is_user) {
        updateRouteInfoPanel(message);
        updateMessageReview(message);
        updateMessageAudit(message);
        if (message.traces?.length || message.evidence?.length) {
            updateGuidelineDiagnostics(message);
        }
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
    const routeInfoRefs = createRouteInfoPanel(message);
    const reviewRefs = createReviewPanel();
    const auditRefs = createAuditPanel();
    
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
    if (routeInfoRefs) {
        container.appendChild(routeInfoRefs.panel);
    }
    container.appendChild(planRefs.panel);
    container.appendChild(grid);
    container.appendChild(synthesisPanel);
    container.appendChild(reviewRefs.panel);
    container.appendChild(auditRefs.panel);
    wrapper.appendChild(container);
    chatMessages.appendChild(wrapper);
    
    message.element = {
        plan: planRefs,
        routeInfo: routeInfoRefs,
        review: reviewRefs,
        audit: auditRefs,
        critical: criticalPanel.querySelector('[data-agent="critical"]'),
        positive: positivePanel.querySelector('[data-agent="positive"]'),
        synthesis: synthesisPanel.querySelector('[data-agent="synthesis"]'),
        synthesisPanel: synthesisPanel
    };
    if (message.plan) {
        updateMultiAgentPlan(message, message.plan);
    }
    updateRouteInfoPanel(message);
    updateMessageReview(message);
    updateMessageAudit(message);
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
    let reviewRefs = null;
    let auditRefs = null;

    if (!message.is_user) {
        planRefs = createExecutionPlanPanel();
        reviewRefs = createReviewPanel();
        auditRefs = createAuditPanel();
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
    if (reviewRefs) {
        contentDiv.appendChild(reviewRefs.panel);
    }
    if (auditRefs) {
        contentDiv.appendChild(auditRefs.panel);
    }
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessagesIdobata.appendChild(wrapper);

    message.element = message.is_user ? textDiv : { text: textDiv, plan: planRefs, review: reviewRefs, audit: auditRefs };
    if (!message.is_user && message.plan) {
        updateMessagePlan(message, message.plan);
    }
    if (!message.is_user) {
        updateMessageReview(message);
        updateMessageAudit(message);
    }
}

function renderPlanningMessageInContainer(message, targetContainer, title) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ai-wrapper';

    const panelContainer = document.createElement('div');
    panelContainer.className = 'multi-agent-container';

    const header = document.createElement('div');
    header.className = 'multi-agent-header';
    header.innerHTML = `
        <span class="multi-agent-icon">🗣️</span>
        <strong>${title}</strong>
        <span class="message-time">${formatTime(message.timestamp)}</span>
    `;

    const planRefs = createExecutionPlanPanel();
    const routeInfoRefs = createRouteInfoPanel(message);
    const reviewRefs = createReviewPanel();
    const auditRefs = createAuditPanel();

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

    panelContainer.appendChild(header);
    if (routeInfoRefs) {
        panelContainer.appendChild(routeInfoRefs.panel);
    }
    panelContainer.appendChild(planRefs.panel);
    panelContainer.appendChild(grid);
    panelContainer.appendChild(reviewRefs.panel);
    panelContainer.appendChild(auditRefs.panel);
    wrapper.appendChild(panelContainer);
    targetContainer.appendChild(wrapper);

    message.element = {
        plan: planRefs,
        routeInfo: routeInfoRefs,
        review: reviewRefs,
        audit: auditRefs,
        planning: planningPanel.querySelector('[data-agent="planning"]'),
        tech: techPanel.querySelector('[data-agent="tech"]'),
        business: businessPanel.querySelector('[data-agent="business"]'),
        synthesis: synthesisPanel.querySelector('[data-agent="synthesis"]')
    };
    if (message.plan) {
        updateMultiAgentPlan(message, message.plan);
    }
    updateRouteInfoPanel(message);
    updateMessageReview(message);
    updateMessageAudit(message);
}

function renderPlanningMessage(message) {
    renderPlanningMessageInContainer(message, chatMessagesIdobata, t('idobata_planning_title'));
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

function setStatus(busy, action = 'general', statusKey = null) {
    isBusy = busy;
    isMultiAgent = action === 'multi_agent';
    
    setStreamingUi(busy);
    
    promptInput.disabled = busy;
    updateButtons();
    updateButtonsGuideline();
    updateButtonsIdobata();
    
    if (busy) {
        statusIndicator.style.display = 'flex';
        if (statusKey) {
            statusText.textContent = t(statusKey);
        } else if (action === 'multi_agent') {
            statusText.textContent = t('status_multi_agent_analyzing');
        } else if (action === 'guideline') {
            statusText.textContent = t('status_searching');
        } else if (action === 'idobata') {
            statusText.textContent = t('status_discussing');
        } else if (action === 'auto') {
            statusText.textContent = t('status_routing');
        } else {
            statusText.textContent = t('status_thinking');
        }
        
        // Swap button icon while streaming
        if (action === 'multi_agent') {
            multiAgentButton.innerHTML = '<span class="spinner-icon">⟳</span>';
        } else if (action === 'auto') {
            autoRouteButton.innerHTML = '<span class="spinner-icon">⟳</span>';
        } else {
            sendButton.innerHTML = '<span class="spinner-icon">⟳</span>';
        }
    } else {
        statusIndicator.style.display = 'none';
        sendButton.innerHTML = '<i class="fa-regular fa-paper-plane"></i>';
        autoRouteButton.innerHTML = '<i class="fas fa-compass"></i>';
        multiAgentButton.innerHTML = '<i class="fas fa-users"></i>';
    }
}

function getStatusKeyForRoute(mode) {
    if (mode === 'guideline') return 'status_searching';
    if (mode === 'multi_agent') return 'status_multi_agent_analyzing';
    if (mode === 'idobata') return 'status_discussing';
    return 'status_thinking';
}

function normalizeRouteDecision(route) {
    if (!route || typeof route !== 'object') {
        return { mode: 'general', reason: '', confidence: 0, fallback_used: true };
    }

    const mode = ['general', 'guideline', 'multi_agent', 'idobata'].includes(route.mode)
        ? route.mode
        : 'general';
    const reason = typeof route.reason === 'string' ? route.reason.trim() : '';
    const numericConfidence = Number(route.confidence);

    return {
        mode,
        reason,
        confidence: Number.isFinite(numericConfidence) ? Math.max(0, Math.min(numericConfidence, 1)) : 0,
        fallback_used: !!route.fallback_used,
    };
}

async function requestAutoRoute(prompt, modelId) {
    const response = await fetch('/api/chat/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            session_id: getRawSessionId('general'),
            model: modelId,
            context_mode: 'general',
            ...getAccessPayload(),
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return normalizeRouteDecision(await response.json());
}

async function startAutoRouteChat() {
    const prompt = promptInput.value.trim();
    if (!prompt || isBusy) return;

    const selectedModel = modelSelect.value;
    setStatus(true, 'auto', 'status_routing');

    let route;
    try {
        route = await requestAutoRoute(prompt, selectedModel);
    } catch (error) {
        route = normalizeRouteDecision({ mode: 'general', reason: error.message, confidence: 0, fallback_used: true });
    }

    const approved = await ensureApprovalBeforeRun(route.mode, selectedModel, promptInput);
    if (!approved) {
        setStatus(false);
        return;
    }

    promptInput.value = '';
    updateButtons();

    const storedUserContent = buildStoredUserContent(prompt, route);
    addUserMessageToGeneral(storedUserContent);
    const aiMessage = addAiMessageForRoute(route);

    setStatus(true, 'auto', getStatusKeyForRoute(route.mode));

    const requestExtras = {
        context_mode: 'general',
        stored_user_content: storedUserContent,
        route_mode: route.mode,
        route_reason: route.reason,
        route_confidence: route.confidence,
    };

    try {
        if (route.mode === 'guideline') {
            await streamGuidelineChat(prompt, aiMessage, {
                model: selectedModel,
                sessionId,
                endpoint: '/api/rag/stream',
                scrollFn: scrollToBottom,
                updateContentFn: updateMessageContent,
                updatePlanFn: updateMessagePlan,
                requestExtras,
            });
        } else if (route.mode === 'multi_agent') {
            await streamMultiAgentChat(prompt, aiMessage, {
                model: selectedModel,
                sessionId,
                endpoint: '/api/chat/multi-agent-stream',
                scrollFn: scrollToBottom,
                updatePlanFn: updateMultiAgentPlan,
                requestExtras,
            });
        } else if (route.mode === 'idobata') {
            await streamIdobataChat(prompt, aiMessage, {
                model: selectedModel,
                tone: 'balanced',
                sessionId,
                endpoint: '/api/chat/idobata-stream',
                scrollFn: scrollToBottom,
                updatePlanFn: updateMultiAgentPlan,
                requestExtras,
            });
        } else {
            await streamNormalChat(prompt, aiMessage, {
                model: selectedModel,
                sessionId,
                endpoint: '/api/chat/stream',
                scrollFn: scrollToBottom,
                updateContentFn: updateMessageContent,
                updatePlanFn: updateMessagePlan,
                requestExtras,
            });
        }
    } catch (error) {
        const errorMsg = `\n\n${t('error_prefix')}${error.message}`;
        if (route.mode === 'multi_agent') {
            aiMessage.synthesis_content = errorMsg;
            updateMultiAgentContent(aiMessage, 'Synthesizer', errorMsg);
        } else if (route.mode === 'idobata') {
            aiMessage.synthesis_content += errorMsg;
            updatePlanningContent(aiMessage, 'COO', errorMsg);
        } else {
            updateMessageContent(aiMessage, `${aiMessage.content || ''}${errorMsg}`);
        }
    } finally {
        aiMessage.is_streaming = false;
        aiMessage.critical_streaming = false;
        aiMessage.positive_streaming = false;
        aiMessage.synthesis_streaming = false;

        if (!aiMessage.is_multi_agent && !aiMessage.is_planning) {
            updateMessageContent(aiMessage, aiMessage.content);
        }
        setStatus(false);
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
    
    setStatus(true, multiAgent ? 'multi_agent' : 'general');
    
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

async function streamNormalChat(prompt, aiMessage, options = {}) {
    const selectedModel = options.model || modelSelect.value;
    const endpoint = options.endpoint || '/api/chat/stream';
    const sessionKey = options.sessionId || sessionId;
    const scrollFn = options.scrollFn || scrollToBottom;
    const updateContentFn = options.updateContentFn || updateMessageContent;
    const updatePlanFn = options.updatePlanFn || updateMessagePlan;
    const body = {
        prompt,
        session_id: sessionKey,
        model: selectedModel,
        ...getAccessPayload(),
        ...options.requestExtras,
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
            updatePlanFn(aiMessage, data.plan);
            scrollFn();
        } else if (data.type === 'delta' && data.content) {
            aiMessage.content += data.content;
            updateContentFn(aiMessage, aiMessage.content);
            scrollFn();
        } else if (data.type === 'trace' && data.trace) {
            aiMessage.traces = [...(aiMessage.traces || []), data.trace];
            updateGuidelineDiagnostics(aiMessage);
            scrollFn();
        } else if (data.type === 'evidence' && data.evidence) {
            aiMessage.evidence = data.evidence;
            updateGuidelineDiagnostics(aiMessage);
            scrollFn();
        } else if (data.type === 'review' && data.review) {
            updateMessageReview(aiMessage, data.review);
            scrollFn();
        } else if (data.type === 'audit' && data.audit) {
            updateMessageAudit(aiMessage, data.audit);
            refreshAuditDashboard();
            scrollFn();
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

async function streamMultiAgentChat(prompt, aiMessage, options = {}) {
    const selectedModel = options.model || modelSelect.value;
    const endpoint = options.endpoint || '/api/chat/multi-agent-stream';
    const sessionKey = options.sessionId || sessionId;
    const scrollFn = options.scrollFn || scrollToBottom;
    const updatePlanFn = options.updatePlanFn || updateMultiAgentPlan;
    const body = {
        prompt,
        session_id: sessionKey,
        model: selectedModel,
        ...getAccessPayload(),
        ...options.requestExtras,
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
            updatePlanFn(aiMessage, data.plan);
            scrollFn();
        } else if (data.type === 'review' && data.review) {
            updateMessageReview(aiMessage, data.review);
            scrollFn();
        } else if (data.type === 'audit' && data.audit) {
            updateMessageAudit(aiMessage, data.audit);
            refreshAuditDashboard();
            scrollFn();
        } else if (data.type === 'synthesis_start') {
            aiMessage.synthesis_streaming = true;
        } else if (data.agent && data.content) {
            updateMultiAgentContent(aiMessage, data.agent, data.content);
            scrollFn();
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

async function streamIdobataChat(prompt, aiMessage, options = {}) {
    const selectedModel = options.model || modelSelectIdobata.value;
    const selectedTone = options.tone || toneSelectIdobata.value;
    const endpoint = options.endpoint || '/api/chat/idobata-stream';
    const sessionKey = options.sessionId || sessionIdIdobata;
    const scrollFn = options.scrollFn || scrollToBottomIdobata;
    const updatePlanFn = options.updatePlanFn || updateMultiAgentPlan;
    const body = {
        prompt,
        session_id: sessionKey,
        model: selectedModel,
        tone: selectedTone,
        ...getAccessPayload(),
        ...options.requestExtras,
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
            updatePlanFn(aiMessage, data.plan);
            scrollFn();
        } else if (data.type === 'review' && data.review) {
            updateMessageReview(aiMessage, data.review);
            scrollFn();
        } else if (data.type === 'audit' && data.audit) {
            updateMessageAudit(aiMessage, data.audit);
            refreshAuditDashboard();
            scrollFn();
        } else if (data.agent && data.content) {
            updatePlanningContent(aiMessage, data.agent, data.content);
            scrollFn();
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
        body: JSON.stringify({ session_id: sessionId, mode: 'general', ...getAccessPayload() })
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
        body: JSON.stringify({ session_id: sessionIdIdobata, mode: 'idobata', ...getAccessPayload() })
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
        body: JSON.stringify({ session_id: sessionIdGuideline, mode: 'guideline', ...getAccessPayload() })
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
        review: null,
        audit: null,
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
    let reviewRefs = null;
    let diagnosticsRefs = null;
    let auditRefs = null;

    if (!message.is_user) {
        planRefs = createExecutionPlanPanel();
        reviewRefs = createReviewPanel();
        diagnosticsRefs = createDiagnosticsPanel();
        auditRefs = createAuditPanel();
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
    if (reviewRefs) {
        contentDiv.appendChild(reviewRefs.panel);
    }
    if (auditRefs) {
        contentDiv.appendChild(auditRefs.panel);
    }
    if (diagnosticsRefs) {
        contentDiv.appendChild(diagnosticsRefs.panel);
    }
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    wrapper.appendChild(messageDiv);
    chatMessagesGuideline.appendChild(wrapper);
    
    message.element = message.is_user ? textDiv : { text: textDiv, plan: planRefs, review: reviewRefs, audit: auditRefs, diagnostics: diagnosticsRefs };
    if (!message.is_user && message.plan) {
        updateMessagePlan(message, message.plan);
    }
    if (!message.is_user) {
        updateMessageReview(message);
        updateMessageAudit(message);
        if (message.traces.length || message.evidence.length) {
            updateGuidelineDiagnostics(message);
        }
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

async function streamGuidelineChat(prompt, aiMessage, options = {}) {
    const selectedModel = options.model || modelSelectGuideline.value;
    const endpoint = options.endpoint || '/api/rag/stream';
    const sessionKey = options.sessionId || sessionIdGuideline;
    const scrollFn = options.scrollFn || scrollToBottomGuideline;
    const updateContentFn = options.updateContentFn || updateMessageContentGuideline;
    const updatePlanFn = options.updatePlanFn || updateMessagePlan;
    const body = {
        prompt,
        session_id: sessionKey,
        model: selectedModel,
        ...options.requestExtras,
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
            updatePlanFn(aiMessage, data.plan);
            scrollFn();
        } else if (data.type === 'delta' && data.content) {
            aiMessage.content += data.content;
            updateContentFn(aiMessage, aiMessage.content);
            scrollFn();
        } else if (data.type === 'trace' && data.trace) {
            aiMessage.traces = [...(aiMessage.traces || []), data.trace];
            updateGuidelineDiagnostics(aiMessage);
            scrollFn();
        } else if (data.type === 'evidence' && data.evidence) {
            aiMessage.evidence = data.evidence;
            updateGuidelineDiagnostics(aiMessage);
            scrollFn();
        } else if (data.type === 'review' && data.review) {
            updateMessageReview(aiMessage, data.review);
            scrollFn();
        } else if (data.type === 'audit' && data.audit) {
            updateMessageAudit(aiMessage, data.audit);
            refreshAuditDashboard();
            scrollFn();
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

void initializeApp().catch(error => {
    console.error('App initialization error:', error);
});
