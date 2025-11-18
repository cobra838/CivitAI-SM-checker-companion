const actionAPI = typeof browser !== 'undefined' ? browser.action : chrome.action;
const runtimeAPI = typeof browser !== 'undefined' ? browser.runtime : chrome.runtime;
const downloadsAPI = typeof browser !== 'undefined' ? browser.downloads : chrome.downloads;
const storageAPI = typeof browser !== 'undefined' ? browser.storage.local : chrome.storage.local;

actionAPI.onClicked.addListener(() => {
    if (typeof browser !== 'undefined') {
        browser.runtime.openOptionsPage();
    } else {
        chrome.runtime.openOptionsPage();
    }
});

// Listen for download requests from content script
runtimeAPI.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'download') {
        console.log('[Background] Download request received:', request);

        const downloadOptions = {
            url: request.url,
            conflictAction: 'uniquify'
        };

        // If filename is specified in the request, use it
        if (request.fileName) {
            downloadOptions.filename = request.fileName;
        }

        // If settings specify to always ask for save location
        if (request.settings && request.settings.alwaysAskSaveLocation) {
            downloadOptions.saveAs = true;
        }

        // Initiate download with Chrome/Firefox downloads API
        downloadsAPI.download(downloadOptions)
            .then((downloadId) => {
                console.log('[Background] Download started with ID:', downloadId);

                // Save download information for tracking
                storageAPI.get('activeDownloads').then(result => {
                    const activeDownloads = result.activeDownloads || {};
                    activeDownloads[downloadId] = {
                        versionId: request.versionId,
                        modelInfo: request.modelInfo,
                        startTime: Date.now()
                    };
                    storageAPI.set({
                        activeDownloads
                    });
                });

                sendResponse({
                    success: true,
                    downloadId: downloadId
                });
            })
            .catch((error) => {
                console.error('[Background] Download error:', error);
                sendResponse({
                    success: false,
                    error: error.message || error.toString()
                });
            });

        // Return true to indicate we'll send response asynchronously
        return true;
    }
});

// Track download completion
downloadsAPI.onChanged.addListener((delta) => {
    if (delta.state && delta.state.current === 'complete') {
        console.log('[Background] Download completed:', delta?.id || 'unknown');

        // Can add additional logic on completion
        storageAPI.get('activeDownloads').then(result => {
            const activeDownloads = result.activeDownloads || {};
            const downloadInfo = activeDownloads[delta.id];

            if (downloadInfo) {
                console.log('[Background] Download info:', downloadInfo);

                // Notify about successful completion
                if (typeof browser !== 'undefined') {
                    browser.notifications.create({
                        type: 'basic',
                        iconUrl: 'icons/icon-48.png',
                        title: 'Civitai Model Checker',
                        message: `Downloaded: ${downloadInfo.modelInfo.modelName}`
                    });
                }

                // Remove from active downloads
                delete activeDownloads[delta.id];
                storageAPI.set({
                    activeDownloads
                });
            }
        });
    } else if (delta.state && delta.state.current === 'interrupted') {
        const id = delta?.id ?? 'unknown';
        console.log('[Background] Download interrupted:', id);

        // Clean up information about interrupted download
        storageAPI.get('activeDownloads').then(result => {
            const activeDownloads = result.activeDownloads || {};
            delete activeDownloads[delta.id];
            storageAPI.set({
                activeDownloads
            });
        });
    }
});