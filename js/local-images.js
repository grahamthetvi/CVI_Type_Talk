/**
 * CVI Type Talker - Local Images Module
 * Stores user-uploaded custom images in IndexedDB so they persist offline.
 */
const CVILocalImages = {
    dbName: 'CVI_Custom_Images_DB',
    storeName: 'images',
    db: null,

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = (e) => {
                console.error("IndexedDB error:", e);
                reject(e);
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'word' });
                }
            };
        });
    },

    /**
     * Save an image (dataURL) for a specific word.
     */
    saveImage(word, dataUrl) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error("Database not initialized"));
                return;
            }
            const normalized = word.toLowerCase().trim();
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ word: normalized, dataUrl: dataUrl });

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    },

    /**
     * Get the custom image for a word.
     * Returns the dataUrl if found, else null.
     */
    getImage(word) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }
            const normalized = word.toLowerCase().trim();
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(normalized);

            request.onsuccess = (e) => {
                if (e.target.result) {
                    resolve(e.target.result.dataUrl);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => resolve(null); // fail gracefully
        });
    },

    /**
     * Get all saved custom images.
     */
    getAllImages() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve([]);
                return;
            }
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = (e) => resolve(e.target.result || []);
            request.onerror = (e) => reject(e);
        });
    },

    /**
     * Remove the custom image for a word.
     */
    removeImage(word) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error("Database not initialized"));
                return;
            }
            const normalized = word.toLowerCase().trim();
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(normalized);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }
};
