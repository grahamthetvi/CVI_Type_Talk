/**
 * CVI Type Talker - Application Entry Point
 * Initializes all modules and manages app lifecycle.
 */
const CVIApp = {
    async init() {
        // Initialize modules
        CVISettings.init();
        CVIDisplay.init();
        CVIImages.init();
        await CVISpeech.init();
        CVIKeyboard.init();

        // Start pre-loading images in the background immediately.
        // Uses a short delay so the browser can finish rendering first.
        var preloadList = CVISettings.getSettings().preloadWords;
        if (preloadList) {
            setTimeout(function() {
                CVIImages.preloadWords(preloadList);
            }, 800);
        }

        // Warn if TTS is not supported
        if (!CVISpeech.isSupported()) {
            document.getElementById('status-text').textContent =
                'Warning: Text-to-speech is not supported in this browser. Please use Chrome, Edge, Firefox, or Safari.';
        }

        // Set up the start button and overlay
        var overlay = document.getElementById('instructions-overlay');
        var startBtn = document.getElementById('start-button');

        if (overlay && startBtn) {
            startBtn.addEventListener('click', function() {
                overlay.classList.add('hidden');
                CVIKeyboard.enable();

                // Request fullscreen (best effort, may be blocked)
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(function() {
                        // Fullscreen denied — continue without it
                    });
                }

                // Focus the text display so keyboard events are captured
                document.getElementById('text-display').focus();

                // Welcome message
                CVISpeech.speakSystem('Ready. Start typing.');
            });
        }

        // Pause speech when tab is hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                CVISpeech.stop();
            }
        });

        // ── Image Lightbox ────────────────────────────────────────────────
        // Clicking the image opens a near-fullscreen expanded view.
        // Prev/next arrows and Escape / X / backdrop click all close it.
        var lightbox      = document.getElementById('image-lightbox');
        var lightboxImg   = document.getElementById('lightbox-image');
        var lightboxClose = document.getElementById('lightbox-close');
        var lightboxPrev  = document.getElementById('lightbox-prev');
        var lightboxNext  = document.getElementById('lightbox-next');
        var lightboxLabel = document.getElementById('lightbox-label');
        var wordImageEl   = document.getElementById('word-image');

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
            lightbox.addEventListener('click', function(e) {
                if (e.target === lightbox) closeLightbox();
            });
        }

        // Lightbox arrows delegate to CVIImages which triggers _displayImage
        if (lightboxPrev) lightboxPrev.addEventListener('click', function() { CVIImages.showPrevPhoto(); });
        if (lightboxNext) lightboxNext.addEventListener('click', function() { CVIImages.showNextPhoto(); });

        // Escape key closes the lightbox
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && lightbox && !lightbox.classList.contains('hidden')) {
                closeLightbox();
            }
        });

        // Patch CVIImages._displayImage so the lightbox stays in sync with
        // navigation, and auto-closes if the word changes while it is open.
        var _origDisplayImage = CVIImages._displayImage.bind(CVIImages);
        CVIImages._displayImage = function(src, word, title) {
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
    document.addEventListener('DOMContentLoaded', function() { CVIApp.init(); });
} else {
    CVIApp.init();
}
