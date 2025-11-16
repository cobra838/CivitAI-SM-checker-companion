const fileInput = document.getElementById('fileInput');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');
const log = document.getElementById('log');
const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');
const dropZone = document.getElementById('dropZone');
const dropZoneText = document.getElementById('dropZoneText');
const dropZoneHint = document.getElementById('dropZoneHint');

const storageAPI = (typeof browser !== 'undefined') ? browser.storage.local : chrome.storage.local;
const i18n = new I18n();

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

function updateUI() {
  title.textContent = `🔍 ${i18n.t('title')}`;
  subtitle.textContent = i18n.t('subtitle');
  dropZoneText.textContent = i18n.t('dropZoneTitle');
  dropZoneHint.textContent = i18n.t('dropZoneHint');
  clearBtn.textContent = `🗑️ ${i18n.t('clearCache')}`;
  
  if (i18n.currentLocale === 'ar') {
    document.body.setAttribute('dir', 'rtl');
  }
  
  addLog(i18n.t('logBrowser') + ': ' + (typeof browser !== 'undefined' ? 'Firefox' : 'Chrome/Edge'));
}

storageAPI.get('modelsCache').then(result => {
  if (result.modelsCache) {
    const count = Object.keys(JSON.parse(result.modelsCache)).length;
    showStatus(i18n.t('modelsInCache', { count }), 'success');
  } else {
    showStatus(i18n.t('cacheEmpty'), 'info');
  }
});

dropZone.addEventListener('click', () => {
  addLog(i18n.t('logOpeningDialog'));
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  addLog(i18n.t('logScanning'));
  const files = Array.from(e.target.files);
  addLog(i18n.t('logFilesCount', { count: files.length }));
  await processFiles(files);
  fileInput.value = '';
});

async function processFiles(files) {
  if (files.length === 0) {
    showStatus(i18n.t('noFilesSelected'), 'error');
    return;
  }
  
  showStatus(i18n.t('processingFiles', { count: files.length }), 'info');
  
  const modelsCache = {};
  let count = 0;
  
  for (const file of files) {
    if (!file.name.endsWith('.cm-info.json')) continue;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.ModelId && data.VersionId) {
        const key = `${data.ModelId}-${data.VersionId}`;
        modelsCache[key] = {
          modelId: data.ModelId,
          versionId: data.VersionId,
          modelName: data.ModelName,
          versionName: data.VersionName,
          baseModel: data.BaseModel,
          type: data.ModelType,
          importedAt: data.ImportedAt || null
        };
        count++;
        addLog(`✅ ${data.ModelName}`);
      }
    } catch (err) {
      addLog(`❌ ${file.name}`);
    }
  }
  
  if (count === 0) {
    showStatus(i18n.t('noValidFiles'), 'error');
    return;
  }
  
  await storageAPI.set({ modelsCache: JSON.stringify(modelsCache) });
  showStatus(i18n.t('modelsLoaded', { count }), 'success');
  addLog(i18n.t('logTotal', { count }));
}

clearBtn.addEventListener('click', async () => {
  await storageAPI.remove('modelsCache');
  showStatus(i18n.t('cacheCleared'), 'info');
  addLog(i18n.t('cacheCleared'));
});

updateUI();