/**
 * Storage API - Core module for working with models cache
 * Handles all cache operations, file processing, and storage management
 */

const StorageAPI = (() => {
  'use strict';

  // Browser compatibility
  const storageAPI = (typeof browser !== 'undefined') 
    ? browser.storage.local 
    : chrome.storage.local;

  /**
   * Low-level storage operations
   */
  const Storage = {
    async get(key) {
      const result = await storageAPI.get(key);
      return result[key];
    },

    async set(key, value) {
      await storageAPI.set({ [key]: value });
    },

    async remove(key) {
      await storageAPI.remove(key);
    }
  };

  /**
   * Cache operations
   */
  const Cache = {
    /**
     * Load models cache from storage
     * @returns {Promise<Object>} Models cache object
     */
    async load() {
      const cacheData = await Storage.get('modelsCache');
      
      if (!cacheData) {
        return {};
      }

      const parsed = JSON.parse(cacheData);
      
      // Convert array to object if needed (legacy support)
      if (Array.isArray(parsed)) {
        console.warn('[Storage API] Cache was array, converted to empty object');
        return {};
      }

      return parsed;
    },

    /**
     * Save models cache to storage
     * @param {Object} cache - Models cache object
     */
    async save(cache) {
      await Storage.set('modelsCache', JSON.stringify(cache));
    },

    /**
     * Add model to cache
     * @param {Object} modelInfo - Model information
     * @returns {Promise<string>} Cache key
     */
    async add(modelInfo) {
      const cache = await this.load();
      const key = `${modelInfo.modelId}-${modelInfo.versionId}`;
      
      cache[key] = {
        modelId: modelInfo.modelId,
        versionId: modelInfo.versionId,
        modelName: modelInfo.modelName,
        versionName: modelInfo.versionName,
        baseModel: modelInfo.baseModel,
        type: modelInfo.type,
        importedAt: new Date().toISOString()
      };

      await this.save(cache);
      return key;
    },

    /**
     * Remove model from cache
     * @param {string} key - Cache key (modelId-versionId)
     */
    async remove(key) {
      const cache = await this.load();
      delete cache[key];
      await this.save(cache);
    },

    /**
     * Clear entire cache
     */
    async clear() {
      await Storage.remove('modelsCache');
    },

    /**
     * Get cache statistics
     * @returns {Promise<Object>} { count: number, models: Object }
     */
    async getStats() {
      const cache = await this.load();
      return {
        count: Object.keys(cache).length,
        models: cache
      };
    },

    /**
     * Check if model is cached
     * @param {number} modelId
     * @param {number} versionId
     * @returns {Promise<boolean>}
     */
    async has(modelId, versionId) {
      const cache = await this.load();
      const key = `${modelId}-${versionId}`;
      return cache.hasOwnProperty(key);
    },

    /**
     * Get model from cache
     * @param {number} modelId
     * @param {number} versionId
     * @returns {Promise<Object|null>}
     */
    async get(modelId, versionId) {
      const cache = await this.load();
      const key = `${modelId}-${versionId}`;
      return cache[key] || null;
    }
  };

  /**
   * File processing operations
   */
  const Files = {
    /**
     * Process .cm-info.json files and build cache
     * @param {FileList|Array} files - Files to process
     * @returns {Promise<Object>} { success: boolean, count: number, models: Object, errors: Array }
     */
    async process(files) {
      const modelsCache = {};
      const errors = [];
      let count = 0;

      for (const file of files) {
        if (!file.name.endsWith('.cm-info.json')) {
          continue;
        }

        try {
          const modelData = await this.parse(file);
          
          if (modelData) {
            const key = `${modelData.modelId}-${modelData.versionId}`;
            modelsCache[key] = modelData;
            count++;
          }
        } catch (err) {
          errors.push({
            file: file.name,
            error: err.message
          });
        }
      }

      if (count > 0) {
        await Cache.save(modelsCache);
      }

      return {
        success: count > 0,
        count: count,
        models: modelsCache,
        errors: errors
      };
    },

    /**
     * Parse single .cm-info.json file
     * @param {File} file
     * @returns {Promise<Object|null>} Model data or null
     */
    async parse(file) {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!this.validate(data)) {
        return null;
      }

      return {
        modelId: data.ModelId,
        versionId: data.VersionId,
        modelName: data.ModelName,
        versionName: data.VersionName,
        baseModel: data.BaseModel,
        type: data.ModelType,
        importedAt: data.ImportedAt || null
      };
    },

    /**
     * Validate model data
     * @param {Object} data
     * @returns {boolean}
     */
    validate(data) {
      return !!(data.ModelId && data.VersionId);
    }
  };

  // Public API
  return {
    storage: Storage,
    cache: Cache,
    files: Files
  };
})();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageAPI;
}