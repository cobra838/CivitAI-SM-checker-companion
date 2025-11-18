const fileInput = document.getElementById('fileInput');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');
const log = document.getElementById('log');
const title = document.getElementById('title');
const selectBtn = document.getElementById('selectBtn');

// Download settings elements
const customTemplateGroup = document.getElementById('customTemplateGroup');
const customTemplate = document.getElementById('customTemplate');
const autoAddToCache = document.getElementById('autoAddToCache');
const alwaysAskLocation = document.getElementById('alwaysAskLocation');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const i18n = new I18n();
const downloadManager = new DownloadManager();

let logMessages = [];

function addLog(message) {
    console.log('[Popup]', message);
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

async function updateUI() {
    title.textContent = `${i18n.t('title')}`;
    selectBtn.textContent = `${i18n.t('selectFolder')}`;
    clearBtn.textContent = `${i18n.t('clearCache')}`;

    // Translate section titles
    document.getElementById('cacheSection').textContent = `${i18n.t('cacheSection')}`;
    document.getElementById('downloadSection').textContent = `${i18n.t('downloadSection')}`;

    // Translate labels
    document.getElementById('customTemplateLabel').textContent = i18n.t('customTemplateLabel');
    document.getElementById('autoAddLabel').textContent = i18n.t('autoAddLabel');
    document.getElementById('alwaysAskLabel').textContent = i18n.t('alwaysAskLabel');
    document.getElementById('saveSettingsText').textContent = i18n.t('saveSettings');


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

    customTemplate.value = settings.fileNameTemplate;

    autoAddToCache.checked = settings.autoAddToCache;
    alwaysAskLocation.checked = settings.alwaysAskSaveLocation;
}

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
    const settings = {
        fileNameTemplate: customTemplate.value,
        autoAddToCache: autoAddToCache.checked,
        alwaysAskSaveLocation: alwaysAskLocation.checked
    };

    await downloadManager.saveSettings(settings);
    showStatus(i18n.t('settingsSaved'), 'success');

    setTimeout(() => {
        status.style.display = 'none';
    }, 3000);
});

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

selectBtn.addEventListener('click', () => {
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