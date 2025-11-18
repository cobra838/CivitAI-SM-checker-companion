const fileInput = document.getElementById('fileInput');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');
const log = document.getElementById('log');
const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');
const dropZone = document.getElementById('dropZone');
const dropZoneText = document.getElementById('dropZoneText');
const dropZoneHint = document.getElementById('dropZoneHint');

// Download settings elements
const templateSelect = document.getElementById('templateSelect');
const customTemplateGroup = document.getElementById('customTemplateGroup');
const customTemplate = document.getElementById('customTemplate');
const autoAddToCache = document.getElementById('autoAddToCache');
const alwaysAskLocation = document.getElementById('alwaysAskLocation');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
// const resetSettingsBtn = document.getElementById('resetSettingsBtn');

// Tab management
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

const i18n = new I18n();
const downloadManager = new DownloadManager();

let logMessages = [];

function addLog(message) {
    console.log('[Options]', message);
    logMessages.push(message);
    log.textContent = logMessages.join('\n');
    log.style.display = 'block';
    // log.scrollTop = log.scrollHeight; - комментарию для скорости
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = type;
    addLog(`[${type.toUpperCase()}] ${message}`);
}

// Tab switching
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        // Remove active from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));

        // Add active to clicked tab
        tab.classList.add('active');
        document.querySelector(`[data-content="${tabName}"]`).classList.add('active');
    });
});

async function updateUI() {
    // Main text
    title.textContent = `${i18n.t('title')}`;
    subtitle.textContent = i18n.t('subtitle');
    dropZoneText.textContent = i18n.t('dropZoneTitle');
    dropZoneHint.textContent = i18n.t('dropZoneHint');

    // Tabs
    document.getElementById('tabCache').textContent = `${i18n.t('tabCache')}`;
    document.getElementById('tabDownload').textContent = ` ${i18n.t('tabDownload')}`;

    // Section titles
    document.getElementById('fileNamingTitle').textContent = i18n.t('fileNamingTitle');
    document.getElementById('downloadBehaviorTitle').textContent = i18n.t('downloadBehaviorTitle');

    clearBtn.textContent = `${i18n.t('clearCache')}`;
    saveSettingsBtn.textContent = `${i18n.t('saveSettings')}`;
    // resetSettingsBtn.textContent = `${i18n.t('resetSettings')}`;

    // Labels
    document.getElementById('templateLabel').textContent = i18n.t('templateLabel');
    document.getElementById('customTemplateLabel').textContent = i18n.t('customTemplateLabel');
    document.getElementById('autoAddLabel').textContent = i18n.t('autoAddLabel');
    document.getElementById('alwaysAskLabel').textContent = i18n.t('alwaysAskLabel');

    // Help text
    document.getElementById('autoAddHelp').textContent = i18n.t('autoAddHelp');
    document.getElementById('alwaysAskHelp').textContent = i18n.t('alwaysAskHelp');

    // Template variables
    document.getElementById('templateVariablesTitle').textContent = i18n.t('templateVariablesTitle');
    document.getElementById('varModelName').textContent = i18n.t('templateVarModelName');
    document.getElementById('varVersionName').textContent = i18n.t('templateVarVersionName');
    document.getElementById('varModelId').textContent = i18n.t('templateVarModelId');
    document.getElementById('varVersionId').textContent = i18n.t('templateVarVersionId');
    document.getElementById('varType').textContent = i18n.t('templateVarType');
    document.getElementById('varBaseModel').textContent = i18n.t('templateVarBaseModel');
    document.getElementById('varCreatedAt').textContent = i18n.t('templateVarCreatedAt');
    document.getElementById('varUpdatedAt').textContent = i18n.t('templateVarUpdatedAt');
    document.getElementById('varCreatedTime').textContent = i18n.t('templateVarCreatedTime');
    document.getElementById('varUpdatedTime').textContent = i18n.t('templateVarUpdatedTime');
    document.getElementById('varOriginalFileName').textContent = i18n.t('templateVarOriginalFileName');
    document.getElementById('varAuthor').textContent = i18n.t('templateAuthor');

    // Select options
    document.getElementById('optDefault').textContent = i18n.t('templateDefault');
    document.getElementById('optDetailed').textContent = i18n.t('templateDetailed');
    document.getElementById('optSimple').textContent = i18n.t('templateSimple');
    document.getElementById('optIdBased').textContent = i18n.t('templateIdBased');
    document.getElementById('optTypePrefix').textContent = i18n.t('templateTypePrefix');
    document.getElementById('optFull').textContent = i18n.t('templateFull');
    document.getElementById('optCustom').textContent = i18n.t('templateCustom');

    if (i18n.currentLocale === 'ar') {
        document.body.setAttribute('dir', 'rtl');
    }

    addLog(i18n.t('logBrowser') + ': ' + (typeof browser !== 'undefined' ? 'Firefox' : 'Chrome/Edge'));

    // Load download settings
    await loadDownloadSettings();
}

