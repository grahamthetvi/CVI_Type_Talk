/**
 * CVI Type Talker - Image Module
 * Fetches images from Wikimedia Commons API for typed words.
 * Supports multi-image navigation and real-word validation.
 */
const CVIImages = {
    imageEl: null,
    cameraEl: null,
    labelEl: null,
    attributionEl: null,
    prevBtn: null,
    nextBtn: null,
    _cameraStream: null,

    // Cache: word -> array of { url, title }
    cache: new Map(),
    // Dictionary validation cache: word -> boolean
    _wordValidCache: new Map(),

    _currentRequest: 0,

    // Current word's photo list and index
    _currentPhotos: [],
    _currentPhotoIndex: 0,
    _currentWord: '',

    init() {
        this.imageEl = document.getElementById('word-image');
        this.cameraEl = document.getElementById('camera-feed');
        this.labelEl = document.getElementById('image-label');
        this.attributionEl = document.getElementById('image-attribution');
        this.prevBtn = document.getElementById('image-prev-btn');
        this.nextBtn = document.getElementById('image-next-btn');

        var self = this;
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', function () {
                self.showPrevPhoto();
            });
        }
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', function () {
                self.showNextPhoto();
            });
        }
    },

    /**
     * Navigate to the previous photo for the current word.
     */
    showPrevPhoto() {
        if (this._currentPhotos.length <= 1) return;
        this._currentPhotoIndex = (this._currentPhotoIndex - 1 + this._currentPhotos.length) % this._currentPhotos.length;
        var photo = this._currentPhotos[this._currentPhotoIndex];
        this._displayImage(photo.url, this._currentWord, photo.title);
        this._updateArrows();
    },

    /**
     * Navigate to the next photo for the current word.
     */
    showNextPhoto() {
        if (this._currentPhotos.length <= 1) return;
        this._currentPhotoIndex = (this._currentPhotoIndex + 1) % this._currentPhotos.length;
        var photo = this._currentPhotos[this._currentPhotoIndex];
        this._displayImage(photo.url, this._currentWord, photo.title);
        this._updateArrows();
    },

    /**
     * Show/hide arrow buttons based on photo count and settings.
     */
    _updateArrows() {
        var settings = CVISettings ? CVISettings.getSettings() : null;
        var arrowsEnabled = settings ? settings.arrowsEnabled : true;
        var arrowColor = settings ? settings.arrowColor : '#FFFF00';
        var arrowSize = settings ? (settings.arrowSize || 56) : 56;
        var hasMultiple = this._currentPhotos.length > 1;
        var displayVal = (arrowsEnabled && hasMultiple) ? 'flex' : 'none';
        var fontSize = Math.round(arrowSize * 0.5) + 'px';

        if (this.prevBtn) {
            this.prevBtn.style.display = displayVal;
            this.prevBtn.style.color = arrowColor;
            this.prevBtn.style.borderColor = arrowColor;
            this.prevBtn.style.width = arrowSize + 'px';
            this.prevBtn.style.height = arrowSize + 'px';
            this.prevBtn.style.fontSize = fontSize;
        }
        if (this.nextBtn) {
            this.nextBtn.style.display = displayVal;
            this.nextBtn.style.color = arrowColor;
            this.nextBtn.style.borderColor = arrowColor;
            this.nextBtn.style.width = arrowSize + 'px';
            this.nextBtn.style.height = arrowSize + 'px';
            this.nextBtn.style.fontSize = fontSize;
        }
    },

    /**
     * Hide arrows (called when no image shown or during loading).
     */
    _hideArrows() {
        if (this.prevBtn) this.prevBtn.style.display = 'none';
        if (this.nextBtn) this.nextBtn.style.display = 'none';
    },

    async _startCamera() {
        if (this._cameraStream) return;
        try {
            this._cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
            if (this.cameraEl) {
                this.cameraEl.srcObject = this._cameraStream;
                this.cameraEl.hidden = false;
            }
        } catch (err) {
            console.error("Camera error:", err);
            this._showTextOnly(this._currentWord);
        }
    },

    _stopCamera() {
        if (this._cameraStream) {
            this._cameraStream.getTracks().forEach(function (track) { track.stop(); });
            this._cameraStream = null;
        }
        if (this.cameraEl) {
            this.cameraEl.hidden = true;
            this.cameraEl.srcObject = null;
        }
    },

    _showCamera(word) {
        this._currentWord = word;
        this._currentPhotos = [];
        this._hideArrows();

        this.imageEl.hidden = true;
        this.imageEl.src = '';

        this.labelEl.textContent = word.toUpperCase();
        this.labelEl.className = 'image-label has-image';
        this.attributionEl.textContent = '';

        if (this.cameraEl) {
            this.cameraEl.hidden = false;
        }

        this._startCamera();
    },

    /**
     * Show an image for the given word.
     * Queries Wikimedia Commons, filters for photos, displays result.
     */
    async showImage(word) {
        if (!word || !word.trim()) {
            this._stopCamera();
            this._showDefault();
            return;
        }

        var normalized = word.toLowerCase().trim();

        if (normalized === "me" || normalized === "you") {
            this._showCamera(normalized);
            return;
        }

        this._stopCamera();

        // Skip image loading for single letters
        if (normalized.length === 1) {
            this._showTextOnly(normalized);
            return;
        }

        // Check if word should show image based on settings (profanity/block lists)
        if (CVISettings && !CVISettings.shouldShowImage(normalized)) {
            this._showTextOnly(normalized);
            return;
        }

        // ── Cache check FIRST ────────────────────────────────────────────────
        // If the word was pre-loaded (or previously typed), show it immediately
        // without any network round-trips.
        if (this.cache.has(normalized)) {
            var cached = this.cache.get(normalized);
            if (cached && cached.length > 0) {
                this._currentPhotos = cached;
                this._currentPhotoIndex = 0;
                this._currentWord = normalized;
                this._displayImage(cached[0].url, normalized, cached[0].title);
                this._updateArrows();
            } else {
                this._showTextOnly(normalized);
            }
            return;
        }

        // ── Dictionary validation (only for words not yet in cache) ──────────
        var settings = CVISettings ? CVISettings.getSettings() : null;
        var skipValidation = settings && settings.customWordListEnabled;
        if (!skipValidation) {
            var isReal = await this._isRealWord(normalized);
            if (!isReal) {
                this._showNonsenseWord(normalized);
                return;
            }
        }

        // Show loading state
        this._showLoading(normalized);
        this._hideArrows();

        // Track request to handle race conditions
        var requestId = ++this._currentRequest;

        try {
            var results = await this._fetchFromWikimedia(normalized);

            // Only update if this is still the latest request
            if (requestId !== this._currentRequest) return;

            if (results && results.length > 0) {
                this.cache.set(normalized, results);
                this._currentPhotos = results;
                this._currentPhotoIndex = 0;
                this._currentWord = normalized;
                this._displayImage(results[0].url, normalized, results[0].title);
                this._updateArrows();
            } else {
                this.cache.set(normalized, []);
                this._showTextOnly(normalized);
            }
        } catch (err) {
            if (requestId !== this._currentRequest) return;
            this.cache.set(normalized, []);
            this._showTextOnly(normalized);
        }
    },

    /**
     * Check if a word exists in the English dictionary via free API.
     * Results are cached for the session.
     */
    async _isRealWord(word) {
        if (this._wordValidCache.has(word)) {
            return this._wordValidCache.get(word);
        }

        // Single letters are handled before this call; just in case
        if (word.length === 1) {
            this._wordValidCache.set(word, false);
            return false;
        }

        try {
            var response = await fetch(
                'https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word)
            );
            var isReal = response.ok; // 200 = found, 404 = not found
            this._wordValidCache.set(word, isReal);
            return isReal;
        } catch (err) {
            // Network error — allow word through so connectivity issues don't block the student
            this._wordValidCache.set(word, true);
            return true;
        }
    },

    /**
     * Query Wikimedia Commons for images matching the word.
     * Returns an array of { url, title } objects (up to 10).
     */
    async _fetchFromWikimedia(word) {
        var url = 'https://commons.wikimedia.org/w/api.php'
            + '?action=query'
            + '&generator=search'
            + '&gsrsearch=' + encodeURIComponent(word)
            + '&gsrnamespace=6'
            + '&gsrlimit=10'
            + '&prop=imageinfo'
            + '&iiprop=url|mime|extmetadata'
            + '&iiurlwidth=800'
            + '&format=json'
            + '&origin=*';

        var response = await fetch(url);
        var data = await response.json();

        if (!data.query || !data.query.pages) return [];

        var pages = Object.values(data.query.pages);

        // Filter for actual photographs (JPEG, PNG, WebP — not SVG or GIF)
        var photoMimes = ['image/jpeg', 'image/png', 'image/webp'];
        var photos = pages.filter(function (p) {
            return p.imageinfo &&
                p.imageinfo[0] &&
                photoMimes.indexOf(p.imageinfo[0].mime) !== -1;
        });

        if (photos.length === 0) return [];

        return photos.map(function (p) {
            var info = p.imageinfo[0];
            var thumbUrl = info.thumburl || info.url;
            var title = p.title ? p.title.replace('File:', '').replace(/\.[^.]+$/, '') : word;
            return { url: thumbUrl, title: title };
        });
    },

    /**
     * Display an image with label and attribution.
     * If background removal is enabled, processes the image after initial display.
     */
    _displayImage(src, word, title) {
        var self = this;
        this.imageEl.src = src;
        this.imageEl.alt = 'Photo of ' + word;
        this.imageEl.hidden = false;
        this.labelEl.textContent = word.toUpperCase();
        this.labelEl.className = 'image-label has-image';

        // Show photo index if multiple available
        if (this._currentPhotos.length > 1) {
            this.attributionEl.textContent =
                'Image ' + (this._currentPhotoIndex + 1) + ' of ' + this._currentPhotos.length +
                ' — Wikimedia Commons';
        } else {
            this.attributionEl.textContent = 'Image from Wikimedia Commons';
        }

        this.imageEl.onerror = function () {
            self._showTextOnly(word);
        };

        // Apply background removal if enabled
        if (typeof CVIBackgroundRemoval !== 'undefined' && CVIBackgroundRemoval.isEnabled()) {
            this.attributionEl.textContent = 'Preparing background removal...';
            this.imageEl.classList.add('processing');

            CVIBackgroundRemoval.processImage(src, word).then(function (processedUrl) {
                if (self.imageEl.src === src || self.imageEl.src === processedUrl) {
                    self.imageEl.src = processedUrl;
                    self.imageEl.classList.remove('processing');
                    self._applyImageOutline && self._applyImageOutline();
                }
            }).catch(function () {
                self.imageEl.classList.remove('processing');
                if (self._currentPhotos.length > 1) {
                    self.attributionEl.textContent =
                        'Image ' + (self._currentPhotoIndex + 1) + ' of ' + self._currentPhotos.length +
                        ' — Wikimedia Commons';
                } else {
                    self.attributionEl.textContent = 'Image from Wikimedia Commons';
                }
            });
        }
    },

    /**
     * Show loading state while image is being fetched.
     */
    _showLoading(word) {
        this.imageEl.hidden = true;
        this.imageEl.src = '';
        this.labelEl.textContent = word.toUpperCase() + '...';
        this.labelEl.className = 'image-label loading';
        this.attributionEl.textContent = 'Searching for image...';
        this._currentPhotos = [];
        this._currentWord = '';
    },

    /**
     * Show word as large text when no image is available.
     */
    _showTextOnly(word) {
        this.imageEl.hidden = true;
        this.imageEl.src = '';
        this.labelEl.textContent = word.toUpperCase();
        this.labelEl.className = 'image-label';
        this.attributionEl.textContent = '';
        this._currentPhotos = [];
        this._currentWord = '';
        this._hideArrows();
    },

    /**
     * Show word as text with a note that it wasn't found in the dictionary.
     */
    _showNonsenseWord(word) {
        this.imageEl.hidden = true;
        this.imageEl.src = '';
        this.labelEl.textContent = word.toUpperCase();
        this.labelEl.className = 'image-label';
        this.attributionEl.textContent = 'Not a real word — no image shown';
        this._currentPhotos = [];
        this._currentWord = '';
        this._hideArrows();
    },

    /**
     * Show default state (initial).
     */
    _showDefault() {
        this.imageEl.hidden = true;
        this.imageEl.src = '';
        this.labelEl.textContent = 'Type a word!';
        this.labelEl.className = 'image-label';
        this.attributionEl.textContent = '';
        this._currentPhotos = [];
        this._currentWord = '';
        this._hideArrows();
    },

    /**
     * Pre-load images (and optionally background-remove) for a comma-separated
     * word list. Runs silently in the background so the child sees instant results.
     * Requests are staggered 350ms apart to avoid hammering the API.
     */
    async preloadWords(wordListStr) {
        if (!wordListStr || !wordListStr.trim()) return;

        var self = this;
        var words = wordListStr
            .split(',')
            .map(function (w) { return w.trim().toLowerCase(); })
            .filter(function (w) {
                // Skip blanks and single characters
                return w.length > 1;
            });

        // Remove duplicates
        var seen = {};
        words = words.filter(function (w) {
            if (seen[w]) return false;
            seen[w] = true;
            return true;
        });

        if (words.length === 0) return;

        var statusEl = document.getElementById('preload-status');
        var bgRemovalEnabled = typeof CVIBackgroundRemoval !== 'undefined' && CVIBackgroundRemoval.isEnabled();
        var loaded = 0;
        var total = words.length;

        function updateStatus(msg) {
            if (statusEl) statusEl.textContent = msg;
        }

        updateStatus('Pre-loading ' + total + ' word' + (total !== 1 ? 's' : '') + '…');

        for (var i = 0; i < words.length; i++) {
            var word = words[i];

            // Skip if already cached
            if (self.cache.has(word)) {
                loaded++;
                updateStatus('Pre-loaded ' + loaded + ' / ' + total);
                continue;
            }

            // Stagger requests — wait before each fetch (except the first)
            if (i > 0) {
                await new Promise(function (resolve) { setTimeout(resolve, 350); });
            }

            try {
                var results = await self._fetchFromWikimedia(word);
                if (results && results.length > 0) {
                    self.cache.set(word, results);
                    // Mark as a known-real word so showImage() skips the dictionary API call
                    self._wordValidCache.set(word, true);

                    // If background removal is on, process the first photo now silently
                    // (silent=true suppresses any visible attribution updates)
                    if (bgRemovalEnabled) {
                        try {
                            await CVIBackgroundRemoval.processImage(results[0].url, word, true);
                        } catch (e) {
                            // Background removal failed — original image will still show instantly
                        }
                    }
                } else {
                    self.cache.set(word, []);
                }
            } catch (e) {
                // Network error for this word — skip silently
            }

            loaded++;
            updateStatus('Pre-loaded ' + loaded + ' / ' + total);
        }

        updateStatus('✓ All ' + total + ' word' + (total !== 1 ? 's' : '') + ' pre-loaded');

        // Clear the message after a few seconds
        setTimeout(function () {
            if (statusEl) statusEl.textContent = '';
        }, 4000);
    },

    /**
     * Hide image panel content entirely.
     */
    hideImage() {
        this._stopCamera();
        this._showDefault();
    }
};
