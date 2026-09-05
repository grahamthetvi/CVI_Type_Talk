/**
 * CVI Type Talker - Application Entry Point
 * Initializes all modules and manages app lifecycle.
 */
const CVIApp = {
    async init() {
        await CVII18n.init();

        async function applyLanguageChange(code) {
            await CVII18n.setLocale(code, true);
            var toolbarSel = document.getElementById('language-select');
            var welcomeSel = document.getElementById('welcome-language-select');
            if (toolbarSel) toolbarSel.value = code;
            if (welcomeSel) welcomeSel.value = code;
            if (typeof CVISpeech !== 'undefined' && CVISpeech.refreshVoice) {
                await CVISpeech.refreshVoice();
            }
            if (typeof CVIImages !== 'undefined' && CVIImages._showDefault) {
                CVIImages._showDefault();
            }
        }

        var langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.value = CVII18n.current;
            langSelect.addEventListener('change', function () {
                applyLanguageChange(langSelect.value).catch(function (e) {
                    console.error(e);
                });
            });
        }

        var welcomeLangSelect = document.getElementById('welcome-language-select');
        if (welcomeLangSelect) {
            welcomeLangSelect.value = CVII18n.current;
            welcomeLangSelect.addEventListener('change', function () {
                applyLanguageChange(welcomeLangSelect.value).catch(function (e) {
                    console.error(e);
                });
            });
        }

        // Initialize modules
        if (typeof CVILocalImages !== 'undefined') {
            await CVILocalImages.init().catch(e => console.error("Failed to init CVILocalImages", e));
        }
        CVISettings.init();
        if (typeof CVIWordDictionary !== 'undefined') {
            await CVIWordDictionary.init().catch(function (e) {
                console.error('Failed to init CVIWordDictionary', e);
            });
            if (typeof CVILocalImages !== 'undefined' && CVILocalImages.getAllImages) {
                try {
                    var customImages = await CVILocalImages.getAllImages();
                    customImages.forEach(function (entry) {
                        CVIWordDictionary.registerWord(entry.word);
                    });
                } catch (e) {
                    console.error('Failed to register custom image words', e);
                }
            }
        }
        if (typeof CVITypingHistory !== 'undefined') {
            CVITypingHistory.init();
        }
        CVIDisplay.init();
        CVIImages.init();
        if (CVISpeech.isSupported()) {
            await CVISpeech.init();
        } else {
            document.getElementById('status-text').textContent =
                CVII18n.t('ttsNotSupported.warning');
        }
        CVIKeyboard.init();

        // Start pre-loading images in the background immediately.
        // Uses a short delay so the browser can finish rendering first.
        var preloadList = CVISettings.getSettings().preloadWords;
        if (preloadList) {
            setTimeout(function () {
                CVIImages.preloadWords(preloadList);
            }, 800);
        }

        // Instructions first; first-time visitors see consent after "Start Typing"
        var consentOverlay = document.getElementById('consent-overlay');
        var consentAcceptBtn = document.getElementById('consent-accept-btn');
        var overlay = document.getElementById('instructions-overlay');
        var startBtn = document.getElementById('start-button');
        var hasConsent = false;
        try {
            hasConsent = localStorage.getItem('cvi-consent-accepted') === 'true';
        } catch (e) { /* ignore */ }

        if (consentOverlay) {
            consentOverlay.classList.add('hidden');
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(consentOverlay);
        }
        if (overlay) {
            overlay.classList.remove('hidden');
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.trap(overlay);
        }
        if (startBtn) {
            startBtn.focus();
        }

        function beginApp() {
            if (overlay) {
                overlay.classList.add('hidden');
                if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(overlay);
            }
            if (consentOverlay) {
                consentOverlay.classList.add('hidden');
                if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(consentOverlay);
            }
            if (typeof CVITypingHistory !== 'undefined') {
                CVITypingHistory.startSession();
            }
            CVIKeyboard.enable();

            if (typeof CVIImages !== 'undefined' && CVIImages.requestCameraPermission) {
                CVIImages.requestCameraPermission();
            }

            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(function () {
                    // Fullscreen denied — continue without it
                });
            }

            document.getElementById('text-display').focus();
            CVISpeech.speakSystem(CVII18n.t('systemSpeech.ready'));
        }

        if (overlay && startBtn) {
            startBtn.addEventListener('click', function () {
                if (!hasConsent) {
                    overlay.classList.add('hidden');
                    if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(overlay);
                    if (consentOverlay) {
                        consentOverlay.classList.remove('hidden');
                        if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.trap(consentOverlay);
                    }
                    if (consentAcceptBtn) consentAcceptBtn.focus();
                } else {
                    beginApp();
                }
            });
        }

        if (consentAcceptBtn) {
            consentAcceptBtn.addEventListener('click', function () {
                try {
                    localStorage.setItem('cvi-consent-accepted', 'true');
                } catch (e) {
                    console.error('Failed to persist consent:', e);
                }
                hasConsent = true;
                beginApp();
            });
        }

        // Pause speech when tab is hidden; finalize session when leaving
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                CVISpeech.stop();
            }
        });

        function finalizeTypingSession() {
            if (typeof CVITypingHistory === 'undefined' || !CVITypingHistory.activeSession) return;
            CVITypingHistory.endSession({
                wpm: CVIKeyboard.getWPM(),
                lpm: CVIKeyboard.getLPM(),
                letterCount: CVIKeyboard.letterCount
            });
        }

        function onPageLeave() {
            finalizeTypingSession();
            if (typeof CVIBackgroundRemoval !== 'undefined' && CVIBackgroundRemoval.clearCache) {
                CVIBackgroundRemoval.clearCache();
            }
        }

        window.addEventListener('pagehide', onPageLeave);
        window.addEventListener('beforeunload', finalizeTypingSession);

        // ── Image Lightbox ────────────────────────────────────────────────
        // Clicking the image opens a near-fullscreen expanded view.
        // Prev/next arrows and Escape / X / backdrop click all close it.
        var lightbox = document.getElementById('image-lightbox');
        var lightboxImg = document.getElementById('lightbox-image');
        var lightboxClose = document.getElementById('lightbox-close');
        var lightboxPrev = document.getElementById('lightbox-prev');
        var lightboxNext = document.getElementById('lightbox-next');
        var lightboxLabel = document.getElementById('lightbox-label');
        var lightboxBgRemoval = document.getElementById('lightbox-bg-removal');
        var lightboxOutline = document.getElementById('lightbox-outline');
        var lightboxOutlineColor = document.getElementById('lightbox-outline-color');
        var lightboxOutlineColorWrap = document.getElementById('lightbox-outline-color-wrap');
        var lightboxDownload = document.getElementById('lightbox-download');
        var lightboxStatus = document.getElementById('lightbox-status');
        var wordImageEl = document.getElementById('word-image');
        var _lightboxPreviousFocus = null;
        var _lightboxDisplayRequest = 0;
        var _lightboxRevokeUrls = [];

        // Word shown in the lightbox — used to detect when to auto-close
        var _lightboxWord = '';
        var _lightboxOriginalSrc = '';

        function _revokeLightboxUrls() {
            _lightboxRevokeUrls.forEach(function(url) {
                if (url && url.indexOf('blob:') === 0) {
                    URL.revokeObjectURL(url);
                }
            });
            _lightboxRevokeUrls = [];
        }

        function _setLightboxStatus(message) {
            if (lightboxStatus) lightboxStatus.textContent = message || '';
        }

        function _syncLightboxOutlineControls() {
            var outlineOn = lightboxOutline && lightboxOutline.checked;
            if (lightboxOutlineColorWrap) {
                lightboxOutlineColorWrap.classList.toggle('disabled', !outlineOn);
            }
            if (lightboxOutlineColor) {
                lightboxOutlineColor.disabled = !outlineOn;
            }
        }

        function _getLightboxOriginalSrc() {
            var photos = CVIImages._currentPhotos;
            var index = CVIImages._currentPhotoIndex;
            if (photos && photos[index] && photos[index].url) {
                return photos[index].url;
            }
            return wordImageEl ? wordImageEl.src : '';
        }

        function _updateLightboxImage(src) {
            if (!lightboxImg || !src) return;
            _lightboxOriginalSrc = src;
            var requestId = ++_lightboxDisplayRequest;
            var bgRemovalOn = lightboxBgRemoval && lightboxBgRemoval.checked;
            var outlineOn = lightboxOutline && lightboxOutline.checked;
            var outlineColor = lightboxOutlineColor ? lightboxOutlineColor.value : '#FFFF00';

            _revokeLightboxUrls();
            lightboxImg.classList.add('processing');
            _setLightboxStatus(CVII18n.t('lightbox.processing'));

            var options = {
                bgRemoval: bgRemovalOn,
                outline: outlineOn,
                outlineColor: outlineColor,
                outlineThickness: 6,
                silent: true
            };

            var finish = function(displayUrl) {
                if (requestId !== _lightboxDisplayRequest) return;
                lightboxImg.src = displayUrl;
                lightboxImg.classList.remove('processing');
                _setLightboxStatus('');
            };

            if ((bgRemovalOn || outlineOn) && typeof CVIBackgroundRemoval !== 'undefined') {
                CVIBackgroundRemoval.processForDisplay(src, _lightboxWord, options)
                    .then(function(result) {
                        if (requestId !== _lightboxDisplayRequest) {
                            if (result.revoke) {
                                result.revoke.forEach(function(url) { URL.revokeObjectURL(url); });
                            }
                            return;
                        }
                        if (result.revoke) {
                            _lightboxRevokeUrls = result.revoke.slice();
                        }
                        finish(result.url);
                    })
                    .catch(function() {
                        if (requestId !== _lightboxDisplayRequest) return;
                        lightboxImg.classList.remove('processing');
                        _setLightboxStatus('');
                        finish(src);
                    });
            } else {
                finish(src);
            }
        }

        function openLightbox() {
            if (!wordImageEl || wordImageEl.hidden || !wordImageEl.src) return;
            _lightboxPreviousFocus = document.activeElement;
            _lightboxWord = CVIImages._currentWord;

            var settings = CVISettings ? CVISettings.getSettings() : null;
            if (lightboxBgRemoval) {
                lightboxBgRemoval.checked = settings ? !!settings.removeBackground : false;
            }
            if (lightboxOutline) lightboxOutline.checked = false;
            if (lightboxOutlineColor) lightboxOutlineColor.value = '#FFFF00';
            _syncLightboxOutlineControls();

            lightboxImg.alt = wordImageEl.alt;
            if (lightboxLabel) lightboxLabel.textContent = CVIImages._currentWord.toUpperCase();
            _syncLightboxArrows();
            _updateLightboxImage(_getLightboxOriginalSrc());
            lightbox.classList.remove('hidden');
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.trap(lightbox);
            if (CVIKeyboard) CVIKeyboard.disable();
            if (lightboxClose) lightboxClose.focus();
        }

        function closeLightbox() {
            if (!lightbox || lightbox.classList.contains('hidden')) return;
            _lightboxDisplayRequest++;
            _revokeLightboxUrls();
            lightbox.classList.add('hidden');
            _lightboxWord = '';
            _lightboxOriginalSrc = '';
            _setLightboxStatus('');
            if (lightboxImg) lightboxImg.classList.remove('processing');
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(lightbox);
            if (CVIKeyboard) {
                var instructions = document.getElementById('instructions-overlay');
                var settingsPanel = document.getElementById('settings-panel');
                var guideModal = document.getElementById('settings-guide-modal');
                var settingsOpen = settingsPanel && settingsPanel.classList.contains('visible');
                var guideOpen = guideModal && !guideModal.hasAttribute('hidden');
                if ((!instructions || instructions.classList.contains('hidden')) && !settingsOpen && !guideOpen) {
                    CVIKeyboard.enable();
                }
            }
            if (_lightboxPreviousFocus && _lightboxPreviousFocus.focus) {
                _lightboxPreviousFocus.focus();
            } else {
                document.getElementById('text-display').focus();
            }
            _lightboxPreviousFocus = null;
        }

        function _syncLightboxArrows() {
            var settings = CVISettings ? CVISettings.getSettings() : null;
            var arrowsEnabled = settings ? settings.arrowsEnabled : true;
            var arrowColor = settings ? (settings.arrowColor || '#FFFF00') : '#FFFF00';
            var show = CVIImages._currentPhotos.length > 1 && arrowsEnabled;
            if (lightboxPrev) {
                lightboxPrev.style.display = show ? 'flex' : 'none';
                lightboxPrev.style.borderColor = arrowColor;
                lightboxPrev.style.color = arrowColor;
            }
            if (lightboxNext) {
                lightboxNext.style.display = show ? 'flex' : 'none';
                lightboxNext.style.borderColor = arrowColor;
                lightboxNext.style.color = arrowColor;
            }
        }

        // Open lightbox when the main image is clicked
        if (wordImageEl) {
            wordImageEl.addEventListener('click', openLightbox);
        }

        // Close on X button or clicking the dark backdrop
        if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
        if (lightbox) {
            lightbox.addEventListener('click', function (e) {
                if (e.target === lightbox) closeLightbox();
            });
        }

        // Lightbox arrows delegate to CVIImages which triggers _displayImage
        if (lightboxPrev) lightboxPrev.addEventListener('click', function () { CVIImages.showPrevPhoto(); });
        if (lightboxNext) lightboxNext.addEventListener('click', function () { CVIImages.showNextPhoto(); });

        if (lightboxBgRemoval) {
            lightboxBgRemoval.addEventListener('change', function () {
                if (!lightbox.classList.contains('hidden')) {
                    _updateLightboxImage(_lightboxOriginalSrc || _getLightboxOriginalSrc());
                }
            });
        }
        if (lightboxOutline) {
            lightboxOutline.addEventListener('change', function () {
                _syncLightboxOutlineControls();
                if (!lightbox.classList.contains('hidden')) {
                    _updateLightboxImage(_lightboxOriginalSrc || _getLightboxOriginalSrc());
                }
            });
        }
        if (lightboxOutlineColor) {
            lightboxOutlineColor.addEventListener('input', function () {
                if (!lightbox.classList.contains('hidden') && lightboxOutline && lightboxOutline.checked) {
                    _updateLightboxImage(_lightboxOriginalSrc || _getLightboxOriginalSrc());
                }
            });
        }
        if (lightboxDownload) {
            lightboxDownload.addEventListener('click', function () {
                if (!lightboxImg || !lightboxImg.src) return;
                var filename = (_lightboxWord || 'image') + '.png';
                fetch(lightboxImg.src)
                    .then(function(response) { return response.blob(); })
                    .then(function(blob) {
                        var url = URL.createObjectURL(blob);
                        var link = document.createElement('a');
                        link.href = url;
                        link.download = filename;
                        link.click();
                        URL.revokeObjectURL(url);
                    })
                    .catch(function() {
                        _setLightboxStatus(CVII18n.t('lightbox.downloadFailed'));
                    });
            });
        }

        // Arrow keys navigate photos while the lightbox is open (keyboard module is disabled there)
        document.addEventListener('keydown', function (e) {
            if (!lightbox || lightbox.classList.contains('hidden')) return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                CVIImages.showPrevPhoto();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                CVIImages.showNextPhoto();
            }
        });

        // Escape key closes the lightbox
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
                closeLightbox();
            }
        });

        // Patch CVIImages._displayImage so the lightbox stays in sync with
        // navigation, and auto-closes if the word changes while it is open.
        var _origDisplayImage = CVIImages._displayImage.bind(CVIImages);
        CVIImages._displayImage = function (src, word, title) {
            _origDisplayImage(src, word, title);
            if (lightbox && !lightbox.classList.contains('hidden')) {
                if (word === _lightboxWord) {
                    // Same word, different photo — update lightbox image with processing options
                    _updateLightboxImage(src);
                    _syncLightboxArrows();
                } else {
                    // New word typed — close lightbox so student can see the panel
                    closeLightbox();
                }
            }
        };
    }
};

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { CVIApp.init(); });
} else {
    CVIApp.init();
}
