/**
 * CVI Type Talker - Settings Module
 * Manages user customization settings for fonts, bubble letters, typing controls, and image filtering.
 */
const CVISettings = {
    defaults: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 60,
        fontColor: '#000000',
        backgroundColor: '#000000',
        bubbleLettersEnabled: true,
        bubbleColor: '#FF0000',
        bubbleSize: 4,
        typingInterval: 150,
        maxKeysPerSecond: 10,
        removeBackground: false,
        imageBgColor: '#000000',
        filterProfanity: true,
        customWordListEnabled: false,
        customWordList: '',
        blockedWordList: '',
        arrowsEnabled: true,
        arrowColor: '#FFFF00',
        preloadWords: '',
        imageSize: 55,
        imageLabelSize: 48
    },

    current: {},
    previousFocus: null,
    focusableElements: [],

    // Common profanity words to filter
    profanityList: [
        'damn', 'hell', 'crap', 'shit', 'fuck', 'bitch', 'ass', 'bastard',
        'piss', 'cock', 'dick', 'pussy', 'whore', 'slut', 'fag', 'nigger'
    ],

    init() {
        this.loadSettings();
        this.setupUI();
        this.applySettings();
    },

    /**
     * Load settings from localStorage or use defaults
     */
    loadSettings() {
        var saved = localStorage.getItem('cvi-settings');
        if (saved) {
            try {
                this.current = JSON.parse(saved);
                // Merge with defaults to handle new settings
                for (var key in this.defaults) {
                    if (this.current[key] === undefined) {
                        this.current[key] = this.defaults[key];
                    }
                }
            } catch (e) {
                this.current = Object.assign({}, this.defaults);
            }
        } else {
            this.current = Object.assign({}, this.defaults);
        }
    },

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        localStorage.setItem('cvi-settings', JSON.stringify(this.current));
    },

    /**
     * Set up the settings UI event listeners
     */
    setupUI() {
        var self = this;
        var panel = document.getElementById('settings-panel');
        var settingsBtn = document.getElementById('settings-button');
        var saveBtn = document.getElementById('save-settings');
        var cancelBtn = document.getElementById('cancel-settings');
        var resetBtn = document.getElementById('reset-settings');

        // Open settings panel
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function() {
                self.openPanel();
            });
        }

        // Save settings
        if (saveBtn) {
            saveBtn.addEventListener('click', function() {
                self.readFromUI();
                self.saveSettings();
                self.applySettings();
                self.closePanel();
            });
        }

        // Cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                self.closePanel();
                self.populateUI(); // Reset UI to saved values
            });
        }

        // Reset to defaults
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                if (confirm('Reset all settings to defaults?')) {
                    self.current = Object.assign({}, self.defaults);
                    self.saveSettings();
                    self.populateUI();
                    self.applySettings();
                }
            });
        }

        // Real-time updates for range sliders
        var fontSize = document.getElementById('font-size');
        var fontSizeValue = document.getElementById('font-size-value');
        if (fontSize && fontSizeValue) {
            fontSize.addEventListener('input', function() {
                fontSizeValue.textContent = this.value + 'px';
            });
        }

        var bubbleSize = document.getElementById('bubble-size');
        var bubbleSizeValue = document.getElementById('bubble-size-value');
        if (bubbleSize && bubbleSizeValue) {
            bubbleSize.addEventListener('input', function() {
                bubbleSizeValue.textContent = this.value + 'px';
            });
        }

        var typingInterval = document.getElementById('typing-interval');
        var typingIntervalValue = document.getElementById('typing-interval-value');
        if (typingInterval && typingIntervalValue) {
            typingInterval.addEventListener('input', function() {
                typingIntervalValue.textContent = this.value + 'ms';
            });
        }

        var maxKeys = document.getElementById('max-keys-per-second');
        var maxKeysValue = document.getElementById('max-keys-value');
        if (maxKeys && maxKeysValue) {
            maxKeys.addEventListener('input', function() {
                maxKeysValue.textContent = this.value;
            });
        }

        var imageSize = document.getElementById('image-size');
        var imageSizeValue = document.getElementById('image-size-value');
        if (imageSize && imageSizeValue) {
            imageSize.addEventListener('input', function() {
                imageSizeValue.textContent = this.value + 'vh';
            });
        }

        var imageLabelSize = document.getElementById('image-label-size');
        var imageLabelSizeValue = document.getElementById('image-label-size-value');
        if (imageLabelSize && imageLabelSizeValue) {
            imageLabelSize.addEventListener('input', function() {
                imageLabelSizeValue.textContent = this.value + 'px';
            });
        }

        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && panel && panel.classList.contains('visible')) {
                self.closePanel();
                self.populateUI(); // Reset UI to saved values
            }
        });

        // Populate UI with current values
        this.populateUI();
    },

    /**
     * Open the settings panel
     */
    openPanel() {
        var panel = document.getElementById('settings-panel');
        if (panel) {
            // Store the currently focused element
            this.previousFocus = document.activeElement;

            panel.classList.add('visible');
            this.populateUI();

            // Disable keyboard input while settings are open
            if (CVIKeyboard) {
                CVIKeyboard.disable();
            }

            // Get all focusable elements within the panel
            this.focusableElements = panel.querySelectorAll(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );

            // Set up focus trap
            if (this.focusableElements.length > 0) {
                // Focus the first element (the h2 with tabindex or first input)
                var settingsTitle = document.getElementById('settings-title');
                if (settingsTitle) {
                    settingsTitle.setAttribute('tabindex', '-1');
                    settingsTitle.focus();
                }

                // Add focus trap listeners
                var firstFocusable = this.focusableElements[0];
                var lastFocusable = this.focusableElements[this.focusableElements.length - 1];

                panel.addEventListener('keydown', this._handleFocusTrap.bind(this, firstFocusable, lastFocusable));
            }

            // Announce to screen readers
            this._announceToScreenReader('Settings panel opened');
        }
    },

    /**
     * Close the settings panel
     */
    closePanel() {
        var panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.remove('visible');

            // Re-enable keyboard input
            if (CVIKeyboard && CVIKeyboard.enabled !== undefined) {
                var overlay = document.getElementById('instructions-overlay');
                if (!overlay || overlay.classList.contains('hidden')) {
                    CVIKeyboard.enable();
                }
            }

            // Restore focus to the element that opened the panel
            if (this.previousFocus && this.previousFocus.focus) {
                this.previousFocus.focus();
            }

            // Announce to screen readers
            this._announceToScreenReader('Settings panel closed');
        }
    },

    /**
     * Handle focus trapping within the dialog
     */
    _handleFocusTrap(firstFocusable, lastFocusable, e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        }
    },

    /**
     * Announce messages to screen readers
     */
    _announceToScreenReader(message) {
        var announcer = document.getElementById('sr-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'sr-announcer';
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            announcer.style.position = 'absolute';
            announcer.style.left = '-10000px';
            announcer.style.width = '1px';
            announcer.style.height = '1px';
            announcer.style.overflow = 'hidden';
            document.body.appendChild(announcer);
        }
        announcer.textContent = message;
    },

    /**
     * Populate UI controls with current settings
     */
    populateUI() {
        var fontFamily = document.getElementById('font-family');
        if (fontFamily) fontFamily.value = this.current.fontFamily;

        var fontSize = document.getElementById('font-size');
        var fontSizeValue = document.getElementById('font-size-value');
        if (fontSize) fontSize.value = this.current.fontSize;
        if (fontSizeValue) fontSizeValue.textContent = this.current.fontSize + 'px';

        var fontColor = document.getElementById('font-color');
        if (fontColor) fontColor.value = this.current.fontColor;

        var backgroundColor = document.getElementById('background-color');
        if (backgroundColor) backgroundColor.value = this.current.backgroundColor;

        var bubbleEnabled = document.getElementById('bubble-letters-enabled');
        if (bubbleEnabled) bubbleEnabled.checked = this.current.bubbleLettersEnabled;

        var bubbleColor = document.getElementById('bubble-color');
        if (bubbleColor) bubbleColor.value = this.current.bubbleColor;

        var bubbleSize = document.getElementById('bubble-size');
        var bubbleSizeValue = document.getElementById('bubble-size-value');
        if (bubbleSize) bubbleSize.value = this.current.bubbleSize;
        if (bubbleSizeValue) bubbleSizeValue.textContent = this.current.bubbleSize + 'px';

        var typingInterval = document.getElementById('typing-interval');
        var typingIntervalValue = document.getElementById('typing-interval-value');
        if (typingInterval) typingInterval.value = this.current.typingInterval;
        if (typingIntervalValue) typingIntervalValue.textContent = this.current.typingInterval + 'ms';

        var maxKeys = document.getElementById('max-keys-per-second');
        var maxKeysValue = document.getElementById('max-keys-value');
        if (maxKeys) maxKeys.value = this.current.maxKeysPerSecond;
        if (maxKeysValue) maxKeysValue.textContent = this.current.maxKeysPerSecond;

        var removeBackground = document.getElementById('remove-background');
        if (removeBackground) removeBackground.checked = this.current.removeBackground;

        var imageBgColor = document.getElementById('image-bg-color');
        if (imageBgColor) imageBgColor.value = this.current.imageBgColor;

        var filterProfanity = document.getElementById('filter-profanity');
        if (filterProfanity) filterProfanity.checked = this.current.filterProfanity;

        var customListEnabled = document.getElementById('custom-word-list-enabled');
        if (customListEnabled) customListEnabled.checked = this.current.customWordListEnabled;

        var customList = document.getElementById('custom-word-list');
        if (customList) customList.value = this.current.customWordList;

        var blockedList = document.getElementById('blocked-word-list');
        if (blockedList) blockedList.value = this.current.blockedWordList;

        var arrowsEnabled = document.getElementById('arrows-enabled');
        if (arrowsEnabled) arrowsEnabled.checked = this.current.arrowsEnabled;

        var arrowColor = document.getElementById('arrow-color');
        if (arrowColor) arrowColor.value = this.current.arrowColor;

        var preloadWords = document.getElementById('preload-words');
        if (preloadWords) preloadWords.value = this.current.preloadWords;

        var imageSize = document.getElementById('image-size');
        var imageSizeValue = document.getElementById('image-size-value');
        if (imageSize) imageSize.value = this.current.imageSize;
        if (imageSizeValue) imageSizeValue.textContent = this.current.imageSize + 'vh';

        var imageLabelSize = document.getElementById('image-label-size');
        var imageLabelSizeValue = document.getElementById('image-label-size-value');
        if (imageLabelSize) imageLabelSize.value = this.current.imageLabelSize;
        if (imageLabelSizeValue) imageLabelSizeValue.textContent = this.current.imageLabelSize + 'px';

        // Populate session word history
        this._populateWordHistory();
    },

    /**
     * Read values from UI controls
     */
    readFromUI() {
        var fontFamily = document.getElementById('font-family');
        if (fontFamily) this.current.fontFamily = fontFamily.value;

        var fontSize = document.getElementById('font-size');
        if (fontSize) this.current.fontSize = parseInt(fontSize.value);

        var fontColor = document.getElementById('font-color');
        if (fontColor) this.current.fontColor = fontColor.value;

        var backgroundColor = document.getElementById('background-color');
        if (backgroundColor) this.current.backgroundColor = backgroundColor.value;

        var bubbleEnabled = document.getElementById('bubble-letters-enabled');
        if (bubbleEnabled) this.current.bubbleLettersEnabled = bubbleEnabled.checked;

        var bubbleColor = document.getElementById('bubble-color');
        if (bubbleColor) this.current.bubbleColor = bubbleColor.value;

        var bubbleSize = document.getElementById('bubble-size');
        if (bubbleSize) this.current.bubbleSize = parseInt(bubbleSize.value);

        var typingInterval = document.getElementById('typing-interval');
        if (typingInterval) this.current.typingInterval = parseInt(typingInterval.value);

        var maxKeys = document.getElementById('max-keys-per-second');
        if (maxKeys) this.current.maxKeysPerSecond = parseInt(maxKeys.value);

        var removeBackground = document.getElementById('remove-background');
        if (removeBackground) this.current.removeBackground = removeBackground.checked;

        var imageBgColor = document.getElementById('image-bg-color');
        if (imageBgColor) this.current.imageBgColor = imageBgColor.value;

        var filterProfanity = document.getElementById('filter-profanity');
        if (filterProfanity) this.current.filterProfanity = filterProfanity.checked;

        var customListEnabled = document.getElementById('custom-word-list-enabled');
        if (customListEnabled) this.current.customWordListEnabled = customListEnabled.checked;

        var customList = document.getElementById('custom-word-list');
        if (customList) this.current.customWordList = customList.value;

        var blockedList = document.getElementById('blocked-word-list');
        if (blockedList) this.current.blockedWordList = blockedList.value;

        var arrowsEnabled = document.getElementById('arrows-enabled');
        if (arrowsEnabled) this.current.arrowsEnabled = arrowsEnabled.checked;

        var arrowColor = document.getElementById('arrow-color');
        if (arrowColor) this.current.arrowColor = arrowColor.value;

        var preloadWords = document.getElementById('preload-words');
        if (preloadWords) this.current.preloadWords = preloadWords.value;

        var imageSize = document.getElementById('image-size');
        if (imageSize) this.current.imageSize = parseInt(imageSize.value);

        var imageLabelSize = document.getElementById('image-label-size');
        if (imageLabelSize) this.current.imageLabelSize = parseInt(imageLabelSize.value);
    },

    /**
     * Apply current settings to the application
     */
    applySettings() {
        var textDisplay = document.getElementById('text-display');
        if (textDisplay) {
            textDisplay.style.fontFamily = this.current.fontFamily;
            textDisplay.style.fontSize = this.current.fontSize + 'px';
            textDisplay.style.color = this.current.fontColor;

            // Apply background color
            document.body.style.backgroundColor = this.current.backgroundColor;

            // Apply bubble letters
            if (this.current.bubbleLettersEnabled) {
                textDisplay.classList.add('bubble-letters');
                textDisplay.style.setProperty('--bubble-color', this.current.bubbleColor);

                // Calculate text shadow for bubble effect
                var shadows = [];
                var size = this.current.bubbleSize;
                for (var x = -size; x <= size; x++) {
                    for (var y = -size; y <= size; y++) {
                        if (x !== 0 || y !== 0) {
                            shadows.push(x + 'px ' + y + 'px 0 ' + this.current.bubbleColor);
                        }
                    }
                }
                textDisplay.style.textShadow = shadows.join(', ');
            } else {
                textDisplay.classList.remove('bubble-letters');
                textDisplay.style.textShadow = 'none';
            }
        }

        // Apply typing interval to keyboard module
        if (CVIKeyboard) {
            CVIKeyboard.minInterval = this.current.typingInterval;
        }

        // Apply image panel background color
        var imagePanel = document.getElementById('image-panel');
        if (imagePanel) {
            imagePanel.style.backgroundColor = this.current.imageBgColor;
        }

        // Apply image size
        var wordImage = document.getElementById('word-image');
        if (wordImage) {
            wordImage.style.maxHeight = this.current.imageSize + 'vh';
        }

        // Apply image label size
        var imageLabel = document.getElementById('image-label');
        if (imageLabel) {
            imageLabel.style.fontSize = this.current.imageLabelSize + 'px';
        }

        // Apply arrow settings — refresh arrow state if images module is live
        if (typeof CVIImages !== 'undefined') {
            CVIImages._updateArrows();
        }

        // Re-run pre-loading whenever settings are saved, in case the word list changed
        if (typeof CVIImages !== 'undefined' && this.current.preloadWords) {
            CVIImages.preloadWords(this.current.preloadWords);
        }
    },

    /**
     * Check if a word should display an image based on filters
     */
    shouldShowImage(word) {
        if (!word) return false;

        var normalized = word.toLowerCase().trim();

        // Always check blocked words first — these override everything
        if (this.current.blockedWordList) {
            var blockedWords = this.current.blockedWordList
                .toLowerCase()
                .split(',')
                .map(function(w) { return w.trim(); })
                .filter(function(w) { return w.length > 0; });

            for (var b = 0; b < blockedWords.length; b++) {
                if (normalized === blockedWords[b] ||
                    normalized.indexOf(blockedWords[b]) !== -1) {
                    return false;
                }
            }
        }

        // If using custom word list only
        if (this.current.customWordListEnabled) {
            var allowedWords = this.current.customWordList
                .toLowerCase()
                .split(',')
                .map(function(w) { return w.trim(); })
                .filter(function(w) { return w.length > 0; });

            return allowedWords.indexOf(normalized) !== -1;
        }

        // If filtering profanity
        if (this.current.filterProfanity) {
            for (var i = 0; i < this.profanityList.length; i++) {
                if (normalized === this.profanityList[i] ||
                    normalized.indexOf(this.profanityList[i]) !== -1) {
                    return false;
                }
            }
        }

        return true;
    },

    /**
     * Populate the session word history display inside the settings panel.
     */
    _populateWordHistory() {
        var historyEl = document.getElementById('session-word-history');
        if (!historyEl) return;

        var history = CVIDisplay ? CVIDisplay.getWordHistory() : [];
        if (!history || history.length === 0) {
            historyEl.textContent = 'No words typed yet this session.';
            return;
        }

        // Build a chronological list: "time — word"
        historyEl.textContent = history.map(function(entry) {
            return entry.timestamp + '  —  ' + entry.word.toUpperCase();
        }).join('\n');
    },

    /**
     * Get current settings
     */
    getSettings() {
        return this.current;
    }
};
