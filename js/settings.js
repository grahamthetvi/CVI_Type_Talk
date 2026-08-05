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
        arrowSize: 56,
        cursorStyle: 'default',
        preloadWords: '',
        imageSize: 55,
        imageLabelSize: 48,
        studentName: ''
    },

    current: {},
    previousFocus: null,
    focusableElements: [],
    _lastAppliedRemoveBackground: false,

    // Common profanity words to filter - now handled by CVIBadWords in badwords.js
    profanityList: [],

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
        try {
            localStorage.setItem('cvi-settings', JSON.stringify(this.current));
        } catch (e) {
            console.error('Failed to save settings:', e);
        }
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
            settingsBtn.addEventListener('click', function () {
                self.openPanel();
            });
        }

        var guideBtn = document.getElementById('settings-guide-button');
        if (guideBtn) {
            guideBtn.addEventListener('click', function () {
                self.openSettingsGuide('repeat');
            });
        }

        var guideDismiss = document.getElementById('guide-dismiss-btn');
        if (guideDismiss) {
            guideDismiss.addEventListener('click', function () {
                self.closeSettingsGuide();
            });
        }

        // Save settings
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                self.readFromUI();
                self.saveSettings();
                self.applySettings();
                self.closePanel();
            });
        }

        // Cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                self.closePanel();
                self.populateUI(); // Reset UI to saved values
            });
        }

        // Reset to defaults
        if (resetBtn) {
            resetBtn.addEventListener('click', function () {
                if (confirm(CVII18n.t('browserDialogs.resetConfirm'))) {
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
            fontSize.addEventListener('input', function () {
                fontSizeValue.textContent = this.value + 'px';
            });
        }

        var bubbleSize = document.getElementById('bubble-size');
        var bubbleSizeValue = document.getElementById('bubble-size-value');
        if (bubbleSize && bubbleSizeValue) {
            bubbleSize.addEventListener('input', function () {
                bubbleSizeValue.textContent = this.value + 'px';
            });
        }

        var typingInterval = document.getElementById('typing-interval');
        var typingIntervalValue = document.getElementById('typing-interval-value');
        if (typingInterval && typingIntervalValue) {
            typingInterval.addEventListener('input', function () {
                typingIntervalValue.textContent = this.value + 'ms';
            });
        }

        var maxKeys = document.getElementById('max-keys-per-second');
        var maxKeysValue = document.getElementById('max-keys-value');
        if (maxKeys && maxKeysValue) {
            maxKeys.addEventListener('input', function () {
                maxKeysValue.textContent = this.value;
            });
        }

        var imageSize = document.getElementById('image-size');
        var imageSizeValue = document.getElementById('image-size-value');
        if (imageSize && imageSizeValue) {
            imageSize.addEventListener('input', function () {
                imageSizeValue.textContent = this.value + 'vh';
            });
        }

        var imageLabelSize = document.getElementById('image-label-size');
        var imageLabelSizeValue = document.getElementById('image-label-size-value');
        if (imageLabelSize && imageLabelSizeValue) {
            imageLabelSize.addEventListener('input', function () {
                imageLabelSizeValue.textContent = this.value + 'px';
            });
        }

        var arrowSize = document.getElementById('arrow-size');
        var arrowSizeValue = document.getElementById('arrow-size-value');
        if (arrowSize && arrowSizeValue) {
            arrowSize.addEventListener('input', function() {
                arrowSizeValue.textContent = this.value + 'px';
            });
        }

        var addCustomImgBtn = document.getElementById('add-custom-image-btn');
        if (addCustomImgBtn) {
            addCustomImgBtn.addEventListener('click', function() {
                self.handleAddCustomImage();
            });
        }

        var customListEnabled = document.getElementById('custom-word-list-enabled');
        var customList = document.getElementById('custom-word-list');
        if (customListEnabled) {
            customListEnabled.addEventListener('change', function () {
                self._updateCustomWordListWarning();
            });
        }
        if (customList) {
            customList.addEventListener('input', function () {
                self._updateCustomWordListWarning();
            });
        }

        // Close on Escape key (settings guide takes priority over settings panel)
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                var guideModal = document.getElementById('settings-guide-modal');
                if (guideModal && !guideModal.hasAttribute('hidden')) {
                    self.closeSettingsGuide();
                    e.preventDefault();
                    return;
                }
            }
            if (e.key === 'Escape' && panel && panel.classList.contains('visible')) {
                self.closePanel();
                self.populateUI(); // Reset UI to saved values
            }
        });

        // Populate UI with current values
        this.populateUI();
        this._setupPastSessionsUI();

        document.addEventListener('cvi-locale-changed', function () {
            self._applySettingsPlaceholders();
            self.refreshWordHistoryIfOpen();
            self._populatePastSessions();
            self._populateCustomImagesList();
            var guideModal = document.getElementById('settings-guide-modal');
            if (guideModal && !guideModal.hasAttribute('hidden') && self._guideMode) {
                self._refreshSettingsGuideFooterForMode(self._guideMode);
            }
        });
    },

    /**
     * Open the settings panel.
     * On the very first click, show a one-time guide modal first.
     */
    openPanel() {
        this.previousFocus = document.activeElement;

        if (!localStorage.getItem('cvi-settings-guide-seen')) {
            var modal = document.getElementById('settings-guide-modal');
            if (modal) {
                this.openSettingsGuide('first');
                return;
            }
        }

        this._doOpenPanel();
    },

    /**
     * Update settings guide dismiss/footer when locale changes while modal is open.
     */
    _refreshSettingsGuideFooterForMode(mode) {
        var dismissBtn = document.getElementById('guide-dismiss-btn');
        var footerEl = document.getElementById('guide-footer-text');
        if (!dismissBtn) return;
        if (mode === 'first') {
            dismissBtn.textContent = CVII18n.t('settingsGuideModal.firstTimeDismiss');
            if (footerEl) {
                footerEl.textContent = CVII18n.t('settingsGuideModal.firstTimeFooter');
                footerEl.hidden = false;
            }
        } else {
            dismissBtn.textContent = CVII18n.t('settingsGuideModal.repeatDismiss');
            if (footerEl) {
                footerEl.textContent = CVII18n.t('settingsGuideModal.repeatFooter');
                footerEl.hidden = false;
            }
        }
    },

    /**
     * Show the settings guide (first visit from Settings, or anytime from the Guide button).
     * @param {'first'|'repeat'} mode - first: then opens Settings on dismiss; repeat: closes only
     */
    openSettingsGuide(mode) {
        var modal = document.getElementById('settings-guide-modal');
        var dismissBtn = document.getElementById('guide-dismiss-btn');
        var footerEl = document.getElementById('guide-footer-text');
        if (!modal || !dismissBtn) return;

        this._guideMode = mode;
        this._guideReturnFocus = document.activeElement;

        if (mode === 'first') {
            dismissBtn.textContent = CVII18n.t('settingsGuideModal.firstTimeDismiss');
            if (footerEl) {
                footerEl.textContent = CVII18n.t('settingsGuideModal.firstTimeFooter');
                footerEl.hidden = false;
            }
        } else {
            dismissBtn.textContent = CVII18n.t('settingsGuideModal.repeatDismiss');
            if (footerEl) {
                footerEl.textContent = CVII18n.t('settingsGuideModal.repeatFooter');
                footerEl.hidden = false;
            }
        }

        if (CVIKeyboard) CVIKeyboard.disable();
        modal.removeAttribute('hidden');
        if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.trap(modal);
        dismissBtn.focus();
        this._announceToScreenReader(CVII18n.t('screenReaderAnnouncements.settingsGuideOpened'));
    },

    /**
     * Dismiss the settings guide modal.
     */
    closeSettingsGuide() {
        var modal = document.getElementById('settings-guide-modal');
        if (!modal || modal.hasAttribute('hidden')) return;

        var mode = this._guideMode;
        modal.setAttribute('hidden', '');
        if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(modal);

        if (mode === 'first') {
            localStorage.setItem('cvi-settings-guide-seen', '1');
            this._doOpenPanel();
        } else {
            if (CVIKeyboard && CVIKeyboard.enabled !== undefined) {
                var overlay = document.getElementById('instructions-overlay');
                if (!overlay || overlay.classList.contains('hidden')) {
                    CVIKeyboard.enable();
                }
            }
            if (this._guideReturnFocus && this._guideReturnFocus.focus) {
                this._guideReturnFocus.focus();
            }
            this._announceToScreenReader(CVII18n.t('screenReaderAnnouncements.settingsGuideClosed'));
        }
        this._guideMode = null;
    },

    /**
     * Internal: actually show the settings panel (called directly or after guide dismiss).
     */
    _doOpenPanel() {
        var panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.add('visible');
            this.populateUI();

            // Disable keyboard input while settings are open
            if (CVIKeyboard) {
                CVIKeyboard.disable();
            }

            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.trap(panel);

            var settingsTitle = document.getElementById('settings-title');
            if (settingsTitle) {
                settingsTitle.setAttribute('tabindex', '-1');
                settingsTitle.focus();
            }

            // Announce to screen readers
            this._announceToScreenReader(CVII18n.t('screenReaderAnnouncements.settingsPanelOpened'));
        }
    },

    /**
     * Close the settings panel
     */
    closePanel() {
        var panel = document.getElementById('settings-panel');
        if (panel) {
            panel.classList.remove('visible');
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(panel);

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
            this._announceToScreenReader(CVII18n.t('screenReaderAnnouncements.settingsPanelClosed'));
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

        this._updateCustomWordListWarning();

        var blockedList = document.getElementById('blocked-word-list');
        if (blockedList) blockedList.value = this.current.blockedWordList;

        var arrowsEnabled = document.getElementById('arrows-enabled');
        if (arrowsEnabled) arrowsEnabled.checked = this.current.arrowsEnabled;

        var arrowColor = document.getElementById('arrow-color');
        if (arrowColor) arrowColor.value = this.current.arrowColor;

        var arrowSize = document.getElementById('arrow-size');
        var arrowSizeValue = document.getElementById('arrow-size-value');
        if (arrowSize) arrowSize.value = this.current.arrowSize || 56;
        if (arrowSizeValue) arrowSizeValue.textContent = (this.current.arrowSize || 56) + 'px';

        var cursorStyle = document.getElementById('cursor-style');
        if (cursorStyle) cursorStyle.value = this.current.cursorStyle || 'default';

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

        var studentName = document.getElementById('student-name');
        if (studentName) studentName.value = this.current.studentName || '';

        // Populate session word history
        this._populateWordHistory();
        this._populatePastSessions();

        // Populate custom local images list
        this._populateCustomImagesList();

        this._applySettingsPlaceholders();
    },

    /**
     * Set translated placeholders on settings inputs (locale-dependent).
     */
    _applySettingsPlaceholders() {
        if (typeof CVII18n === 'undefined' || !CVII18n.t) return;
        var base = 'settingsPanel.labelsAndControls.placeholders.';
        var sn = document.getElementById('student-name');
        if (sn) sn.placeholder = CVII18n.t(base + 'studentName');
        var pw = document.getElementById('preload-words');
        if (pw) pw.placeholder = CVII18n.t(base + 'preloadWords');
        var cw = document.getElementById('custom-word-list');
        if (cw) cw.placeholder = CVII18n.t(base + 'allowedWords');
        var bw = document.getElementById('blocked-word-list');
        if (bw) bw.placeholder = CVII18n.t(base + 'blockedWords');
        var ciw = document.getElementById('custom-image-word');
        if (ciw) ciw.placeholder = CVII18n.t(base + 'customImageWord');
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

        var arrowSize = document.getElementById('arrow-size');
        if (arrowSize) this.current.arrowSize = parseInt(arrowSize.value);

        var cursorStyle = document.getElementById('cursor-style');
        if (cursorStyle) this.current.cursorStyle = cursorStyle.value;

        var preloadWords = document.getElementById('preload-words');
        if (preloadWords) this.current.preloadWords = preloadWords.value;

        var imageSize = document.getElementById('image-size');
        if (imageSize) this.current.imageSize = parseInt(imageSize.value);

        var imageLabelSize = document.getElementById('image-label-size');
        if (imageLabelSize) this.current.imageLabelSize = parseInt(imageLabelSize.value);

        var studentName = document.getElementById('student-name');
        if (studentName) this.current.studentName = studentName.value;
    },

    /**
     * Show a warning when "custom word list only" is on but the list is empty.
     */
    _updateCustomWordListWarning() {
        var warning = document.getElementById('custom-word-list-empty-warning');
        if (!warning) return;
        var enabledEl = document.getElementById('custom-word-list-enabled');
        var listEl = document.getElementById('custom-word-list');
        var enabled = enabledEl ? enabledEl.checked : this.current.customWordListEnabled;
        var listValue = listEl ? listEl.value : this.current.customWordList;
        var hasWords = String(listValue || '').split(',').some(function (w) {
            return w.trim().length > 0;
        });
        if (enabled && !hasWords) {
            warning.hidden = false;
        } else {
            warning.hidden = true;
        }
    },

    /**
     * Apply current settings to the application
     */
    applySettings() {
        var previousRemoveBackground = this._lastAppliedRemoveBackground;
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

        // Apply image size via max-height so both dimensions scale
        // proportionally — height alone would distort wide images.
        var wordImage = document.getElementById('word-image');
        if (wordImage) {
            wordImage.style.maxHeight = this.current.imageSize + 'vh';
        }

        // Apply cursor style
        document.body.style.cursor = this.current.cursorStyle;

        // Apply image label size
        var imageLabel = document.getElementById('image-label');
        if (imageLabel) {
            imageLabel.style.fontSize = this.current.imageLabelSize + 'px';
        }

        // Apply arrow settings — refresh arrow state if images module is live
        if (typeof CVIImages !== 'undefined') {
            CVIImages._updateArrows();
        }

        // Clear background-removal blob cache when the feature is turned off
        if (previousRemoveBackground && !this.current.removeBackground) {
            if (typeof CVIBackgroundRemoval !== 'undefined' && CVIBackgroundRemoval.clearCache) {
                CVIBackgroundRemoval.clearCache();
            }
        }
        this._lastAppliedRemoveBackground = !!this.current.removeBackground;

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
                .map(function (w) { return w.trim(); })
                .filter(function (w) { return w.length > 0; });

            for (var b = 0; b < blockedWords.length; b++) {
                // Exact token match only — substring matching blocked legitimate words
                // (e.g. blocking "ass" also blocked "class" / "glass").
                if (normalized === blockedWords[b]) {
                    return false;
                }
            }
        }

        // If using custom word list only — empty list means "not configured"
        if (this.current.customWordListEnabled) {
            var allowedWords = this.current.customWordList
                .toLowerCase()
                .split(',')
                .map(function (w) { return w.trim(); })
                .filter(function (w) { return w.length > 0; });

            if (allowedWords.length > 0) {
                return allowedWords.indexOf(normalized) !== -1;
            }
            // Fall through to blocked/profanity/default when allow-list is empty
        }

        // If filtering profanity
        if (this.current.filterProfanity && typeof CVIBadWords !== 'undefined') {
            if (CVIBadWords.check(normalized)) {
                return false;
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

        var history = typeof CVITypingHistory !== 'undefined'
            ? CVITypingHistory.getActiveWords()
            : (CVIDisplay ? CVIDisplay.getWordHistory() : []);
        if (!history || history.length === 0) {
            historyEl.textContent = CVII18n.t('settingsPanel.labelsAndControls.historyTextareaPlaceholder');
            return;
        }

        historyEl.textContent = history.map(function (entry) {
            if (typeof CVITypingHistory !== 'undefined') {
                return CVITypingHistory.formatWordLine(entry);
            }
            return entry.timestamp + '  —  ' + entry.word;
        }).join('\n');
    },

    /**
     * Populate the past sessions selector and detail view.
     */
    _populatePastSessions() {
        var selectEl = document.getElementById('past-session-select');
        var detailEl = document.getElementById('past-session-detail');
        if (!selectEl || !detailEl || typeof CVITypingHistory === 'undefined') return;

        var past = CVITypingHistory.getPastSessions();
        var selectedId = selectEl.value;

        selectEl.innerHTML = '';
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = past.length === 0
            ? CVII18n.t('settingsPanel.labelsAndControls.pastSessionsEmpty')
            : CVII18n.t('settingsPanel.labelsAndControls.pastSessionsPlaceholder');
        selectEl.appendChild(placeholder);

        past.forEach(function (session) {
            var opt = document.createElement('option');
            opt.value = session.id;
            opt.textContent = CVITypingHistory.formatSessionLabel(session);
            selectEl.appendChild(opt);
        });

        if (selectedId && past.some(function (s) { return s.id === selectedId; })) {
            selectEl.value = selectedId;
        }

        this._populatePastSessionDetail(selectEl.value);
    },

    _populatePastSessionDetail(sessionId) {
        var detailEl = document.getElementById('past-session-detail');
        if (!detailEl || typeof CVITypingHistory === 'undefined') return;

        if (!sessionId) {
            detailEl.textContent = CVII18n.t('settingsPanel.labelsAndControls.pastSessionDetailPlaceholder');
            return;
        }

        var session = CVITypingHistory.getPastSessions().find(function (s) {
            return s.id === sessionId;
        });
        if (!session || !session.words.length) {
            detailEl.textContent = CVII18n.t('settingsPanel.labelsAndControls.pastSessionDetailPlaceholder');
            return;
        }

        detailEl.textContent = session.words.map(function (entry) {
            return CVITypingHistory.formatWordLine(entry);
        }).join('\n');
    },

    _setupPastSessionsUI() {
        var self = this;
        var selectEl = document.getElementById('past-session-select');
        if (selectEl) {
            selectEl.addEventListener('change', function () {
                self._populatePastSessionDetail(selectEl.value);
            });
        }

        var clearBtn = document.getElementById('clear-typing-history');
        if (clearBtn) {
            clearBtn.addEventListener('click', function () {
                if (confirm(CVII18n.t('browserDialogs.clearTypingHistoryConfirm'))) {
                    CVITypingHistory.clearAll();
                    if (CVIKeyboard) {
                        CVIKeyboard.sessionStartTime = Date.now();
                        CVIKeyboard.letterCount = 0;
                        CVIKeyboard.wordCount = 0;
                        if (CVIKeyboard.enabled) {
                            CVITypingHistory.startSession();
                        }
                    }
                    self._populateWordHistory();
                    self._populatePastSessions();
                }
            });
        }
    },

    /**
     * Refresh the session word history list if the settings panel is open.
     */
    refreshWordHistoryIfOpen() {
        var panel = document.getElementById('settings-panel');
        if (panel && panel.classList.contains('visible')) {
            this._populateWordHistory();
            this._populatePastSessions();
        }
    },

    /**
     * Handle adding a custom image from the UI
     */
    handleAddCustomImage() {
        var wordInput = document.getElementById('custom-image-word');
        var fileInput = document.getElementById('custom-image-file');
        if (!wordInput || !fileInput) return;

        var word = wordInput.value.trim();
        var file = fileInput.files[0];

        if (!word) {
            alert(CVII18n.t('browserDialogs.enterWordAlert'));
            return;
        }
        if (!file) {
            alert(CVII18n.t('browserDialogs.selectImageAlert'));
            return;
        }

        var reader = new FileReader();
        var self = this;
        reader.onload = function(e) {
            var dataUrl = e.target.result;
            if (typeof CVILocalImages !== 'undefined') {
                CVILocalImages.saveImage(word, dataUrl).then(function() {
                    wordInput.value = '';
                    fileInput.value = '';
                    self._populateCustomImagesList();
                }).catch(function(err) {
                    alert(CVII18n.t('browserDialogs.errorSavingImage', { message: err.message }));
                });
            }
        };
        reader.readAsDataURL(file);
    },

    /**
     * Populate the custom images list in settings
     */
    _populateCustomImagesList() {
        var listContainer = document.getElementById('custom-images-list');
        if (!listContainer || typeof CVILocalImages === 'undefined') return;

        var self = this;
        CVILocalImages.getAllImages().then(function(images) {
            listContainer.innerHTML = '';
            if (images.length === 0) {
                listContainer.innerHTML = '<p class="setting-note">' + CVII18n.t('customImagesList.emptyState') + '</p>';
                return;
            }

            images.forEach(function(imgData) {
                var item = document.createElement('div');
                item.className = 'custom-image-item';

                var img = document.createElement('img');
                img.src = imgData.dataUrl;
                img.className = 'custom-image-thumbnail';
                
                var span = document.createElement('span');
                span.textContent = imgData.word.toUpperCase();
                span.className = 'custom-image-word';

                var btn = document.createElement('button');
                btn.textContent = CVII18n.t('customImagesList.buttonRemove');
                btn.className = 'custom-image-remove-btn';
                btn.onclick = function() {
                    if (confirm(CVII18n.t('browserDialogs.removeCustomImageConfirm', { word: imgData.word }))) {
                        CVILocalImages.removeImage(imgData.word).then(function() {
                            self._populateCustomImagesList();
                        });
                    }
                };

                item.appendChild(img);
                item.appendChild(span);
                item.appendChild(btn);
                listContainer.appendChild(item);
            });
        });
    },

    /**
     * Get current settings
     */
    getSettings() {
        return this.current;
    }
};
