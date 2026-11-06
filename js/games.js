/**
 * CVI Type Talker - Skill games
 * Drive: type a vehicle word and steer it.
 * Pop: click one large target.
 * Arrows: move with the arrow keys.
 */
var CVIGames = {
    ALIASES: {
        car: ['car', 'coche', 'carro', 'auto', 'voiture', 'automobile', 'سيارة'],
        truck: ['truck', 'camion', 'camioneta', 'pickup', 'شاحنة'],
        van: ['van', 'furgoneta', 'fourgon', 'fourgonnette', 'فان'],
        suv: ['suv', 'todoterreno', 'vus', 'jeep', '4x4', 'جيب']
    },

    VEHICLE_COLOR: {
        car: '#FFE600',
        truck: '#FF2D2D',
        van: '#00E5FF',
        suv: '#FF9F1A'
    },

    _inited: false,
    _raf: 0,
    _lastTs: 0,
    _returnFocus: null,
    _aliasMap: null,
    mode: null,
    drive: null,
    pop: null,
    arrow: null,

    normalizeWord: function (word) {
        if (word == null) return '';
        var s = String(word).trim().toLowerCase();
        if (typeof s.normalize === 'function') {
            s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }
        return s.replace(/[\s-]+/g, '');
    },

    vehicleForWord: function (word) {
        var normalized = this.normalizeWord(word);
        if (!normalized) return null;
        var id = this._aliasId(normalized);
        if (id) return id;
        var stem = this._pluralStem(normalized);
        if (stem) {
            id = this._aliasId(stem);
            if (id) return id;
        }
        id = this._localeVehicleId(normalized);
        if (id) return id;
        if (stem) return this._localeVehicleId(stem);
        return null;
    },

    laneFromRatio: function (x) {
        if (!(x >= 0)) return 0;
        if (x >= 1) return 2;
        if (x < 1 / 3) return 0;
        if (x < 2 / 3) return 1;
        return 2;
    },

    catchesLight: function (lightY, lightLane, vehicleLane) {
        return lightLane === vehicleLane && lightY >= 68 && lightY <= 96;
    },

    reachedGoal: function (px, py, gx, gy) {
        var dx = px - gx;
        var dy = py - gy;
        return dx * dx + dy * dy < 0.0196;
    },

    popDiameter: function (count, fieldMin) {
        var scale = 0.42;
        if (count >= 8) scale = 0.28;
        else if (count >= 4) scale = 0.34;
        var size = Math.round((fieldMin || 320) * scale);
        if (size < 140) size = 140;
        return size;
    },

    init: function () {
        if (this._inited) return;
        this._inited = true;
        var self = this;

        document.addEventListener('keydown', function (event) {
            self._onKeyDown(event);
        }, true);

        document.addEventListener('cvi-locale-changed', function () {
            self._onLocale();
        });

        var welcome = document.getElementById('games-welcome-button');
        if (welcome) {
            welcome.addEventListener('click', function () {
                self.open();
            });
        }

        var toolbar = document.getElementById('games-button');
        if (toolbar) {
            toolbar.addEventListener('click', function () {
                self.open();
            });
        }

        var overlay = document.getElementById('games-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (event) {
                self._onOverlayClick(event);
            });
        }

        var road = document.getElementById('games-road');
        if (road) {
            road.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                var rect = road.getBoundingClientRect();
                if (!rect.width) return;
                self._setLane(self.laneFromRatio((event.clientX - rect.left) / rect.width));
            });
        }

        var pop = document.getElementById('games-pop-target');
        if (pop) {
            pop.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                event.preventDefault();
                self._popHit(event);
            });
        }

        var popField = document.getElementById('games-pop-field');
        if (popField) {
            popField.addEventListener('pointerdown', function (event) {
                if (event.button !== 0) return;
                if (event.target && event.target.closest && event.target.closest('#games-pop-target')) return;
                self._popMiss(event);
            });
        }
    },

    isOpen: function () {
        var overlay = document.getElementById('games-overlay');
        return !!(overlay && !overlay.hidden);
    },

    open: function () {
        var overlay = document.getElementById('games-overlay');
        if (!overlay || this.isOpen()) return;
        this._returnFocus = document.activeElement;
        this._dismissSettings();
        if (typeof CVIKeyboard !== 'undefined') CVIKeyboard.disable();
        overlay.hidden = false;
        if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.trap(overlay);
        this.showMenu();
        this._announce('screenReaderAnnouncements.gamesOpened');
    },

    close: function () {
        if (!this.isOpen()) return;
        this._finishGameTracking();
        this.mode = null;
        this._stopLoop();
        var overlay = document.getElementById('games-overlay');
        if (overlay) {
            overlay.hidden = true;
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(overlay);
        }
        if (typeof CVIApp !== 'undefined' && CVIApp.started && typeof CVIKeyboard !== 'undefined') {
            CVIKeyboard.enable();
        }
        this._restoreFocus();
        this._announce('screenReaderAnnouncements.gamesClosed');
    },

    showMenu: function () {
        this._finishGameTracking();
        this.mode = null;
        this._stopLoop();
        this._showOnly('menu');
        this._syncChrome();
        var first = document.getElementById('games-choice-drive');
        if (first) first.focus();
    },

    start: function (id) {
        if (id !== 'drive' && id !== 'pop' && id !== 'arrows') return;
        this.mode = id;
        this._showOnly(id);
        this._syncChrome();
        if (id === 'drive') this._resetDrive();
        else if (id === 'pop') this._resetPop();
        else this._resetArrows();
        this._trackGame(id);
        if (id === 'drive' || id === 'pop') this._startLoop();
        else this._stopLoop();
        var nameKey = id === 'drive' ? 'games.menuDrive' : id === 'pop' ? 'games.menuPop' : 'games.menuArrows';
        this._speak(this._t(nameKey));
        var focusId = id === 'drive' ? 'games-drive' : id === 'pop' ? 'games-pop-field' : 'games-arrow-field';
        var focusEl = document.getElementById(focusId);
        if (focusEl) focusEl.focus();
    },

    _pluralStem: function (normalized) {
        if (normalized.length > 3 && normalized.charAt(normalized.length - 1) === 's') {
            return normalized.slice(0, -1);
        }
        return '';
    },

    _aliasId: function (normalized) {
        this._ensureAliases();
        return this._aliasMap[normalized] || null;
    },

    _ensureAliases: function () {
        if (this._aliasMap) return;
        var map = Object.create(null);
        var ids = ['car', 'truck', 'van', 'suv'];
        for (var i = 0; i < ids.length; i++) {
            var id = ids[i];
            var list = this.ALIASES[id];
            for (var j = 0; j < list.length; j++) {
                map[this.normalizeWord(list[j])] = id;
            }
        }
        this._aliasMap = map;
    },

    _localeVehicleId: function (normalized) {
        if (typeof CVII18n === 'undefined' || !CVII18n.t) return null;
        var ids = ['car', 'truck', 'van', 'suv'];
        for (var i = 0; i < ids.length; i++) {
            var label = CVII18n.t('games.vehicles.' + ids[i]);
            if (label && this.normalizeWord(label) === normalized) return ids[i];
        }
        return null;
    },

    _t: function (path, vars) {
        if (typeof CVII18n === 'undefined' || !CVII18n.t) return path;
        return CVII18n.t(path, vars);
    },

    _vehicleVars: function () {
        return {
            car: this._t('games.vehicles.car'),
            truck: this._t('games.vehicles.truck'),
            van: this._t('games.vehicles.van'),
            suv: this._t('games.vehicles.suv')
        };
    },

    _announce: function (path) {
        if (typeof CVISettings === 'undefined' || !CVISettings._announceToScreenReader) return;
        CVISettings._announceToScreenReader(this._t(path));
    },

    _speak: function (message) {
        if (!message || typeof CVISpeech === 'undefined' || !CVISpeech.speakSystem) return;
        CVISpeech.speakSystem(message);
    },

    _speakWord: function (word) {
        if (!word || typeof CVISpeech === 'undefined' || !CVISpeech.speakWord) return;
        CVISpeech.speakWord(word);
    },

    _speakLetter: function (ch) {
        if (!ch || typeof CVISpeech === 'undefined' || !CVISpeech.speakLetter) return;
        CVISpeech.speakLetter(ch);
    },

    _isEditable: function (event) {
        var el = event.target;
        if (!el || !el.tagName) return false;
        var tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        return !!el.isContentEditable;
    },

    _isLetter: function (key) {
        return key.length === 1 && /^\p{L}$/u.test(key);
    },

    _reducedMotion: function () {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    _onKeyDown: function (event) {
        var key = event.key;
        var toggle = event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey &&
            (key === 'G' || key === 'g');

        if (!this.isOpen()) {
            if (toggle && !this._isEditable(event)) {
                event.preventDefault();
                event.stopPropagation();
                this.open();
            }
            return;
        }

        if (key === 'Tab' || this._isEditable(event)) return;

        if (toggle) {
            event.preventDefault();
            event.stopPropagation();
            this.close();
            return;
        }

        if (event.ctrlKey || event.metaKey || event.altKey) {
            event.stopPropagation();
            return;
        }

        if (event.repeat) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        if (key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (this.mode) this.showMenu();
            else this.close();
            return;
        }

        if (key === 'Enter' || key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            if (this.mode === 'drive') this._activateDriveKey(event.target, key);
            else this._activateFocused(event.target);
            return;
        }

        if (key === 'Backspace') {
            event.preventDefault();
            event.stopPropagation();
            if (this.mode === 'drive') this._backspace();
            return;
        }

        if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            var dir = key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : key === 'ArrowUp' ? 'up' : 'down';
            this._onDir(dir, 'key');
            return;
        }

        if (this.mode === 'drive' && this._isLetter(key)) {
            event.preventDefault();
            event.stopPropagation();
            this._typeChar(key);
            return;
        }

        event.stopPropagation();
    },

    _activateDriveKey: function (target, key) {
        var pad = target && target.closest ? target.closest('#games-drive [data-dir]') : null;
        if (pad) {
            this._onDir(pad.getAttribute('data-dir'));
            return;
        }
        if (key === 'Enter' && target && target.closest && target.closest('#games-back')) {
            this._onBack();
            return;
        }
        this._submitWord();
    },

    _activateFocused: function (target) {
        if (target && target.closest) {
            var choice = target.closest('[data-game]');
            if (choice && choice.closest('#games-menu')) {
                this.start(choice.getAttribute('data-game'));
                return;
            }
            if (target.closest('#games-back')) {
                this._onBack();
                return;
            }
            if (target.id === 'games-pop-target') {
                this._popHit();
                return;
            }
            var pad = target.closest('[data-dir]');
            if (pad) {
                this._onDir(pad.getAttribute('data-dir'), 'pad');
                return;
            }
        }
        if (this.mode === 'drive') this._submitWord();
    },

    _onOverlayClick: function (event) {
        var target = event.target;
        if (!target || !target.closest) return;
        if (target.closest('#games-back')) {
            this._onBack();
            return;
        }
        var choice = target.closest('[data-game]');
        if (choice) {
            this.start(choice.getAttribute('data-game'));
            return;
        }
        var pad = target.closest('[data-dir]');
        if (pad) this._onDir(pad.getAttribute('data-dir'), 'pad');
    },

    _onBack: function () {
        if (this.mode) this.showMenu();
        else this.close();
    },

    _onDir: function (dir, input) {
        if (dir !== 'left' && dir !== 'right' && dir !== 'up' && dir !== 'down') return;
        if (this.mode !== 'drive' && this.mode !== 'arrows') return;
        this._flashPad(dir);
        if (this.mode === 'drive') {
            if (dir === 'left') this._setLane(this.drive.lane - 1);
            else if (dir === 'right') this._setLane(this.drive.lane + 1);
            else if (dir === 'up') this._setSpeed(1);
            else this._setSpeed(-1);
            return;
        }
        this._stepArrow(dir, input === 'pad' ? 'pad' : 'key');
    },

    _history: function () {
        return typeof CVIGameHistory !== 'undefined' ? CVIGameHistory : null;
    },

    _trackGame: function (id) {
        var history = this._history();
        if (!history) return;
        if (id === 'pop' || id === 'arrows') history.startSession(id);
        else history.endSession();
    },

    _finishGameTracking: function () {
        var history = this._history();
        if (history) history.endSession();
    },

    _flashPad: function (dir) {
        var rootId = this.mode === 'drive' ? 'games-drive' : 'games-arrows';
        var root = document.getElementById(rootId);
        if (!root) return;
        var btn = root.querySelector('.games-pad-btn[data-dir="' + dir + '"]');
        if (!btn) return;
        btn.classList.add('is-pressed');
        setTimeout(function () {
            btn.classList.remove('is-pressed');
        }, 160);
    },

    _showOnly: function (which) {
        var map = {
            menu: 'games-menu',
            drive: 'games-drive',
            pop: 'games-pop',
            arrows: 'games-arrows'
        };
        var ids = ['games-menu', 'games-drive', 'games-pop', 'games-arrows'];
        var visible = map[which] || map.menu;
        for (var i = 0; i < ids.length; i++) {
            var el = document.getElementById(ids[i]);
            if (!el) continue;
            el.hidden = ids[i] !== visible;
        }
    },

    _syncChrome: function () {
        var title = document.getElementById('games-title');
        var back = document.getElementById('games-back');
        var titleKey = 'games.title';
        if (this.mode === 'drive') titleKey = 'games.menuDrive';
        else if (this.mode === 'pop') titleKey = 'games.menuPop';
        else if (this.mode === 'arrows') titleKey = 'games.menuArrows';
        if (title) title.textContent = this._t(titleKey);
        if (!back) return;
        if (this.mode) {
            back.textContent = this._t('games.back');
            back.setAttribute('aria-label', this._t('games.backAria'));
        } else {
            back.textContent = this._t('games.close');
            back.setAttribute('aria-label', this._t('games.closeAria'));
        }
    },

    _onLocale: function () {
        if (!this.isOpen()) return;
        this._syncChrome();
        var pop = document.getElementById('games-pop-target');
        if (pop) pop.setAttribute('aria-label', this._t('games.popTargetAria'));
        if (this.mode === 'drive' && this.drive) {
            this._fillDrivePrompt();
            this._renderDriveStatus();
        } else if (this.mode === 'pop' && this.pop) {
            this._setText('games-pop-status', this._t('games.popCount', { count: this.pop.count }));
        } else if (this.mode === 'arrows' && this.arrow) {
            this._setText('games-arrow-status', this._t('games.arrowCount', { count: this.arrow.reached }));
        }
    },

    _setText: function (id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    _dismissSettings: function () {
        var guide = document.getElementById('settings-guide-modal');
        if (guide && !guide.hasAttribute('hidden')) {
            guide.setAttribute('hidden', '');
            if (typeof CVIFocusTrap !== 'undefined') CVIFocusTrap.release(guide);
            if (typeof CVISettings !== 'undefined') CVISettings._guideMode = null;
        }
        var panel = document.getElementById('settings-panel');
        if (panel && panel.classList.contains('visible') && typeof CVISettings !== 'undefined' && CVISettings.closePanel) {
            CVISettings.closePanel();
        }
    },

    _restoreFocus: function () {
        var el = this._returnFocus;
        this._returnFocus = null;
        if (el && typeof el.focus === 'function' && document.contains(el) && el.offsetParent !== null) {
            el.focus();
            return;
        }
        if (typeof CVIApp !== 'undefined' && CVIApp.started) {
            var typed = document.getElementById('text-display');
            if (typed) typed.focus();
            return;
        }
        var start = document.getElementById('start-button');
        if (start) start.focus();
    },

    _startLoop: function () {
        if (this._raf) return;
        var self = this;
        this._lastTs = 0;
        var tick = function (ts) {
            self._raf = requestAnimationFrame(tick);
            if (!self.isOpen() || (self.mode !== 'drive' && self.mode !== 'pop')) {
                self._stopLoop();
                return;
            }
            if (!self._lastTs) self._lastTs = ts;
            var dt = (ts - self._lastTs) / 1000;
            self._lastTs = ts;
            if (dt > 0.05) dt = 0.05;
            if (self.mode === 'drive') self._tickDrive(dt);
            else if (self.mode === 'pop') self._tickPop(dt);
        };
        this._raf = requestAnimationFrame(tick);
    },

    _stopLoop: function () {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = 0;
        this._lastTs = 0;
    },

    _resetDrive: function () {
        this.drive = {
            buffer: '',
            vehicle: null,
            label: '',
            lane: 1,
            speed: 1,
            lightLane: 1,
            lightY: -20,
            lightActive: false,
            caught: 0,
            wait: 0
        };
        this._fillDrivePrompt();
        this._renderTyped();
        this._renderVehicle();
        this._positionVehicle();
        this._positionLight();
        this._syncRoadMotion();
        this._renderDriveStatus();
    },

    _fillDrivePrompt: function () {
        this._setText('games-drive-prompt', this._t('games.drivePrompt', this._vehicleVars()));
    },

    _renderDriveStatus: function () {
        var text = this.drive.caught > 0
            ? this._t('games.driveLights', { count: this.drive.caught })
            : this._t('games.driveSteer');
        this._setText('games-drive-status', text);
    },

    _renderTyped: function () {
        var text = '';
        if (this.drive.buffer) text = this.drive.buffer;
        else if (this.drive.label) text = this.drive.label;
        this._setText('games-drive-typed', text);
    },

    _typeChar: function (ch) {
        if (!this.drive || this.drive.buffer.length >= 24) return;
        this.drive.buffer += ch;
        this._renderTyped();
        this._speakLetter(ch);
    },

    _backspace: function () {
        if (!this.drive || !this.drive.buffer) return;
        this.drive.buffer = this.drive.buffer.slice(0, -1);
        this._renderTyped();
        this._speak(this._t('systemSpeech.backspace'));
    },

    _submitWord: function () {
        if (!this.drive) return;
        var raw = this.drive.buffer.trim();
        if (!raw) return;
        var id = this.vehicleForWord(raw);
        this.drive.buffer = '';
        if (!id) {
            this._renderTyped();
            var hint = this._t('games.driveTryAgain', this._vehicleVars());
            this._setText('games-drive-status', hint);
            this._speak(hint);
            return;
        }
        this.drive.vehicle = id;
        this.drive.label = raw;
        if (!this.drive.lightActive) this.drive.wait = 1.1;
        this._renderTyped();
        this._renderVehicle();
        this._positionVehicle();
        this._syncRoadMotion();
        this._renderDriveStatus();
        this._speakWord(raw);
    },

    _renderVehicle: function () {
        var box = document.getElementById('games-vehicle');
        var art = document.getElementById('games-vehicle-art');
        var name = document.getElementById('games-vehicle-name');
        if (!box || !art || !name || !this.drive) return;
        if (!this.drive.vehicle) {
            box.hidden = true;
            art.innerHTML = '';
            name.textContent = '';
            box.removeAttribute('aria-label');
            return;
        }
        box.hidden = false;
        art.innerHTML = this._vehicleSvg(this.drive.vehicle);
        name.textContent = this.drive.label;
        var color = this.VEHICLE_COLOR[this.drive.vehicle] || '#FFE600';
        name.style.color = color;
        name.style.borderColor = color;
        box.setAttribute('aria-label', this.drive.label);
    },

    _positionVehicle: function () {
        var box = document.getElementById('games-vehicle');
        if (!box || !this.drive) return;
        box.style.left = this._lanePercent(this.drive.lane);
    },

    _positionLight: function () {
        var light = document.getElementById('games-light');
        if (!light || !this.drive) return;
        if (!this.drive.lightActive) {
            light.hidden = true;
            return;
        }
        light.hidden = false;
        light.style.left = this._lanePercent(this.drive.lightLane);
        light.style.top = this.drive.lightY + '%';
    },

    _lanePercent: function (lane) {
        if (lane <= 0) return '16.67%';
        if (lane >= 2) return '83.33%';
        return '50%';
    },

    _setLane: function (lane) {
        if (!this.drive) return;
        if (lane < 0) lane = 0;
        if (lane > 2) lane = 2;
        if (lane === this.drive.lane) return;
        this.drive.lane = lane;
        this._positionVehicle();
    },

    _setSpeed: function (dir) {
        if (!this.drive) return;
        var next = this.drive.speed + (dir > 0 ? 0.25 : -0.2);
        if (next < 0.55) next = 0.55;
        if (next > 1.8) next = 1.8;
        if (next === this.drive.speed) return;
        this.drive.speed = next;
        this._syncRoadMotion();
        this._speak(this._t(dir > 0 ? 'games.faster' : 'games.slower'));
    },

    _syncRoadMotion: function () {
        var road = document.getElementById('games-road');
        if (!road || !this.drive) return;
        if (this.drive.vehicle) {
            road.classList.add('is-driving');
            road.style.setProperty('--games-drive-ms', Math.round(1200 / this.drive.speed) + 'ms');
        } else {
            road.classList.remove('is-driving');
        }
    },

    _tickDrive: function (dt) {
        if (!this.drive || !this.drive.vehicle) return;
        if (!this.drive.lightActive) {
            this.drive.wait -= dt;
            if (this.drive.wait <= 0) this._spawnLight();
            return;
        }
        var pace = 11 * this.drive.speed;
        if (this._reducedMotion()) pace *= 0.7;
        this.drive.lightY += pace * dt;
        this._positionLight();
        if (this.drive.lightY > 36 && this.drive.lightLane === this.drive.lane && this._lightHitsVehicle()) {
            this._catchLight();
            return;
        }
        if (this.drive.lightY > 108) {
            this.drive.lightActive = false;
            this.drive.wait = 0.45;
            this._positionLight();
            return;
        }
        this._positionLight();
    },

    _spawnLight: function () {
        this.drive.lightActive = true;
        this.drive.lightY = -8;
        if (this.drive.caught < 1) {
            this.drive.lightLane = this.drive.lane === 0 ? 2 : 0;
        } else {
            this.drive.lightLane = Math.floor(Math.random() * 3);
        }
        this._positionLight();
    },

    _catchLight: function () {
        this.drive.caught += 1;
        this.drive.lightActive = false;
        this.drive.wait = 1.1;
        this._positionLight();
        this._renderDriveStatus();
        this._speak(this._t('games.yes'));
    },

    _lightHitsVehicle: function () {
        var vehicle = document.getElementById('games-vehicle-art');
        var light = document.getElementById('games-light');
        if (!vehicle || !light || vehicle.hidden || light.hidden) return false;
        var a = vehicle.getBoundingClientRect();
        var b = light.getBoundingClientRect();
        if (!a.width || !b.width) return false;
        return a.top < b.bottom && a.bottom > b.top && a.left < b.right && a.right > b.left;
    },

    _resetPop: function () {
        this.pop = {
            count: 0,
            x: 0.5,
            y: 0.45,
            vx: 0,
            vy: 0,
            padX: 0.2,
            padY: 0.2,
            drift: false
        };
        var target = document.getElementById('games-pop-target');
        if (target) target.setAttribute('aria-label', this._t('games.popTargetAria'));
        this._setText('games-pop-status', this._t('games.popCount', { count: 0 }));
        var self = this;
        requestAnimationFrame(function () {
            self._layoutPop(true);
        });
    },

    _layoutPop: function (move) {
        if (!this.pop) return;
        var field = document.getElementById('games-pop-field');
        var target = document.getElementById('games-pop-target');
        if (!field || !target) return;
        var rect = field.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) return;
        var fieldMin = Math.min(rect.width, rect.height);
        var diameter = this.popDiameter(this.pop.count, fieldMin);
        var padX = (diameter / 2 + 12) / rect.width;
        var padY = (diameter / 2 + 12) / rect.height;
        if (padX > 0.45) padX = 0.45;
        if (padY > 0.45) padY = 0.45;
        if (move) {
            this.pop.x = padX + Math.random() * (1 - padX * 2);
            this.pop.y = padY + Math.random() * (1 - padY * 2);
            var angle = Math.random() * Math.PI * 2;
            this.pop.vx = Math.cos(angle) * 0.12;
            this.pop.vy = Math.sin(angle) * 0.12;
        }
        this.pop.padX = padX;
        this.pop.padY = padY;
        this.pop.diameter = diameter;
        this.pop.drift = this.pop.count >= 4 && !this._reducedMotion();
        target.style.width = diameter + 'px';
        target.style.height = diameter + 'px';
        target.style.left = (this.pop.x * 100) + '%';
        target.style.top = (this.pop.y * 100) + '%';
        var colors = ['#FFE600', '#FF2D2D', '#00E5FF', '#FF9F1A'];
        target.style.background = colors[this.pop.count % colors.length];
    },

    _tickPop: function (dt) {
        if (!this.pop || !this.pop.drift) return;
        this.pop.x += this.pop.vx * dt;
        this.pop.y += this.pop.vy * dt;
        if (this.pop.x < this.pop.padX) {
            this.pop.x = this.pop.padX;
            this.pop.vx = Math.abs(this.pop.vx);
        } else if (this.pop.x > 1 - this.pop.padX) {
            this.pop.x = 1 - this.pop.padX;
            this.pop.vx = -Math.abs(this.pop.vx);
        }
        if (this.pop.y < this.pop.padY) {
            this.pop.y = this.pop.padY;
            this.pop.vy = Math.abs(this.pop.vy);
        } else if (this.pop.y > 1 - this.pop.padY) {
            this.pop.y = 1 - this.pop.padY;
            this.pop.vy = -Math.abs(this.pop.vy);
        }
        var target = document.getElementById('games-pop-target');
        if (!target) return;
        target.style.left = (this.pop.x * 100) + '%';
        target.style.top = (this.pop.y * 100) + '%';
    },

    _popPointer: function (event) {
        if (!event) return 'key';
        if (event.pointerType === 'mouse' || event.pointerType === 'touch' || event.pointerType === 'pen') {
            return event.pointerType;
        }
        if (event.key) return 'key';
        return 'unknown';
    },

    _popPoint: function (event) {
        if (!event || typeof event.clientX !== 'number') return null;
        var field = document.getElementById('games-pop-field');
        if (!field) return null;
        var rect = field.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        return {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height
        };
    },

    _popHit: function (event) {
        if (this.mode !== 'pop' || !this.pop) return;
        var history = this._history();
        if (history) {
            var point = this._popPoint(event);
            history.recordPopHit({
                diameter: this.pop.diameter,
                moving: !!this.pop.drift,
                x: point ? point.x : this.pop.x,
                y: point ? point.y : this.pop.y,
                pointer: this._popPointer(event)
            });
        }
        this.pop.count += 1;
        this._speak(this._t('games.popWord'));
        this._setText('games-pop-status', this._t('games.popCount', { count: this.pop.count }));
        this._layoutPop(true);
    },

    _popMiss: function (event) {
        if (this.mode !== 'pop' || !this.pop || !event) return;
        var point = this._popPoint(event);
        var history = this._history();
        if (!history) return;
        history.recordPopMiss({
            x: point ? point.x : null,
            y: point ? point.y : null,
            pointer: this._popPointer(event)
        });
    },

    _resetArrows: function () {
        this.arrow = { x: 0.5, y: 0.55, gx: 0.22, gy: 0.24, reached: 0 };
        this._placeGoal();
        this._renderArrow();
        this._setText('games-arrow-status', this._t('games.arrowCount', { count: 0 }));
    },

    _placeGoal: function () {
        var gx = 0.22;
        var gy = 0.24;
        for (var i = 0; i < 24; i++) {
            gx = 0.2 + Math.random() * 0.6;
            gy = 0.22 + Math.random() * 0.56;
            var dx = gx - this.arrow.x;
            var dy = gy - this.arrow.y;
            if (dx * dx + dy * dy > 0.12) break;
        }
        this.arrow.gx = gx;
        this.arrow.gy = gy;
    },

    _renderArrow: function () {
        if (!this.arrow) return;
        var player = document.getElementById('games-arrow-player');
        var goal = document.getElementById('games-arrow-goal');
        if (player) {
            player.style.left = (this.arrow.x * 100) + '%';
            player.style.top = (this.arrow.y * 100) + '%';
        }
        if (goal) {
            goal.style.left = (this.arrow.gx * 100) + '%';
            goal.style.top = (this.arrow.gy * 100) + '%';
        }
    },

    _stepArrow: function (dir, input) {
        if (!this.arrow) return;
        var step = 0.16;
        if (dir === 'left') this.arrow.x -= step;
        else if (dir === 'right') this.arrow.x += step;
        else if (dir === 'up') this.arrow.y -= step;
        else if (dir === 'down') this.arrow.y += step;
        if (this.arrow.x < 0.12) this.arrow.x = 0.12;
        if (this.arrow.x > 0.88) this.arrow.x = 0.88;
        if (this.arrow.y < 0.16) this.arrow.y = 0.16;
        if (this.arrow.y > 0.84) this.arrow.y = 0.84;
        var history = this._history();
        if (history) history.recordArrowStep(dir, input);
        this._renderArrow();
        if (this.reachedGoal(this.arrow.x, this.arrow.y, this.arrow.gx, this.arrow.gy)) {
            if (history) history.recordArrowGoal();
            this._reachGoal();
        }
    },

    _reachGoal: function () {
        this.arrow.reached += 1;
        this._speak(this._t('games.yes'));
        this._setText('games-arrow-status', this._t('games.arrowCount', { count: this.arrow.reached }));
        this._placeGoal();
        this._renderArrow();
    },

    _vehicleSvg: function (id) {
        if (id === 'car') {
            return this._svg('0 0 160 180',
                this._wheels([[34, 46], [126, 46], [34, 138], [126, 138]]) +
                '<rect x="42" y="20" width="76" height="146" rx="34" fill="#FFE600" stroke="#fff" stroke-width="8"/>' +
                '<rect x="54" y="40" width="52" height="36" rx="8" fill="#141414"/>' +
                '<rect x="54" y="102" width="52" height="26" rx="6" fill="#141414"/>');
        }
        if (id === 'truck') {
            return this._svg('0 0 160 250',
                this._wheels([[32, 40], [128, 40], [32, 108], [128, 108], [32, 196], [128, 196]]) +
                '<rect x="36" y="78" width="88" height="152" rx="8" fill="#FF2D2D" stroke="#fff" stroke-width="8"/>' +
                '<rect x="48" y="12" width="64" height="78" rx="12" fill="#FF2D2D" stroke="#fff" stroke-width="8"/>' +
                '<rect x="58" y="24" width="44" height="30" rx="4" fill="#141414"/>');
        }
        if (id === 'van') {
            return this._svg('0 0 160 230',
                this._wheels([[32, 48], [128, 48], [32, 186], [128, 186]]) +
                '<rect x="36" y="16" width="88" height="198" rx="14" fill="#00E5FF" stroke="#fff" stroke-width="8"/>' +
                '<rect x="48" y="28" width="64" height="36" rx="4" fill="#141414"/>' +
                '<rect x="48" y="160" width="64" height="36" rx="4" fill="#141414"/>');
        }
        if (id === 'suv') {
            return this._svg('0 0 180 210',
                this._wheels([[28, 48], [152, 48], [28, 164], [152, 164]]) +
                '<rect x="32" y="18" width="116" height="176" rx="28" fill="#FF9F1A" stroke="#fff" stroke-width="8"/>' +
                '<rect x="48" y="34" width="84" height="112" rx="10" fill="#141414"/>' +
                '<rect x="56" y="28" width="8" height="100" fill="#fff"/>' +
                '<rect x="116" y="28" width="8" height="100" fill="#fff"/>');
        }
        return '';
    },

    _wheels: function (points) {
        var out = '';
        for (var i = 0; i < points.length; i++) {
            out += '<circle cx="' + points[i][0] + '" cy="' + points[i][1] + '" r="16" fill="#111" stroke="#fff" stroke-width="4"/>';
        }
        return out;
    },

    _svg: function (viewBox, inner) {
        return '<svg viewBox="' + viewBox + '" aria-hidden="true" focusable="false">' + inner + '</svg>';
    }
};