async function loadDownloadSettings() {
    await downloadManager.init();
    const settings = downloadManager.settings;

    // Determine selected template
    const templates = downloadManager.getFileNameTemplates();
    let selectedTemplate = 'default';

    for (const [key, value] of Object.entries(templates)) {
        if (value === settings.fileNameTemplate) {
            selectedTemplate = key;
            break;
        }
    }

    // If not found in presets - it's custom
    if (selectedTemplate === 'default' && settings.fileNameTemplate !== templates.default) {
        selectedTemplate = 'custom';
        customTemplate.value = settings.fileNameTemplate;
        customTemplateGroup.classList.add('active');
    }

    templateSelect.value = selectedTemplate;
    autoAddToCache.checked = settings.autoAddToCache;
    alwaysAskLocation.checked = settings.alwaysAskSaveLocation;
}

// Show/hide custom template input
templateSelect.addEventListener('change', () => {
    if (templateSelect.value === 'custom') {
        customTemplateGroup.classList.add('active');
    } else {
        customTemplateGroup.classList.remove('active');
    }
});

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
    const templates = downloadManager.getFileNameTemplates();
    let fileNameTemplate;

    if (templateSelect.value === 'custom') {
        fileNameTemplate = customTemplate.value || templates.default;
    } else {
        fileNameTemplate = templates[templateSelect.value];
    }

    const settings = {
        fileNameTemplate: fileNameTemplate,
        autoAddToCache: autoAddToCache.checked,
        alwaysAskSaveLocation: alwaysAskLocation.checked
    };

    await downloadManager.saveSettings(settings);
    showStatus(i18n.t('settingsSaved'), 'success');

    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
});

// Reset settings to defaults
// resetSettingsBtn.addEventListener('click', async () => {
// await downloadManager.saveSettings(downloadManager.defaultSettings);
// await loadDownloadSettings();
// showStatus(i18n.t('settingsReset'), 'success');
// });

// Load cache status
(async () => {
    const stats = await StorageAPI.cache.getStats();
    if (stats.count > 0) {
        showStatus(i18n.t('modelsInCache', {
            count: stats.count
        }), 'success');
    } else {
        showStatus(i18n.t('cacheEmpty'), 'info');
    }
})();

dropZone.addEventListener('click', () => {
    addLog(i18n.t('logOpeningDialog'));
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    addLog(i18n.t('logScanning'));
    const files = Array.from(e.target.files);
    addLog(i18n.t('logFilesCount', {
        count: files.length
    }));
    await processFiles(files);
    fileInput.value = '';
});

async function processFiles(files) {
    if (files.length === 0) {
        showStatus(i18n.t('noFilesSelected'), 'error');
        return;
    }

    showStatus(i18n.t('processingFiles', {
        count: files.length
    }), 'info');

    // Use Storage API to process files
    const result = await StorageAPI.files.process(files);

    // Log successful models
    Object.values(result.models).forEach(model => {
        addLog(`✅ ${model.modelName}`);
    });

    // Log errors
    result.errors.forEach(err => {
        addLog(`❌ ${err.file}`);
    });

    if (!result.success) {
        showStatus(i18n.t('noValidFiles'), 'error');
        return;
    }

    showStatus(i18n.t('modelsLoaded', {
        count: result.count
    }), 'success');
    addLog(i18n.t('logTotal', {
        count: result.count
    }));
}

clearBtn.addEventListener('click', async () => {
    await StorageAPI.cache.clear();
    showStatus(i18n.t('cacheCleared'), 'info');
    addLog(i18n.t('cacheCleared'));
});

updateUI();