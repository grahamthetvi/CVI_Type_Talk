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
                applyLanguageChange(langSelect.value);
            });
        }

        var welcomeLangSelect = document.getElementById('welcome-language-select');
        if (welcomeLangSelect) {
            welcomeLangSelect.value = CVII18n.current;
            welcomeLangSelect.addEventListener('change', function () {
                applyLanguageChange(welcomeLangSelect.value);
            });
        }

        // Initialize modules
        if (typeof CVILocalImages !== 'undefined') {
            await CVILocalImages.init().catch(e => console.error("Failed to init CVILocalImages", e));
        }
        CVISettings.init();
        CVIDisplay.init();
        CVIImages.init();
        await CVISpeech.init();
        CVIKeyboard.init();

        // Start pre-loading images in the background immediately.
        // Uses a short delay so the browser can finish rendering first.
        var preloadList = CVISettings.getSettings().preloadWords;
        if (preloadList) {
            setTimeout(function () {
                CVIImages.preloadWords(preloadList);
            }, 800);
        }

        // Warn if TTS is not supported
        if (!CVISpeech.isSupported()) {
            document.getElementById('status-text').textContent =
                CVII18n.t('ttsNotSupported.warning');
        }

        // Instructions first; first-time visitors see consent after "Start Typing"
        var consentOverlay = document.getElementById('consent-overlay');
        var consentAcceptBtn = document.getElementById('consent-accept-btn');
        var overlay = document.getElementById('instructions-overlay');
        var startBtn = document.getElementById('start-button');
        var hasConsent = localStorage.getItem('cvi-consent-accepted') === 'true';

        if (consentOverlay) {
            consentOverlay.classList.add('hidden');
        }
        if (overlay) {
            overlay.classList.remove('hidden');
        }
        if (startBtn) {
            startBtn.focus();
        }

        function beginApp() {
            if (overlay) overlay.classList.add('hidden');
            if (consentOverlay) consentOverlay.classList.add('hidden');
            CVIKeyboard.enable();

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
                    if (consentOverlay) consentOverlay.classList.remove('hidden');
                    if (consentAcceptBtn) consentAcceptBtn.focus();
                } else {
                    beginApp();
                }
            });
        }

        if (consentAcceptBtn) {
            consentAcceptBtn.addEventListener('click', function () {
                localStorage.setItem('cvi-consent-accepted', 'true');
                hasConsent = true;
                beginApp();
            });
        }

        // Pause speech when tab is hidden
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                CVISpeech.stop();
            }
        });

        // ── Image Lightbox ────────────────────────────────────────────────
        // Clicking the image opens a near-fullscreen expanded view.
        // Prev/next arrows and Escape / X / backdrop click all close it.
        var lightbox = document.getElementById('image-lightbox');
        var lightboxImg = document.getElementById('lightbox-image');
        var lightboxClose = document.getElementById('lightbox-close');
        var lightboxPrev = document.getElementById('lightbox-prev');
        var lightboxNext = document.getElementById('lightbox-next');
        var lightboxLabel = document.getElementById('lightbox-label');
        var wordImageEl = document.getElementById('word-image');

        // Word shown in the lightbox — used to detect when to auto-close
        var _lightboxWord = '';

        function openLightbox() {
            if (!wordImageEl || wordImageEl.hidden || !wordImageEl.src) return;
            _lightboxWord = CVIImages._currentWord;
            lightboxImg.src = wordImageEl.src;
            lightboxImg.alt = wordImageEl.alt;
            if (lightboxLabel) lightboxLabel.textContent = CVIImages._currentWord.toUpperCase();
            _syncLightboxArrows();
            lightbox.classList.remove('hidden');
            if (lightboxClose) lightboxClose.focus();
        }

        function closeLightbox() {
            lightbox.classList.add('hidden');
            _lightboxWord = '';
            document.getElementById('text-display').focus();
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
                    // Same word, different photo — update lightbox image
                    lightboxImg.src = src;
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
