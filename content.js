(function() {
    'use strict';

    const name_for_log = '[Civitai Checker]';

    let contextMenu = null;
    let currentContextKey = '';

    let modelsCache = {};
    let cacheBuilt = false;
    let i18n = null;
    let currentVersionId = null;
    let downloadManager = null;

    init();

    async function init() {
        console.log(`${name_for_log} Initialization...`);

        // Initialize i18n
        i18n = new I18n();
        await new Promise(resolve => setTimeout(resolve, 100));

        // Initialize download manager
        downloadManager = new DownloadManager();
        await downloadManager.init();

        // Track URL changes
        (function hijackHistory() {
            const pushState = history.pushState;
            history.pushState = function() {
                pushState.apply(history, arguments);
                window.dispatchEvent(new Event('civitai-urlchange'));
            };
            window.addEventListener('civitai-urlchange', () => {
                if (location.pathname.includes('/models/')) {
                    setTimeout(() => checkCurrentModel(), 300);
                }
            });
        })();

        // Track version parameter changes
        (function watchVersionParam() {
            let lastSearch = location.search;
            setInterval(() => {
                if (location.search !== lastSearch && location.pathname.includes('/models/')) {
                    lastSearch = location.search;
                    console.log(`${name_for_log} 🔄 Version parameter changed:`, lastSearch);
                    setTimeout(() => checkCurrentModel(), 300);
                }
            }, 500);
        })();

        // Load cache from storage
        await loadCache();

        await waitForElement('.mantine-Title-root');
        await checkCurrentModel();

        function createContextMenu() {
            if (contextMenu) return;
            contextMenu = document.createElement('div');
            contextMenu.id = 'cc-context-menu';
            contextMenu.style.cssText = `
            position:absolute;z-index:999999;background:#fff;border:1px solid #ccc;
            border-radius:6px;padding:4px 0;box-shadow:0 2px 8px rgba(0,0,0,.25);
            display:none;font-size:13px;font-weight:600;color:#d32f2f;cursor:pointer;
          `;
            contextMenu.innerHTML = `<div style="padding:6px 12px;">${i18n.t('removeFromCache')}</div>`;
            document.body.appendChild(contextMenu);

            contextMenu.firstElementChild.onclick = async () => {
                if (!currentContextKey) return;

                console.log(`${name_for_log} Before delete modelsCache keys:`, Object.keys(modelsCache).length);

                // Use Storage API to remove from cache
                await StorageAPI.cache.remove(currentContextKey);

                console.log(`${name_for_log} After delete modelsCache keys:`, Object.keys(modelsCache).length - 1);

                // Reload local cache
                await loadCache();

                // Redraw indicator
                checkCurrentModel();

                // Hide menu
                contextMenu.style.display = 'none';
            };

            // Hide menu on click anywhere
            document.addEventListener('click', () => contextMenu.style.display = 'none', {
                capture: true
            });
        }

        createContextMenu();
    }

    async function loadCache() {
        modelsCache = await StorageAPI.cache.load();
        cacheBuilt = true;

        const count = Object.keys(modelsCache).length;
        console.log(`${name_for_log} Cache loaded:`, count, 'models');

        if (count === 0) {
            showNotification(i18n.t('cacheEmptyNotification'), 'info');
        }
    }

    async function checkCurrentModel() {
        if (!cacheBuilt) return;

        try {
            const versionId = await getCurrentVersionId();
            if (!versionId) {
                console.log(`${name_for_log} Failed to determine Version ID`);
                return;
            }

            currentVersionId = versionId;
            console.log(`${name_for_log} Version ID:`, versionId);

            const modelInfo = await downloadManager.getModelInfo(versionId);
            if (!modelInfo) {
                console.log(`${name_for_log} Failed to get model info`);
                return;
            }

            const modelId = modelInfo.modelId;
            const key = `${modelId}-${modelInfo.modelVersionId}`;
            const isDownloaded = modelsCache.hasOwnProperty(key);

            console.log(`${name_for_log} Model ID:`, modelId, 'Downloaded:', isDownloaded);

            addIndicator(isDownloaded, modelsCache[key], versionId, modelInfo, key);
        } catch (e) {
            console.warn(`${name_for_log} Model check error:`, e);
        }
    }

    async function getCurrentVersionId() {
        // First try to get from URL
        const urlParams = new URLSearchParams(window.location.search);
        const versionIdFromUrl = urlParams.get('modelVersionId');

        if (versionIdFromUrl) {
            const id = parseInt(versionIdFromUrl, 10);
            console.log(`${name_for_log} ✅ VersionId from URL:`, id);
            return id;
        }

        // If not in URL - search in performance (for default version)
        console.log(`${name_for_log} 🔍 Waiting 1 second for request...`);
        await new Promise(r => setTimeout(r, 1000));

        console.log(`${name_for_log} 🔍 Looking for VersionId in performance entries...`);
        const entries = performance.getEntriesByType('resource');

        for (const entry of entries) {
            const url = entry.name;
            if (url.includes('modelVersion.getById')) {
                const decoded = decodeURIComponent(url);
                console.log(`${name_for_log} 📡 Request found:`, decoded);
                const match = decoded.match(/"id"\s*:\s*(\d+)/);
                if (match) {
                    const id = parseInt(match[1], 10);
                    console.log(`${name_for_log} ✅ Extracted VersionId:`, id);
                    return id;
                }
            }
        }

        console.log(`${name_for_log} ❌ VersionId not found`);
        return null;
    }

    function formatTimestamp(isoString) {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    async function handleDownload(versionId, modelInfo) {
        try {
            showNotification(i18n.t('downloading'), 'info');
            await downloadManager.downloadModel(versionId, modelInfo);
            // showNotification(i18n.t('downloadComplete'), 'success');

            // Reload cache and update indicator
            await loadCache();
            await checkCurrentModel();
        } catch (e) {
            console.error(`${name_for_log} Download error:`, e);
            showNotification(i18n.t('downloadError'), 'error');
        }
    }

    function addIndicator(isDownloaded, modelData, versionId, modelInfo, key) {
        const titleElement = document.querySelector('.mantine-Title-root');
        if (!titleElement) return;

        const oldIndicator = document.getElementById('civitai-checker-indicator');
        if (oldIndicator) oldIndicator.remove();

        const indicator = document.createElement('div');
        indicator.id = 'civitai-checker-indicator';
        indicator.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-left: 12px;
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: ${isDownloaded ? 'linear-gradient(135deg, #2dd4bf, #22c55e)' : '#374151'};
            line-height: 1;
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,.25);
            transition: all .2s ease;
            cursor: ${isDownloaded ? 'default' : 'pointer'};
            user-select: none;
        `;

        if (isDownloaded) {
            const imported = modelData.importedAt ? formatTimestamp(modelData.importedAt) : '';
            indicator.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                <span>${modelData.versionName || 'Downloaded'}</span>
            `;
            indicator.title = `${i18n.t('tooltipModel')}: ${modelData.modelName}\n${i18n.t('tooltipVersion')}: ${modelData.versionName}\n${i18n.t('tooltipType')}: ${modelData.type}\n${i18n.t('tooltipImport')}: ${imported}`;
            indicator.style.cursor = 'default';

            indicator.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                currentContextKey = key;
                contextMenu.style.left = e.pageX + 'px';
                contextMenu.style.top = e.pageY + 'px';
                contextMenu.style.display = 'block';
            });
        } else {
            const versionName = modelInfo?.modelVersionName || i18n.t('download');
            indicator.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/>
                    <path d="M7 11l5 5l5 -5"/>
                    <path d="M12 4l0 12"/>
                </svg>
                <span>${versionName}</span>
            `;
            indicator.title = `${i18n.t('tooltipModel')}: ${modelInfo.modelName}\n${i18n.t('tooltipVersion')}: ${modelInfo.modelVersionName}\n${i18n.t('tooltipType')}: ${modelInfo.type}\n\n${i18n.t('clicktodownload')}`;

            // Add click handler for download
            indicator.addEventListener('click', async () => {
                if (versionId && !indicator.dataset.downloading) {
                    indicator.dataset.downloading = 'true';
                    indicator.style.opacity = '0.7';
                    indicator.style.cursor = 'wait';
                    indicator.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10" opacity="0.25"/>
                            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round">
                                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/>
                            </path>
                        </svg>
                        <span>${i18n.t('downloading')}</span>
                    `;

                    await handleDownload(versionId, modelInfo);

                    delete indicator.dataset.downloading;
                }
            });
        }

        titleElement.parentElement.appendChild(indicator);

        // Hover effects
        indicator.onmouseenter = () => {
            if (!indicator.dataset.downloading && !isDownloaded) {
                indicator.style.transform = 'scale(1.05)';
                indicator.style.background = '#4b5563';
            } else if (isDownloaded) {
                indicator.style.transform = 'scale(1.05)';
            }
        };
        indicator.onmouseleave = () => {
            if (!indicator.dataset.downloading && !isDownloaded) {
                indicator.style.transform = 'scale(1)';
                indicator.style.background = '#374151';
            } else if (isDownloaded) {
                indicator.style.transform = 'scale(1)';
            }
        };
    }

    function showNotification(message, type = 'info') {
        const colors = {
            info: '#339af0',
            success: '#37b24d',
            error: '#f03e3e'
        };

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            padding: 16px 24px;
            border-radius: 8px;
            background: ${colors[type]};
            color: white;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;

        if (!document.getElementById('civitai-checker-styles')) {
            const style = document.createElement('style');
            style.id = 'civitai-checker-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.transition = 'opacity 0.3s';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            if (document.querySelector(selector)) {
                return resolve(document.querySelector(selector));
            }

            const observer = new MutationObserver(() => {
                if (document.querySelector(selector)) {
                    observer.disconnect();
                    resolve(document.querySelector(selector));
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                resolve(null);
            }, timeout);
        });
    }

})();