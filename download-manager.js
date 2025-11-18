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
            fileNameTemplate: '{modelName}_v{versionName}',
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
     * Generate filename from template
     * Available variables:
     * {modelName}, {versionName}, {modelId}, {versionId}, {type}, {baseModel}
     */
    generateFileName(modelData, template = null) {
        const tmpl = template || this.settings.fileNameTemplate;

        const variables = {
            modelName: this.sanitizeFileName(modelData.modelName || 'model'),
            versionName: this.sanitizeFileName(modelData.versionName || 'v1'),
            modelId: modelData.modelId || '',
            versionId: modelData.versionId || '',
            type: this.sanitizeFileName(modelData.type || 'model'),
            baseModel: this.sanitizeFileName(modelData.baseModel || '')
        };

        let fileName = tmpl;
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            fileName = fileName.replace(regex, variables[key]);
        });

        // Remove extra characters and spaces
        fileName = fileName.replace(/\s+/g, '_').replace(/_{2,}/g, '_');

        // Add extension if missing
        if (!fileName.match(/\.(safetensors|ckpt|pt|bin)$/i)) {
            fileName += '.safetensors';
        }

        return fileName;
    }

    /**
     * Sanitize filename by removing invalid characters
     */
    sanitizeFileName(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '_')
            .replace(/\s+/g, '_')
            .trim();
    }

    /**
     * Get model information from API
     */
    async getModelInfo(versionId) {
        try {
            const url = `https://civitai.com/api/trpc/modelVersion.getById?input=${encodeURIComponent(JSON.stringify({json:{id:versionId,authed:true}}))}`;
            const response = await fetch(url);
            const data = await response.json();
            const modelInfo = data.result?.data?.json;

            if (!modelInfo) return null;

            return {
                modelId: modelInfo.model.id,
                versionId: modelInfo.id,
                modelName: modelInfo.model.name,
                versionName: modelInfo.name,
                baseModel: modelInfo.baseModel,
                type: modelInfo.model.type,
                files: modelInfo.files || []
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

    /**
     * Get preset filename templates
     */
    getFileNameTemplates() {
        return {
            'default': '{modelName}_v{versionName}',
            'detailed': '{modelName}_{versionName}_{baseModel}',
            'simple': '{modelName}',
            'id_based': '{modelId}-{versionId}',
            'type_prefix': '[{type}]_{modelName}_v{versionName}',
            'full': '{type}_{modelName}_v{versionName}_{baseModel}'
        };
    }

    /**
     * Get template descriptions for UI
     */
    getTemplateDescriptions() {
        return {
            'default': 'ModelName_vVersionName',
            'detailed': 'ModelName_VersionName_BaseModel',
            'simple': 'ModelName',
            'id_based': 'ModelID-VersionID',
            'type_prefix': '[Type]_ModelName_vVersionName',
            'full': 'Type_ModelName_vVersionName_BaseModel'
        };
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DownloadManager;
}