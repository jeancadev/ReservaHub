/* ============================================
   ReservaHub - UI Utilities
   ============================================ */

App.ui = {
    _customSelectBound: false,
    _customSelectBackdrop: null,
    _customSelectSheet: null,
    _customSelectSheetTitle: null,
    _customSelectSheetList: null,
    _activeMobileSelectWrap: null,
    _activeMobileSelectEl: null,
    _themeSystemBound: false,

    initTheme() {
        const saved = App.store && typeof App.store.get === 'function'
            ? App.store.get('theme')
            : null;
        const hasSaved = saved === 'dark' || saved === 'light';
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = hasSaved ? saved : (prefersDark ? 'dark' : 'light');
        this.applyTheme(initialTheme, false);

        if (!window.matchMedia || this._themeSystemBound) return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const onSystemChange = (event) => {
            const stored = App.store && typeof App.store.get === 'function'
                ? App.store.get('theme')
                : null;
            if (stored === 'dark' || stored === 'light') return;
            this.applyTheme(event.matches ? 'dark' : 'light', false);
        };
        if (typeof media.addEventListener === 'function') media.addEventListener('change', onSystemChange);
        else if (typeof media.addListener === 'function') media.addListener(onSystemChange);
        this._themeSystemBound = true;
    },

    getTheme() {
        return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    },

    applyTheme(theme, persist = true) {
        const normalized = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = normalized;
        if (persist && App.store && typeof App.store.set === 'function') {
            App.store.set('theme', normalized);
        }
        this.syncThemeControls();
    },

    toggleTheme() {
        const next = this.getTheme() === 'dark' ? 'light' : 'dark';
        this.applyTheme(next, true);
    },

    syncThemeControls() {
        const isDark = this.getTheme() === 'dark';
        document.querySelectorAll('[data-theme-switch]').forEach(control => {
            control.classList.toggle('is-on', isDark);
        });
        document.querySelectorAll('[data-theme-caption]').forEach(label => {
            label.textContent = isDark ? 'Oscuro' : 'Claro';
        });
    },

    toggleSidebar() {
        this.closeMobileProfile();
        document.getElementById('sidebar').classList.toggle('open');
        let overlay = document.getElementById('sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'sidebar-overlay';
            overlay.onclick = () => App.ui.closeSidebar();
            document.body.appendChild(overlay);
        }
        overlay.classList.toggle('active');
    },

    closeSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        const overlay = document.getElementById('sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
    },

    toggleMobileProfile() {
        const panel = document.getElementById('mobile-profile-panel');
        const header = document.querySelector('.mobile-header');
        if (!panel || !header) return;

        const open = !panel.classList.contains('open');
        this.closeSidebar();

        let overlay = document.getElementById('mobile-profile-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'mobile-profile-overlay';
            overlay.onclick = () => App.ui.closeMobileProfile();
            document.body.appendChild(overlay);
        }

        panel.classList.toggle('open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        header.classList.toggle('is-profile-open', open);
        overlay.classList.toggle('active', open);
    },

    closeMobileProfile() {
        const panel = document.getElementById('mobile-profile-panel');
        const overlay = document.getElementById('mobile-profile-overlay');
        const header = document.querySelector('.mobile-header');
        if (panel) {
            panel.classList.remove('open');
            panel.setAttribute('aria-hidden', 'true');
        }
        if (overlay) overlay.classList.remove('active');
        if (header) header.classList.remove('is-profile-open');
    },

    openProfileSettings() {
        this.closeMobileProfile();
        App.navigate('settings');
    },

    initRipple() {
        document.querySelectorAll('.ripple-btn').forEach(btn => {
            btn.removeEventListener('click', App.ui._rippleHandler);
            btn.addEventListener('click', App.ui._rippleHandler);
        });
        this.initCustomSelects();
        this.initPhoneInputs();
        this.syncThemeControls();
    },

    initPhoneInputs(root) {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        scope.querySelectorAll('input[type="tel"]').forEach(input => {
            if (input.dataset.phoneMaskBound === '1') return;
            input.dataset.phoneMaskBound = '1';
            input.placeholder = '+506 XXXX-XXXX';
            input.inputMode = 'numeric';
            input.autocomplete = 'tel';
            input.setAttribute('pattern', '\\+506 \\d{4}-\\d{4}');
            input.setAttribute('title', 'Usa el formato +506 XXXX-XXXX');
            input.addEventListener('input', () => {
                if (!App.phone || typeof App.phone.format !== 'function') return;
                input.value = App.phone.format(input.value);
            });
            input.addEventListener('blur', () => {
                if (!App.phone || typeof App.phone.format !== 'function') return;
                input.value = App.phone.format(input.value);
            });
            if (input.value && App.phone && typeof App.phone.format === 'function') {
                input.value = App.phone.format(input.value);
            }
        });
    },

    _rippleHandler(e) {
        const btn = e.currentTarget;
        const circle = document.createElement('span');
        circle.classList.add('ripple');
        const d = Math.max(btn.clientWidth, btn.clientHeight);
        circle.style.width = circle.style.height = d + 'px';
        const rect = btn.getBoundingClientRect();
        circle.style.left = (e.clientX - rect.left - d / 2) + 'px';
        circle.style.top = (e.clientY - rect.top - d / 2) + 'px';
        btn.appendChild(circle);
        setTimeout(() => circle.remove(), 600);
    },

    initAnimationObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('[class*="animate-"]').forEach(el => {
            el.style.animationPlayState = 'paused';
            observer.observe(el);
        });
    },

    staggerChildren(parentSelector, animClass) {
        const children = document.querySelectorAll(parentSelector + ' > *');
        children.forEach((child, i) => {
            child.style.opacity = '0';
            child.style.animation = 'none';
            setTimeout(() => {
                child.style.animation = '';
                child.classList.add(animClass || 'animate-fade-up');
                child.style.animationDelay = (i * 0.06) + 's';
                child.style.opacity = '';
            }, 10);
        });
    },

    initCustomSelects(root) {
        const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        this._bindCustomSelectGlobals();
        
        const selects = scope.querySelectorAll('select.select-input, select.form-input, select.schedule-time-select');
        selects.forEach(select => this._mountCustomSelect(select));
    },

    _bindCustomSelectGlobals() {
        if (this._customSelectBound) return;
        let backdrop = document.getElementById('premium-select-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'premium-select-backdrop';
            backdrop.className = 'premium-select-backdrop';
            backdrop.addEventListener('click', () => App.ui.closeCustomSelects());
            document.body.appendChild(backdrop);
        }
        this._customSelectBackdrop = backdrop;

        let sheet = document.getElementById('premium-select-sheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'premium-select-sheet';
            sheet.className = 'premium-select-sheet';
            sheet.innerHTML = `
                <div class="premium-select-sheet-handle" aria-hidden="true"></div>
                <div class="premium-select-sheet-header">
                    <strong class="premium-select-sheet-title">Selecciona una opción</strong>
                    <button type="button" class="premium-select-sheet-close" aria-label="Cerrar selector">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="premium-select-sheet-list" role="listbox"></div>
            `;
            document.body.appendChild(sheet);
        }
        this._customSelectSheet = sheet;
        this._customSelectSheetTitle = sheet.querySelector('.premium-select-sheet-title');
        this._customSelectSheetList = sheet.querySelector('.premium-select-sheet-list');
        const closeBtn = sheet.querySelector('.premium-select-sheet-close');
        if (closeBtn && !closeBtn.dataset.bound) {
            closeBtn.addEventListener('click', () => App.ui.closeCustomSelects());
            closeBtn.dataset.bound = '1';
        }

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.premium-select') && !e.target.closest('.premium-select-sheet')) {
                App.ui.closeCustomSelects();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') App.ui.closeCustomSelects();
        });
        
        document.addEventListener('scroll', (e) => {
            if (e.target && e.target.nodeType === 1) {
                if (e.target.closest('.premium-select-panel') || e.target.closest('.premium-select-sheet-list')) return;
            }
            App.ui.closeCustomSelects();
        }, true);
        
        this._customSelectBound = true;
    },

    _customSelectSignature(select) {
        const optionsSig = Array.from(select.options).map(opt => {
            const txt = (opt.textContent || '').trim();
            return `${opt.value}::${txt}::${opt.disabled ? 1 : 0}::${opt.hidden ? 1 : 0}`;
        }).join('||');
        return `${select.selectedIndex}__${select.disabled ? 1 : 0}__${optionsSig}`;
    },

    _mountCustomSelect(select) {
        if (!select || select.multiple || select.dataset.nativeSelect === '1') return;
        const signature = this._customSelectSignature(select);
        const siblingWrap = select.nextElementSibling && select.nextElementSibling.classList.contains('premium-select')
            ? select.nextElementSibling
            : null;
        const existing = siblingWrap || document.querySelector(`.premium-select[data-for="${select.id}"]`);
        if (existing && select.dataset.customSelectSig === signature) {
            this._syncCustomSelect(select);
            return;
        }
        this._destroyCustomSelect(select);

        if (!select.id) select.id = `select-${App.uid()}`;

        const wrap = document.createElement('div');
        wrap.className = 'premium-select';
        wrap.dataset.for = select.id;

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'premium-select-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', `${select.id}-listbox`);

        const value = document.createElement('span');
        value.className = 'premium-select-value';
        trigger.appendChild(value);

        const chevron = document.createElement('i');
        chevron.className = 'fas fa-chevron-down premium-select-chevron';
        trigger.appendChild(chevron);

        const panel = document.createElement('div');
        panel.className = 'premium-select-panel';
        panel.id = `${select.id}-listbox`;
        panel.setAttribute('role', 'listbox');
        panel.tabIndex = -1;

        Array.from(select.options).forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'premium-select-option';
            btn.dataset.index = String(idx);
            btn.dataset.value = opt.value;
            btn.setAttribute('role', 'option');
            btn.textContent = (opt.textContent || '').trim() || opt.value || 'Selecciona';
            if (opt.value === '') btn.classList.add('is-placeholder');
            if (opt.hidden) btn.classList.add('is-hidden');
            if (opt.disabled) {
                btn.classList.add('is-disabled');
                btn.disabled = true;
            }
            btn.addEventListener('click', () => {
                if (btn.disabled || select.disabled) return;
                select.selectedIndex = idx;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                App.ui._syncCustomSelect(select);
                App.ui.closeCustomSelects();
                trigger.focus();
            });
            panel.appendChild(btn);
        });

        trigger.addEventListener('click', () => {
            if (select.disabled) return;
            if (wrap.classList.contains('open')) {
                App.ui.closeCustomSelects();
            } else {
                App.ui._openCustomSelect(wrap);
            }
        });

        trigger.addEventListener('keydown', (e) => App.ui._handleCustomTriggerKeys(e, wrap));
        panel.addEventListener('keydown', (e) => App.ui._handleCustomPanelKeys(e, wrap));

        wrap.appendChild(trigger);
        wrap.appendChild(panel);
        select.classList.add('premium-select-source');
        select.insertAdjacentElement('afterend', wrap);

        const onChange = () => App.ui._syncCustomSelect(select);
        select.addEventListener('change', onChange);

        const observer = new MutationObserver(() => {
            if (!document.body.contains(select)) return;
            App.ui._mountCustomSelect(select);
        });
        observer.observe(select, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled']
        });

        select._premiumSelectState = { onChange, observer };
        select.dataset.customSelectSig = signature;
        this._syncCustomSelect(select);
    },

    _destroyCustomSelect(select) {
        if (this._activeMobileSelectEl === select) this.closeCustomSelects();
        if (select && select.id) {
            document.querySelectorAll(`.premium-select[data-for="${select.id}"]`).forEach(el => el.remove());
        } else {
            const next = select && select.nextElementSibling;
            if (next && next.classList.contains('premium-select')) next.remove();
        }
        if (select && select._premiumSelectState) {
            if (select._premiumSelectState.onChange) {
                select.removeEventListener('change', select._premiumSelectState.onChange);
            }
            if (select._premiumSelectState.observer) {
                select._premiumSelectState.observer.disconnect();
            }
            select._premiumSelectState = null;
        }
    },

    _syncCustomSelect(select) {
        if (!select) return;
        const wrap = select.nextElementSibling && select.nextElementSibling.classList.contains('premium-select')
            ? select.nextElementSibling
            : null;
        if (!wrap) return;

        const trigger = wrap.querySelector('.premium-select-trigger');
        const value = wrap.querySelector('.premium-select-value');
        const options = wrap.querySelectorAll('.premium-select-option');
        const selected = select.options[select.selectedIndex] || null;
        const label = selected ? ((selected.textContent || '').trim() || selected.value || 'Selecciona') : 'Selecciona';
        value.textContent = label;
        value.classList.toggle('is-placeholder', !selected || selected.value === '');

        options.forEach((optBtn, idx) => {
            const isSelected = idx === select.selectedIndex;
            optBtn.classList.toggle('is-selected', isSelected);
            optBtn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        });

        trigger.disabled = !!select.disabled;
        wrap.classList.toggle('is-disabled', !!select.disabled);
        select.dataset.customSelectSig = this._customSelectSignature(select);

        if (this._activeMobileSelectEl === select && this._customSelectSheet && this._customSelectSheet.classList.contains('active')) {
            this._renderMobileSelectSheet(select, wrap);
        }
    },

    _openCustomSelect(wrap) {
        if (!wrap) return;
        const isMobileSheet = this._isMobileSelectViewport();
        this.closeCustomSelects();
        wrap.classList.toggle('is-mobile-sheet', isMobileSheet);
        wrap.classList.add('open');
        const scheduleRow = wrap.closest('.schedule-row');
        if (scheduleRow) scheduleRow.classList.add('schedule-row-open-select');
        if (isMobileSheet) {
            document.body.classList.add('select-sheet-open');
            if (this._customSelectBackdrop) this._customSelectBackdrop.classList.add('active');
            this._openMobileSelectSheet(wrap);
            const triggerBtn = wrap.querySelector('.premium-select-trigger');
            if (triggerBtn) triggerBtn.setAttribute('aria-expanded', 'true');
            return;
        }
        const trigger = wrap.querySelector('.premium-select-trigger');
        const panel = wrap.querySelector('.premium-select-panel');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
        const active = panel && (
            panel.querySelector('.premium-select-option.is-selected:not(.is-disabled):not(.is-hidden)') ||
            panel.querySelector('.premium-select-option:not(.is-disabled):not(.is-hidden)')
        );
        if (active) active.focus({ preventScroll: true });
    },

    closeCustomSelects(exceptWrap) {
        document.querySelectorAll('.premium-select.open').forEach(wrap => {
            if (exceptWrap && wrap === exceptWrap) return;
            wrap.classList.remove('open');
            wrap.classList.remove('is-mobile-sheet');
            const trigger = wrap.querySelector('.premium-select-trigger');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
            const scheduleRow = wrap.closest('.schedule-row');
            if (scheduleRow) scheduleRow.classList.remove('schedule-row-open-select');
        });
        if (this._customSelectSheet) this._customSelectSheet.classList.remove('active');
        if (this._customSelectSheetList) this._customSelectSheetList.innerHTML = '';
        this._activeMobileSelectWrap = null;
        this._activeMobileSelectEl = null;
        document.body.classList.remove('select-sheet-open');
        if (this._customSelectBackdrop) this._customSelectBackdrop.classList.remove('active');
    },

    _handleCustomTriggerKeys(e, wrap) {
        const k = e.key;
        if (k === 'Enter' || k === ' ') {
            e.preventDefault();
            if (wrap.classList.contains('open')) this.closeCustomSelects();
            else this._openCustomSelect(wrap);
            return;
        }
        if (k === 'ArrowDown' || k === 'ArrowUp') {
            e.preventDefault();
            if (!wrap.classList.contains('open')) this._openCustomSelect(wrap);
        }
    },

    _handleCustomPanelKeys(e, wrap) {
        const panel = wrap.querySelector('.premium-select-panel');
        const items = Array.from(panel.querySelectorAll('.premium-select-option:not(.is-disabled):not(.is-hidden)'));
        if (!items.length) return;
        const active = document.activeElement;
        let idx = items.indexOf(active);

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            idx = idx < items.length - 1 ? idx + 1 : 0;
            items[idx].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            idx = idx > 0 ? idx - 1 : items.length - 1;
            items[idx].focus();
        } else if (e.key === 'Home') {
            e.preventDefault();
            items[0].focus();
        } else if (e.key === 'End') {
            e.preventDefault();
            items[items.length - 1].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (active && active.classList.contains('premium-select-option')) active.click();
        } else if (e.key === 'Escape' || e.key === 'Tab') {
            this.closeCustomSelects();
        }
    },

    _isMobileSelectViewport() {
        return window.matchMedia('(max-width: 860px)').matches;
    },

    _openMobileSelectSheet(wrap) {
        const selectId = wrap.dataset.for;
        const select = selectId ? document.getElementById(selectId) : null;
        if (!select || !this._customSelectSheet || !this._customSelectSheetList) return;
        this._activeMobileSelectWrap = wrap;
        this._activeMobileSelectEl = select;
        this._renderMobileSelectSheet(select, wrap);
        this._customSelectSheet.classList.add('active');
    },

    _renderMobileSelectSheet(select, wrap) {
        if (!select || !this._customSelectSheetList) return;
        if (this._customSelectSheetTitle) {
            this._customSelectSheetTitle.textContent = this._resolveSelectTitle(select);
        }
        this._customSelectSheetList.innerHTML = '';

        Array.from(select.options).forEach((opt, idx) => {
            if (opt.hidden) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'premium-select-sheet-option';
            btn.setAttribute('role', 'option');
            btn.dataset.index = String(idx);
            btn.innerHTML = `
                <span class="premium-select-sheet-label">${(opt.textContent || '').trim() || opt.value || 'Selecciona'}</span>
                <i class="fas fa-check premium-select-sheet-check"></i>
            `;

            const isSelected = idx === select.selectedIndex;
            btn.classList.toggle('is-selected', isSelected);
            if (opt.disabled) {
                btn.classList.add('is-disabled');
                btn.disabled = true;
            }

            btn.addEventListener('click', () => {
                if (btn.disabled || select.disabled) return;
                select.selectedIndex = idx;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                this._syncCustomSelect(select);
                this.closeCustomSelects();
                const trigger = wrap.querySelector('.premium-select-trigger');
                if (trigger) trigger.focus();
            });

            this._customSelectSheetList.appendChild(btn);
        });

        const active = this._customSelectSheetList.querySelector('.premium-select-sheet-option.is-selected')
            || this._customSelectSheetList.querySelector('.premium-select-sheet-option:not(.is-disabled)');
        if (active) setTimeout(() => active.scrollIntoView({ block: 'nearest' }), 0);
    },

    _resolveSelectTitle(select) {
        const group = select.closest('.input-group');
        const label = group ? group.querySelector('label') : null;
        const text = label ? (label.textContent || '').trim() : '';
        return text || 'Selecciona una opción';
    }
};
