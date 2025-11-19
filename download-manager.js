const name_for_log = '[Civitai Checker DownloadManager]';

/**
 * Download Manager - model download management
 */
class DownloadManager {
    constructor() {
        this.storageAPI = (typeof browser !== 'undefined') ? browser.storage.local : chrome.storage.local;
        this.runtimeAPI = (typeof browser !== 'undefined') ? browser.runtime : chrome.runtime;
        this.settings = null;
        this.defaultSettings = {
            fileNameTemplate: '[{author}] {base_model} - {file_name} ({created_at}_{created_time})',
            autoAddToCache: true,
            alwaysAskSaveLocation: true,
            downloadPrimaryFile: true
        };
    }

    /**
     * Initialization - load settings
     */
    async init() {
        await this.loadSettings();
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        const result = await this.storageAPI.get('downloadSettings');
        this.settings = result.downloadSettings || this.defaultSettings;
        return this.settings;
    }

    /**
     * Save settings
     */
    async saveSettings(settings) {
        this.settings = {
            ...this.defaultSettings,
            ...settings
        };
        await this.storageAPI.set({
            downloadSettings: this.settings
        });
    }

    /**
     * Format ISO date to readable string
     */
    formatDate(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
    /**
     * Format ISO date to time string
     */
    formatTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${hours}-${minutes}-${seconds}`; // HH-MM-SS
    }

    /**
     * Get file extension from filename
     */
    getFileExtension(file) {
        if (!file || !file.name) return '';

        // Extract extension from filename
        const match = file.name.match(/(\.[^.]+)$/);
        return match ? match[1].toLowerCase() : '';
    }

    /**
     * Generate filename from template
     * Available variables:
     * {model_name}, {created_at}, {updated_at}, {created_time}, {updated_time}, {author}, {base_model},
     * {file_name}, {file_id}, {model_id}, {model_version_id}, {model_version_name}, {model_type}
     */
    generateFileName(modelData, template = null) {
        const tmpl = template || this.settings.fileNameTemplate;

        const variables = {
            model_name: this.sanitizeFileName(modelData.modelName),
            created_at: this.formatDate(modelData.createdAt),
            updated_at: this.formatDate(modelData.updatedAt),
            created_time: this.formatTime(modelData.createdAt),
            updated_time: this.formatTime(modelData.updatedAt),
            author: this.sanitizeFileName(modelData.username),
            base_model: this.sanitizeFileName(modelData.baseModel),
            file_name: this.sanitizeFileName(this.getFileNameWithoutExtension(modelData.fileName)),
            file_id: String(modelData.fileId || '_'),
            model_id: String(modelData.modelId || '_'),
            model_version_id: String(modelData.modelVersionId || '_'),
            model_version_name: this.sanitizeFileName(modelData.modelVersionName),
            model_type: this.sanitizeFileName(modelData.type)
        };

        let fileName = tmpl;
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            fileName = fileName.replace(regex, variables[key]);
        });

        // Remove extra characters and spaces
        fileName = fileName.replace(/_{2,}/g, '_');

        // Add extension from original file name
        const extension = this.getFileExtension(modelData.primaryFile);
        fileName += extension;

        return fileName;
    }

    /**
     * Get filename without extension
     */
    getFileNameWithoutExtension(fileName) {
        if (!fileName) return '_';
        return fileName.replace(/\.[^/.]+$/, '');
    }

    /**
     * Sanitize filename by removing invalid characters
     */
    sanitizeFileName(name) {
        if (!name || typeof name !== 'string') {
            return '_';
        }
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            // .replace(/\s+/g, '_')
            .trim();
    }

    /**
     * Get model information from API
     */
    async getModelInfo(versionId) {
        try {
            // First get basic version information to find out the modelId
            const versionUrl = `https://civitai.com/api/trpc/modelVersion.getById?input=${encodeURIComponent(JSON.stringify({json:{id:versionId,authed:true}}))}`;
            const versionResponse = await fetch(versionUrl);
            const versionData = await versionResponse.json();
            const modelId = versionData.result?.data?.json?.model?.id;

            if (!modelId) return null;

            // Now get the full information via model.GetById
            const modelUrl = `https://civitai.com/api/trpc/model.getById?input=${encodeURIComponent(JSON.stringify({json:{id:modelId,authed:true}}))}`;
            const modelResponse = await fetch(modelUrl);
            const modelData = await modelResponse.json();
            const fullModelInfo = modelData.result?.data?.json;

            if (!fullModelInfo) return null;

            // Find the required version in the modelVersions array
            const versionInfo = fullModelInfo.modelVersions.find(v => v.id === versionId);
            if (!versionInfo) return null;

            // Get primary file
            const primaryFile = versionInfo.files && versionInfo.files.length > 0 ? versionInfo.files[0] : null;

            return {
                modelName: fullModelInfo.name,
                createdAt: versionInfo.createdAt,
                updatedAt: versionInfo.updatedAt,
                username: fullModelInfo.user?.username,
                baseModel: versionInfo.baseModel,
                fileName: primaryFile?.name || '',
                fileId: primaryFile?.id,
                modelId: fullModelInfo.id,
                modelVersionId: versionInfo.id,
                modelVersionName: versionInfo.name,
                type: fullModelInfo.type,
                primaryFile: primaryFile,
                files: versionInfo.files || []
            };
        } catch (e) {
            console.error(`${name_for_log} Failed to get model info:`, e);
            return null;
        }
    }
    /**
     * Get download URL
     */
    getDownloadUrl(versionId, fileId = null) {
        let url = `https://civitai.com/api/download/models/${versionId}`;
        if (fileId) {
            url += `?type=Model&format=SafeTensor`;
        }
        return url;
    }

    /**
     * Main model download function
     */
    async downloadModel(versionId, modelInfoProvided = null) {
        try {
            // Get model information
            const modelInfo = modelInfoProvided || await this.getModelInfo(versionId);
            if (!modelInfo) {
                throw new Error('Failed to get model info');
            }

            // Generate filename
            const fileName = this.generateFileName(modelInfo);
            const downloadUrl = this.getDownloadUrl(versionId);

            console.log(`${name_for_log} Starting download:`, {
                url: downloadUrl,
                fileName: fileName,
                versionId: versionId
            });

            // Send download request to background script
            return new Promise((resolve, reject) => {
                this.runtimeAPI.sendMessage({
                    action: 'download',
                    url: downloadUrl,
                    fileName: fileName,
                    versionId: versionId,
                    modelInfo: modelInfo,
                    settings: this.settings
                }, async (response) => {
                    // Check timeout
                    const lastError = (typeof browser !== 'undefined') ?
                        browser.runtime.lastError :
                        chrome.runtime.lastError;

                    if (lastError) {
                        // Timeout - but loading is already in progress, add to cache
                        console.log(`${name_for_log} Response timeout (dialog), adding to cache anyway`);
                        if (this.settings.autoAddToCache && typeof StorageAPI !== 'undefined') {
                            await StorageAPI.cache.add(modelInfo);
                        }
                        resolve({ success: true, timeout: true });
                        return;
                    }

                    if (response && response.success) {
                        console.log(`${name_for_log} Download started successfully`);

                        // Automatically add to cache via Storage API
                        if (this.settings.autoAddToCache && typeof StorageAPI !== 'undefined') {
                            await StorageAPI.cache.add(modelInfo);
                        }

                        resolve(response);
                    } else {
                        console.error(`${name_for_log} Download failed:`, response?.error);
                        reject(new Error(response?.error || 'Download failed'));
                    }
                });
            });
        } catch (e) {
            console.error(`${name_for_log} Download error:`, e);
            throw e;
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadManager;
}