/**
 * CVI Type Talker - Background Removal Module
 * Lazily loads @imgly/background-removal and processes images client-side.
 * The ML model (~30MB) downloads on first use and is cached by the browser.
 */
var CVIBackgroundRemoval = {
    _library: null,
    _loading: false,
    _loadPromise: null,
    _processedCache: new Map(),
    _maxCacheEntries: 30,

    /**
     * Load the background removal library on demand.
     * Returns a promise that resolves to the removeBackground function.
     */
    _loadLibrary: function() {
        if (this._library) {
            return Promise.resolve(this._library);
        }
        if (this._loadPromise) {
            return this._loadPromise;
        }

        this._loading = true;
        var self = this;

        this._loadPromise = import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm')
            .then(function(module) {
                self._library = module;
                self._loading = false;
                return module;
            })
            .catch(function(err) {
                self._loading = false;
                self._loadPromise = null;
                throw err;
            });

        return this._loadPromise;
    },

    /**
     * Check if background removal is enabled in settings.
     */
    isEnabled: function() {
        return CVISettings && CVISettings.current && CVISettings.current.removeBackground;
    },

    /**
     * Remember a processed blob URL; evict oldest entries when over the cap.
     */
    _cacheSet: function(imageUrl, processedUrl) {
        // Refresh insertion order for LRU behavior
        if (this._processedCache.has(imageUrl)) {
            var existing = this._processedCache.get(imageUrl);
            if (existing !== processedUrl) {
                URL.revokeObjectURL(existing);
            }
            this._processedCache.delete(imageUrl);
        }
        this._processedCache.set(imageUrl, processedUrl);
        while (this._processedCache.size > this._maxCacheEntries) {
            var oldestKey = this._processedCache.keys().next().value;
            var oldestUrl = this._processedCache.get(oldestKey);
            if (oldestUrl) URL.revokeObjectURL(oldestUrl);
            this._processedCache.delete(oldestKey);
        }
    },

    /**
     * Touch an existing cache entry so it counts as most recently used.
     */
    _cacheGet: function(imageUrl) {
        if (!this._processedCache.has(imageUrl)) return null;
        var url = this._processedCache.get(imageUrl);
        this._processedCache.delete(imageUrl);
        this._processedCache.set(imageUrl, url);
        return url;
    },

    /**
     * Resize image to optimize for background removal (720p-1080p range).
     * Returns a canvas with the resized image.
     */
    _resizeImage: function(img) {
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');

        var maxWidth = 1920;  // 1080p width
        var maxHeight = 1080; // 1080p height
        var minWidth = 1280;  // 720p width
        var minHeight = 720;  // 720p height

        var width = img.width;
        var height = img.height;

        // Calculate target dimensions
        var targetWidth, targetHeight;

        if (width > maxWidth || height > maxHeight) {
            // Scale down to 1080p if larger
            var scale = Math.min(maxWidth / width, maxHeight / height);
            targetWidth = Math.round(width * scale);
            targetHeight = Math.round(height * scale);
        } else if (width < minWidth && height < minHeight) {
            // Scale up to 720p if smaller
            var scale = Math.max(minWidth / width, minHeight / height);
            targetWidth = Math.round(width * scale);
            targetHeight = Math.round(height * scale);
        } else {
            // Keep original size if within range
            targetWidth = width;
            targetHeight = height;
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        return canvas;
    },

    /**
     * Process an image URL and return a new blob URL with the background removed.
     * Shows progress via the attribution element.
     * Returns the processed blob URL, or the original URL on failure.
     */
    /**
     * @param {string} imageUrl  - URL of the image to process
     * @param {string} word      - Word label (used for context)
     * @param {boolean} [silent] - When true, suppress all attribution element updates
     *                             (used during background pre-loading so the student
     *                             never sees "Removing background…" flicker mid-session)
     */
    /**
     * Load an Image element from a Blob.
     */
    _loadImageFromBlob: function(blob) {
        return new Promise(function(resolve, reject) {
            var objectUrl = URL.createObjectURL(blob);
            var img = new Image();
            img.onload = function() {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = function() {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('Failed to load image from blob'));
            };
            img.src = objectUrl;
        });
    },

    /**
     * Draw a coloured outline around the non-transparent pixels of an image blob.
     */
    applyOutlineToBlob: async function(blob, color, thickness) {
        var img = await this._loadImageFromBlob(blob);
        var width = img.width;
        var height = img.height;
        var pad = thickness || 6;
        var radius = pad / 2;
        var steps = Math.max(16, Math.round(pad * 4));
        var outlineColor = color || '#FFFF00';

        var tintCanvas = document.createElement('canvas');
        tintCanvas.width = width;
        tintCanvas.height = height;
        var tintCtx = tintCanvas.getContext('2d');
        tintCtx.drawImage(img, 0, 0);
        tintCtx.globalCompositeOperation = 'source-in';
        tintCtx.fillStyle = outlineColor;
        tintCtx.fillRect(0, 0, width, height);

        var outCanvas = document.createElement('canvas');
        outCanvas.width = width + pad * 2;
        outCanvas.height = height + pad * 2;
        var outCtx = outCanvas.getContext('2d');

        for (var i = 0; i < steps; i += 1) {
            var angle = (i / steps) * Math.PI * 2;
            var dx = Math.cos(angle) * radius;
            var dy = Math.sin(angle) * radius;
            outCtx.drawImage(tintCanvas, pad + dx, pad + dy);
        }
        outCtx.drawImage(img, pad, pad);

        return new Promise(function(resolve, reject) {
            outCanvas.toBlob(function(result) {
                if (result) resolve(result);
                else reject(new Error('Failed to create outlined image blob'));
            }, 'image/png');
        });
    },

    /**
     * Apply outline to an image URL and return a new blob URL.
     */
    applyOutlineToUrl: async function(imageUrl, color, thickness) {
        var response = await fetch(imageUrl);
        var blob = await response.blob();
        var outlinedBlob = await this.applyOutlineToBlob(blob, color, thickness);
        return URL.createObjectURL(outlinedBlob);
    },

    /**
     * Process image for display with optional forced background removal and outline.
     * @param {object} [options]
     * @param {boolean} [options.bgRemoval]
     * @param {boolean} [options.outline]
     * @param {string}  [options.outlineColor]
     * @param {number}  [options.outlineThickness]
     * @param {boolean} [options.silent]
     */
    processForDisplay: async function(imageUrl, word, options) {
        options = options || {};
        var currentUrl = imageUrl;
        var createdUrls = [];

        try {
            if (options.bgRemoval) {
                currentUrl = await this.processImage(imageUrl, word, options.silent, true);
            }

            if (options.outline) {
                var response = await fetch(currentUrl);
                var sourceBlob = await response.blob();
                var outlinedBlob = await this.applyOutlineToBlob(
                    sourceBlob,
                    options.outlineColor,
                    options.outlineThickness
                );
                var outlinedUrl = URL.createObjectURL(outlinedBlob);
                createdUrls.push(outlinedUrl);
                return { url: outlinedUrl, revoke: createdUrls };
            }

            return { url: currentUrl, revoke: createdUrls };
        } catch (err) {
            createdUrls.forEach(function(url) { URL.revokeObjectURL(url); });
            throw err;
        }
    },

    processImage: async function(imageUrl, word, silent, force) {
        if (!force && !this.isEnabled()) {
            return imageUrl;
        }

        // Check cache first — return instantly if already processed
        var cached = this._cacheGet(imageUrl);
        if (cached) {
            return cached;
        }

        // Only look up the live DOM element when we're allowed to write to it
        var attributionEl = silent ? null : document.getElementById('image-attribution');

        try {
            if (attributionEl) {
                attributionEl.textContent = CVII18n.t('backgroundRemoval.loadingModel');
            }

            var module = await this._loadLibrary();

            if (attributionEl) {
                attributionEl.textContent = CVII18n.t('backgroundRemoval.removing');
            }

            // Fetch the image as a blob
            var response = await fetch(imageUrl);
            var imageBlob = await response.blob();

            // Process the image
            var resultBlob = await module.removeBackground(imageBlob, {
                progress: function(key, current, total) {
                    if (attributionEl && key === 'compute:inference') {
                        var pct = Math.round((current / total) * 100);
                        attributionEl.textContent = CVII18n.t('backgroundRemoval.removingPct', { pct: String(pct) });
                    }
                }
            });

            // Create a URL for the processed image
            var processedUrl = URL.createObjectURL(resultBlob);
            this._cacheSet(imageUrl, processedUrl);

            if (attributionEl) {
                attributionEl.textContent = CVII18n.t('backgroundRemoval.success');
            }

            return processedUrl;
        } catch (err) {
            console.error('Background removal error:', err);
            if (attributionEl) {
                attributionEl.textContent = CVII18n.t('backgroundRemoval.failed');
            }
            return imageUrl;
        }
    },

    /**
     * Clear processed image cache and revoke blob URLs.
     */
    clearCache: function() {
        this._processedCache.forEach(function(url) {
            URL.revokeObjectURL(url);
        });
        this._processedCache.clear();
    }
};
