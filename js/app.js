/* ============================================
   ReservaHub - Core Application Engine
   ============================================ */

const App = {
    currentUser: null,
    currentSection: 'dashboard',
    calendarWeekOffset: 0,
    bookingStep: 1,
    bookingData: {},
    bookingMonth: new Date(),
    confirmCallback: null,
    weeklyChart: null,
    revenueChart: null,
    servicesChart: null,
    occupancyChart: null,
    dashboardFilter: 'today',
    session: {
        timeoutMs: 2 * 60 * 60 * 1000, // 2 horas de inactividad
        started: false,
        timerId: null,
        lastActivityAt: 0,
        activityHandler: null,
        visibilityHandler: null,
        activityEvents: ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'],

        start() {
            if (!App.currentUser) return;
            if (!this.activityHandler) {
                this.activityHandler = (event) => this.touch(event && event.type ? event.type : 'activity');
            }
            if (!this.visibilityHandler) {
                this.visibilityHandler = () => {
                    if (document.visibilityState === 'visible') this.touch('visibilitychange');
                };
            }
            if (!this.started) {
                this.activityEvents.forEach(eventName => {
                    window.addEventListener(eventName, this.activityHandler, { passive: true });
                });
                document.addEventListener('visibilitychange', this.visibilityHandler);
                this.started = true;
            }
            this.touch('start', true);
        },

        stop() {
            if (this.timerId) {
                clearTimeout(this.timerId);
                this.timerId = null;
            }
            if (!this.started) return;
            this.activityEvents.forEach(eventName => {
                window.removeEventListener(eventName, this.activityHandler, { passive: true });
            });
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.started = false;
            this.lastActivityAt = 0;
        },

        touch(source, force = false) {
            if (!App.currentUser) return;
            const now = Date.now();
            const eventName = String(source || 'activity');
            const minGap = eventName === 'mousemove' ? 15000 : 1000;
            if (!force && this.lastActivityAt && (now - this.lastActivityAt) < minGap) return;
            this.lastActivityAt = now;
            this.resetTimer();
        },

        resetTimer() {
            if (this.timerId) clearTimeout(this.timerId);
            this.timerId = setTimeout(() => {
                this.handleTimeout().catch(err => console.error('Auto logout error:', err));
            }, this.timeoutMs);
        },

        async handleTimeout() {
            if (!App.currentUser) return;
            await App.auth.logout({ reason: 'inactivity' });
        }
    },

    // ---- INIT ----
    async init() {
        if (this.ui && typeof this.ui.initTheme === 'function') {
            this.ui.initTheme();
        }
        let backendHandled = false;
        if (this.backend && typeof this.backend.bootstrap === 'function') {
            try {
                backendHandled = await this.backend.bootstrap();
            } catch (err) {
                console.error('Supabase bootstrap error:', err);
            }
        }
        if (!backendHandled) {
            this.currentUser = this.store.get('currentUser');
            if (this.currentUser) {
                this.showApp();
            }
        }
        if (!this.currentUser && this.auth && typeof this.auth.resetAuthForms === 'function') {
            this.auth.resetAuthForms();
            this.auth.showLogin();
        }
        this.ui.initRipple();
        this.ui.initAnimationObserver();
    },

    // ---- STORE (localStorage wrapper) ----
    store: {
        get(key) { try { return JSON.parse(localStorage.getItem('ap_' + key)); } catch { return null; } },
        set(key, val, options = {}) {
            localStorage.setItem('ap_' + key, JSON.stringify(val));
            if (!options.skipCloud && App.backend && typeof App.backend.shouldSyncKey === 'function' && App.backend.shouldSyncKey(key)) {
                App.backend.queueStateUpsert(key, val);
            }
        },
        remove(key, options = {}) {
            localStorage.removeItem('ap_' + key);
            if (!options.skipCloud && App.backend && typeof App.backend.shouldSyncKey === 'function' && App.backend.shouldSyncKey(key)) {
                App.backend.queueStateDelete(key);
            }
        },
        getList(key) { return this.get(key) || []; },
        addToList(key, item) {
            const list = this.getList(key);
            item.id = item.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
            item.createdAt = item.createdAt || new Date().toISOString();
            list.push(item);
            this.set(key, list);
            return item;
        },
        updateInList(key, id, updates) {
            const list = this.getList(key);
            const idx = list.findIndex(i => i.id === id);
            if (idx !== -1) { Object.assign(list[idx], updates); this.set(key, list); }
            return list[idx];
        },
        removeFromList(key, id) {
            const list = this.getList(key).filter(i => i.id !== id);
            this.set(key, list);
        }
    },

    // ---- TOAST ----
    toast: {
        show(message, type = 'info') {
            const container = document.getElementById('toast-container');
            const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.innerHTML = `<i class="fas ${icons[type]} toast-icon"></i><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.classList.add('toast-out');setTimeout(()=>this.parentElement.remove(),300)"><i class="fas fa-times"></i></button>`;
            container.appendChild(toast);
            setTimeout(() => { toast.classList.add('toast-out'); setTimeout(() => toast.remove(), 300); }, 4000);
        }
    },

    // ---- MODAL ----
    modal: {
        open(title, bodyHTML) {
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-body').innerHTML = bodyHTML;
            const overlay = document.getElementById('modal-overlay');
            overlay.classList.remove('closing');
            overlay.classList.add('active');
            App.ui.initRipple();
        },
        close() {
            const overlay = document.getElementById('modal-overlay');
            overlay.classList.add('closing');
            setTimeout(() => { overlay.classList.remove('active', 'closing'); }, 250);
        }
    },

    // ---- CONFIRM ----
    confirm: {
        show(title, message, callback) {
            document.getElementById('confirm-title').textContent = title;
            document.getElementById('confirm-message').textContent = message;
            App.confirmCallback = callback;
            document.getElementById('confirm-overlay').classList.add('active');
        },
        accept() {
            if (App.confirmCallback) App.confirmCallback();
            this.close();
        },
        close() {
            document.getElementById('confirm-overlay').classList.remove('active');
            App.confirmCallback = null;
        }
    },

    // ---- NAVIGATION ----
    navigate(section) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        const el = document.getElementById('section-' + section);
        if (el) { el.classList.add('active'); el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
        document.querySelectorAll(`[data-section="${section}"]`).forEach(nav => nav.classList.add('active'));
        this.syncMobileTabs(section);
        this.currentSection = section;
        try {
            if (section === 'dashboard' && this.dashboard && typeof this.dashboard.render === 'function') this.dashboard.render();
            if (section === 'calendar') {
                if (this.calendar && typeof this.calendar.render === 'function') this.calendar.render();
                else {
                    const grid = document.getElementById('calendar-grid');
                    if (grid) grid.innerHTML = '<div class="empty-text" style="grid-column:1 / -1">No se pudo cargar el modulo de calendario.</div>';
                }
            }
            if (section === 'clients' && this.clients && typeof this.clients.render === 'function') this.clients.render();
            if (section === 'employees' && this.employees && typeof this.employees.render === 'function') this.employees.render();
            if (section === 'services' && this.services && typeof this.services.render === 'function') this.services.render();
            if (section === 'reports' && this.reports && typeof this.reports.render === 'function') this.reports.render();
            if (section === 'settings' && this.settings && typeof this.settings.render === 'function') this.settings.render();
            if (section === 'client-dashboard' && this.clientView && typeof this.clientView.render === 'function') this.clientView.render();
            if (section === 'client-booking' && this.clientView && typeof this.clientView.renderBooking === 'function') this.clientView.renderBooking();
            if (section === 'client-history' && this.clientView && typeof this.clientView.renderHistory === 'function') this.clientView.renderHistory();
        } catch (err) {
            console.error('Navigation render error:', err);
            this.toast.show('Ocurrio un error al cargar la seccion', 'error');
        }
        if (this.ui && typeof this.ui.initCustomSelects === 'function') this.ui.initCustomSelects();
        this.ui.closeMobileProfile();
        this.ui.closeSidebar();
    },

    showApp() {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-shell').style.display = 'flex';
        const u = this.currentUser;
        if (u && u.role === 'business') {
            const storedPhoto = this.normalizePhotoUrl(this.store.get(u.id + '_business_profile_photo'));
            const storedPhotoPath = String(this.store.get(u.id + '_business_profile_photo_path') || '');
            if (storedPhoto && !this.normalizePhotoUrl(u.businessPhoto || '')) {
                u.businessPhoto = storedPhoto;
                if (!u.businessPhotoPath && storedPhotoPath) u.businessPhotoPath = storedPhotoPath;
                App.store.set('currentUser', u, { skipCloud: true });
            }
        }
        if (u && u.role === 'business') {
            const normalizedCategory = this.normalizeBusinessCategory(u.category || 'barberia');
            if (u.category !== normalizedCategory) {
                u.category = normalizedCategory;
                App.store.set('currentUser', u);
                const users = App.store.getList('users');
                const idx = users.findIndex(x => x.id === u.id);
                if (idx !== -1) {
                    users[idx] = u;
                    App.store.set('users', users);
                }
            }
        }
        this.syncUserPanels(u);
        this.applyBusinessVisualIdentity(u);
        document.getElementById('app-shell').classList.toggle('role-client', u.role === 'client');
        document.getElementById('app-shell').classList.toggle('role-business', u.role !== 'client');
        this.updateMobileTabsByRole(u.role);
        this.ui.closeMobileProfile();

        // Show/hide sections based on role
        const businessNav = document.querySelectorAll('.nav-item.business-only');
        const clientNav = document.querySelectorAll('.nav-item.client-only');

        if (u.role === 'client') {
            document.getElementById('dashboard-welcome').textContent = u.name;
            businessNav.forEach(n => n.style.display = 'none');
            clientNav.forEach(n => n.style.display = '');
            this.navigate('client-dashboard');
        } else {
            document.getElementById('dashboard-welcome').textContent = u.businessName || u.name;
            businessNav.forEach(n => n.style.display = '');
            clientNav.forEach(n => n.style.display = 'none');
            this.navigate('dashboard');
        }
        if (this.session && typeof this.session.start === 'function') this.session.start();
    },

    updateMobileTabsByRole(role) {
        document.querySelectorAll('.mobile-tabbar .mobile-tab').forEach(tab => {
            const isBusiness = tab.classList.contains('business-only');
            const isClient = tab.classList.contains('client-only');
            if (role === 'client') {
                tab.style.display = isClient ? '' : 'none';
            } else {
                tab.style.display = isBusiness ? '' : 'none';
            }
        });
    },

    syncMobileTabs(section) {
        document.querySelectorAll('.mobile-tabbar .mobile-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mobileSection === section);
        });
    },

    syncUserPanels(user) {
        const u = user || this.currentUser || {};
        const profileName = u.role === 'business' ? (u.businessName || u.name || 'Usuario') : (u.name || 'Usuario');
        const roleLabel = u.role === 'business' ? this.getCategoryConfig(u).label : 'Cliente';
        const initial = profileName ? profileName.charAt(0).toUpperCase() : 'U';
        const profilePhoto = u.role === 'business' ? this.getBusinessPhotoUrl(u) : '';

        const assignText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        assignText('sidebar-avatar', initial);
        assignText('sidebar-name', profileName);
        assignText('sidebar-email', u.email || 'email@email.com');
        assignText('mobile-avatar', initial);
        assignText('mobile-user-name', profileName);
        assignText('mobile-user-role', roleLabel);
        assignText('mobile-profile-avatar', initial);
        assignText('mobile-profile-name', profileName);
        assignText('mobile-profile-role', roleLabel);
        assignText('mobile-profile-email', u.email || 'Sin correo');
        assignText('mobile-profile-phone', (this.phone && this.phone.format(u.phone)) || 'Sin telefono');
        assignText('mobile-profile-address', u.address || 'Sin direccion');

        this.setAvatarElement('sidebar-avatar', initial, profilePhoto);
        this.setAvatarElement('mobile-avatar', initial, profilePhoto);
        this.setAvatarElement('mobile-profile-avatar', initial, profilePhoto);
    },

    // ---- HELPERS ----
    normalizePhotoUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^blob:[^\s"'<>]+$/i.test(raw)) return raw;
        if (/^https?:\/\/[^\s"'<>]+$/i.test(raw)) return raw;
        if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw.replace(/\s+/g, '');
        return '';
    },
    isValidImageFile(file, maxBytes = 10 * 1024 * 1024) {
        if (!file) return false;
        const mime = String(file.type || '').toLowerCase();
        return mime.startsWith('image/') && Number(file.size || 0) > 0 && Number(file.size || 0) <= maxBytes;
    },
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('Archivo no valido'));
                return;
            }
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error('No se pudo leer la imagen'));
            };
            img.src = objectUrl;
        });
    },
    async compressImageFile(file, options = {}) {
        if (!this.isValidImageFile(file)) throw new Error('Formato de imagen no soportado');

        const maxWidth = Number(options.maxWidth || 1200);
        const maxHeight = Number(options.maxHeight || 1200);
        const maxBytes = Number(options.maxBytes || 450 * 1024);
        const minQuality = Number(options.minQuality || 0.5);
        let quality = Number(options.quality || 0.82);

        const img = await this.loadImageFromFile(file);
        const srcW = Number(img.naturalWidth || img.width || 0);
        const srcH = Number(img.naturalHeight || img.height || 0);
        if (!srcW || !srcH) throw new Error('Dimensiones invalidas');

        const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
        const targetW = Math.max(1, Math.round(srcW * scale));
        const targetH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No se pudo procesar la imagen');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        const toBlob = (q) => new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error('No se pudo comprimir la imagen'));
                    return;
                }
                resolve(blob);
            }, 'image/jpeg', q);
        });

        let blob = await toBlob(quality);
        while (blob.size > maxBytes && quality > minQuality) {
            quality = Math.max(minQuality, quality - 0.08);
            blob = await toBlob(quality);
            if (quality <= minQuality) break;
        }

        return {
            blob,
            width: targetW,
            height: targetH,
            quality,
            contentType: 'image/jpeg'
        };
    },
    getBusinessPhotoUrl(user) {
        const source = user || this.currentUser;
        if (!source || !source.id) return '';
        const direct = this.normalizePhotoUrl(source.businessPhoto || '');
        if (direct) return direct;
        return this.normalizePhotoUrl(this.store.get(source.id + '_business_profile_photo'));
    },
    setAvatarElement(elementOrId, initial, photoUrl) {
        const el = typeof elementOrId === 'string'
            ? document.getElementById(elementOrId)
            : elementOrId;
        if (!el) return;

        const letter = (String(initial || 'U').charAt(0) || 'U').toUpperCase();
        const normalizedPhoto = this.normalizePhotoUrl(photoUrl);

        el.classList.remove('has-photo');
        el.textContent = letter;

        if (!normalizedPhoto) return;

        const img = document.createElement('img');
        img.className = 'avatar-image';
        img.alt = 'Foto de perfil';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.src = normalizedPhoto;
        img.onerror = () => {
            el.classList.remove('has-photo');
            el.textContent = letter;
        };

        el.textContent = '';
        el.classList.add('has-photo');
        el.appendChild(img);
    },
    normalizeBusinessCategory(category) {
        const raw = String(category || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (
            raw.includes('consult') ||
            raw.includes('clinic') ||
            raw.includes('medic') ||
            raw.includes('dental')
        ) {
            return 'consultorio';
        }
        if (
            raw.includes('salon') ||
            raw.includes('belleza') ||
            raw.includes('spa') ||
            raw.includes('estetic')
        ) {
            return 'salon';
        }
        return 'barberia';
    },
    getCategoryConfig(categoryOrUser) {
        const source = typeof categoryOrUser === 'object' && categoryOrUser
            ? categoryOrUser.category
            : categoryOrUser;
        const key = this.normalizeBusinessCategory(source);
        const catalog = {
            barberia: {
                key: 'barberia',
                label: 'Barbería',
                employeeLabel: 'Barbero',
                employeeLabelPlural: 'Barberos',
                serviceIcon: 'fa-cut',
                employeeIcon: 'fa-user-tie',
                businessIcon: 'fa-shop',
                bookingDescription: 'Agenda de citas online disponible 24/7',
                serviceIcons: ['fa-cut', 'fa-scissors', 'fa-user-tie', 'fa-star', 'fa-hand-sparkles', 'fa-gem', 'fa-magic']
            },
            salon: {
                key: 'salon',
                label: 'Salón de belleza',
                employeeLabel: 'Especialista',
                employeeLabelPlural: 'Especialistas',
                serviceIcon: 'fa-spa',
                employeeIcon: 'fa-user',
                businessIcon: 'fa-spa',
                bookingDescription: 'Agenda de citas de belleza online disponible 24/7',
                serviceIcons: ['fa-spa', 'fa-paint-brush', 'fa-hand-sparkles', 'fa-magic', 'fa-gem', 'fa-star', 'fa-heart']
            },
            consultorio: {
                key: 'consultorio',
                label: 'Consultorio',
                employeeLabel: 'Profesional',
                employeeLabelPlural: 'Profesionales',
                serviceIcon: 'fa-stethoscope',
                employeeIcon: 'fa-user-doctor',
                businessIcon: 'fa-hospital',
                bookingDescription: 'Agenda de turnos y consultas online disponible 24/7',
                serviceIcons: ['fa-stethoscope', 'fa-notes-medical', 'fa-briefcase-medical', 'fa-user-nurse', 'fa-syringe', 'fa-heart-pulse', 'fa-hospital-user']
            }
        };
        return catalog[key] || catalog.barberia;
    },
    getServiceIconSet(categoryOrUser) {
        return this.getCategoryConfig(categoryOrUser).serviceIcons;
    },
    applyBusinessVisualIdentity(user) {
        const u = user || this.currentUser;
        if (!u || u.role !== 'business') return;
        const cfg = this.getCategoryConfig(u);

        const setIcon = (selector, iconClass) => {
            const icon = document.querySelector(selector);
            if (!icon || !icon.classList) return;
            const toRemove = Array.from(icon.classList).filter(c => c.startsWith('fa-') && c !== 'fas' && c !== 'far' && c !== 'fab');
            toRemove.forEach(c => icon.classList.remove(c));
            icon.classList.add(iconClass);
        };

        setIcon('.nav-item[data-section="employees"] i', cfg.employeeIcon);
        setIcon('.nav-item[data-section="services"] i', cfg.serviceIcon);
        setIcon('.mobile-tab[data-mobile-section="clients"] i', cfg.employeeIcon);
        setIcon('.mobile-tab[data-mobile-section="settings"] i', cfg.businessIcon);
    },
    getBusinessKey(suffix) {
        return this.currentUser ? this.currentUser.id + '_' + suffix : suffix;
    },
    getBizKey(bizId, suffix) {
        return bizId + '_' + suffix;
    },
    formatDate(d) {
        if (d === null || d === undefined || d === '') return '';
        const raw = String(d).trim();
        const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

        // Date-only values (YYYY-MM-DD) represent booking day, not a UTC timestamp.
        // Build a local date at midday to avoid timezone shifts (off-by-one day).
        let date = null;
        if (ymd) {
            const year = Number(ymd[1]);
            const month = Number(ymd[2]) - 1;
            const day = Number(ymd[3]);
            date = new Date(year, month, day, 12, 0, 0, 0);
        } else if (d instanceof Date) {
            date = d;
        } else {
            date = new Date(raw);
        }

        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return raw;
        return date.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },
    // Convert 24h "HH:MM" to 12h "h:MM AM/PM"
    formatTime(t) {
        if (!t) return '';
        const [hStr, mStr] = t.split(':');
        let h = parseInt(hStr);
        const m = mStr || '00';
        const ampm = h >= 12 ? 'PM' : 'AM';
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        return `${h}:${m} ${ampm}`;
    },
    // Convert 24h hour integer to 12h string
    formatHour12(h) {
        const ampm = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12;
        if (h12 === 0) h12 = 12;
        return `${h12}:00 ${ampm}`;
    },
    buildTimeOptions(selected, stepMinutes = 30) {
        const picked = String(selected || '');
        let html = '';
        for (let total = 0; total < 24 * 60; total += stepMinutes) {
            const h = Math.floor(total / 60);
            const m = total % 60;
            const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            html += `<option value="${value}" ${picked === value ? 'selected' : ''}>${this.formatTime(value)}</option>`;
        }
        return html;
    },
    formatCurrency(n) { return '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 }); },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    getCRDate() { return new Date(new Date().toLocaleString("en-US", {timeZone: "America/Costa_Rica"})); },
    getCRDateString() { return this.getCRDate().toISOString().slice(0, 10); }
};

// ---- IN-APP NOTIFICATIONS ----
App.inAppNotifications = {
    _panelOpen: false,

    _key(bizId) {
        return (bizId || (App.currentUser && App.currentUser.id) || '') + '_in_app_notifications';
    },

    getAll(bizId) {
        return App.store.getList(this._key(bizId));
    },

    getUnreadCount(bizId) {
        return this.getAll(bizId).filter(n => !n.read).length;
    },

    add(bizId, data) {
        const notification = Object.assign({
            id: App.uid(),
            read: false,
            createdAt: new Date().toISOString()
        }, data);
        App.store.addToList(this._key(bizId), notification);
        return notification;
    },

    markAllRead(bizId) {
        const all = this.getAll(bizId);
        if (!all.length) return;
        all.forEach(n => { n.read = true; });
        App.store.set(this._key(bizId), all);
        this.renderBell();
    },

    clear(bizId) {
        App.store.remove(this._key(bizId));
        this.renderBell();
        this.closePanel();
    },

    renderBell() {
        const badge = document.getElementById('notif-bell-badge');
        if (!badge) return;
        const u = App.currentUser;
        if (!u || u.role !== 'business') { badge.style.display = 'none'; return; }
        const count = this.getUnreadCount(u.id);
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    },

    toggle() {
        if (this._panelOpen) { this.closePanel(); } else { this.openPanel(); }
    },

    openPanel() {
        const panel = document.getElementById('in-app-notifications-panel');
        const bellBtn = document.getElementById('notif-bell-btn');
        if (!panel || !bellBtn) return;
        
        this._panelOpen = true;
        this.renderPanel();
        
        // Dynamically position the panel relative to the bell button
        const rect = bellBtn.getBoundingClientRect();
        panel.style.top = (rect.bottom + 10) + 'px';
        
        // Compute available space below, minus 90px to account for the mobile bottom tab bar
        const availableSpace = window.innerHeight - rect.bottom - 90;
        
        if (window.innerWidth <= 860) {
            panel.style.right = '12px';
            panel.style.left = '12px';
            panel.style.width = 'auto';
            panel.style.maxHeight = Math.max(200, availableSpace) + 'px';
        } else {
            // align right edge with bell button's right edge
            panel.style.right = (window.innerWidth - rect.right) + 'px';
            panel.style.left = 'auto';
            panel.style.width = '380px';
            panel.style.maxHeight = Math.max(300, availableSpace) + 'px';
        }
        
        panel.classList.add('open');
        // Close on outside click
        setTimeout(() => {
            this._outsideHandler = (e) => {
                if (!panel.contains(e.target) && !e.target.closest('#notif-bell-btn')) {
                    this.closePanel();
                }
            };
            document.addEventListener('pointerdown', this._outsideHandler);
        }, 50);
    },

    closePanel() {
        const panel = document.getElementById('in-app-notifications-panel');
        if (panel) panel.classList.remove('open');
        this._panelOpen = false;
        if (this._outsideHandler) {
            document.removeEventListener('pointerdown', this._outsideHandler);
            this._outsideHandler = null;
        }
    },

    renderPanel() {
        const list = document.getElementById('notif-panel-list');
        if (!list) return;
        const u = App.currentUser;
        if (!u) return;
        const all = this.getAll(u.id);
        if (all.length === 0) {
            list.innerHTML = '<div class="notif-empty"><i class="fas fa-bell-slash"></i><p>No hay notificaciones</p></div>';
            return;
        }
        // Sort newest first
        all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        list.innerHTML = all.map(n => {
            const isUnread = !n.read;
            let icon = 'fa-bell';
            let iconColor = 'notif-icon-info';
            if (n.type === 'client_deleted_account') { icon = 'fa-user-slash'; iconColor = 'notif-icon-danger'; }
            else if (n.type === 'new_booking') { icon = 'fa-calendar-plus'; iconColor = 'notif-icon-success'; }
            let message = '';
            if (n.type === 'client_deleted_account') {
                message = `<strong>${n.clientName || 'Cliente'}</strong> eliminó su cuenta. `
                    + `Su cita del <strong>${App.formatDate(n.appointmentDate)}</strong> a las `
                    + `<strong>${App.formatTime(n.appointmentTime)}</strong>`
                    + (n.serviceName ? ` (${n.serviceName})` : '')
                    + (n.employeeName ? ` con ${n.employeeName}` : '')
                    + ` fue anulada automáticamente.`;
            } else if (n.type === 'new_booking') {
                message = `<strong>${n.clientName || 'Cliente'}</strong> reservó una cita para el `
                    + `<strong>${App.formatDate(n.appointmentDate)}</strong> a las `
                    + `<strong>${App.formatTime(n.appointmentTime)}</strong>`
                    + (n.serviceName ? ` — ${n.serviceName}` : '')
                    + (n.employeeName ? ` con ${n.employeeName}` : '') + '.';
            } else {
                message = n.message || 'Notificación del sistema';
            }
            const timeAgo = this._timeAgo(n.createdAt);
            return `<div class="notif-card ${isUnread ? 'unread' : ''}">
                <div class="notif-card-icon ${iconColor}"><i class="fas ${icon}"></i></div>
                <div class="notif-card-body">
                    <p class="notif-card-msg">${message}</p>
                    <small class="notif-card-time"><i class="fas fa-clock"></i> ${timeAgo}</small>
                </div>
            </div>`;
        }).join('');
    },

    _timeAgo(isoDate) {
        if (!isoDate) return '';
        const diff = Date.now() - new Date(isoDate).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Ahora';
        if (mins < 60) return `Hace ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 7) return `Hace ${days}d`;
        return App.formatDate(isoDate.slice(0, 10));
    }
};

// Force currency symbol with correct UTF-8 glyph.
App.formatCurrency = function formatCurrencyCRC(n) {
    return '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 0 });
};

// Centralized Costa Rica phone formatting and validation: +506 XXXX-XXXX
App.phone = {
    extractLocalDigits(value) {
        let digits = String(value || '').replace(/\D/g, '');
        if (digits.startsWith('506')) digits = digits.slice(3);
        return digits.slice(0, 8);
    },
    format(value) {
        const local = this.extractLocalDigits(value);
        if (!local) return '';
        if (local.length <= 4) return `+506 ${local}`;
        return `+506 ${local.slice(0, 4)}-${local.slice(4)}`;
    },
    isValid(value) {
        return /^\+506 \d{4}-\d{4}$/.test(String(value || '').trim());
    }
};

// ---- QR SHARE ----
App.qrShare = {
    _qr: null,
    _url: '',

    _getResponsiveSize(container) {
        const fallback = 200;
        const preview = container && typeof container.closest === 'function'
            ? container.closest('.qr-share-preview')
            : null;
        const previewWidth = preview ? preview.clientWidth : 0;
        if (!previewWidth) return fallback;

        const isMobile = window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
        const boxPadding = isMobile ? 32 : 40;
        const sizeBySpace = Math.floor(previewWidth - boxPadding);

        return Math.max(140, Math.min(220, sizeBySpace));
    },

    _getRenderSize(displaySize) {
        const dpr = Math.min(4, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
        return Math.max(320, Math.round(displaySize * dpr));
    },

    _applyPreviewSize(container, displaySize) {
        const qrCanvas = container.querySelector('canvas');
        const qrImg = container.querySelector('img');
        const sizePx = `${displaySize}px`;

        if (qrCanvas) {
            qrCanvas.style.width = sizePx;
            qrCanvas.style.height = sizePx;
            qrCanvas.style.maxWidth = '100%';
            qrCanvas.style.imageRendering = 'pixelated';
            qrCanvas.style.imageRendering = 'crisp-edges';
        }

        if (qrImg) {
            qrImg.style.width = sizePx;
            qrImg.style.height = sizePx;
            qrImg.style.maxWidth = '100%';
            qrImg.style.imageRendering = 'pixelated';
            qrImg.style.imageRendering = 'crisp-edges';
        }
    },

    async _buildQrSource(text, size) {
        if (typeof QRCode === 'undefined') return null;

        const holder = document.createElement('div');
        holder.style.position = 'fixed';
        holder.style.left = '-9999px';
        holder.style.top = '0';
        holder.style.width = '0';
        holder.style.height = '0';
        holder.style.overflow = 'hidden';
        document.body.appendChild(holder);

        try {
            new QRCode(holder, {
                text,
                width: size,
                height: size,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });

            await new Promise(resolve => requestAnimationFrame(resolve));

            const canvas = holder.querySelector('canvas');
            if (canvas) return canvas;

            const img = holder.querySelector('img');
            if (!img) return null;
            if (!img.complete) {
                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error('QR image load failed'));
                });
            }

            const out = document.createElement('canvas');
            out.width = size;
            out.height = size;
            const outCtx = out.getContext('2d');
            if (!outCtx) return null;
            outCtx.imageSmoothingEnabled = false;
            outCtx.drawImage(img, 0, 0, size, size);
            return out;
        } finally {
            document.body.removeChild(holder);
        }
    },

    generate() {
        const container = document.getElementById('qr-code-container');
        const urlEl = document.getElementById('qr-share-url');
        if (!container) return;

        const url = window.location.origin + window.location.pathname;
        this._url = url;

        // Show URL below QR
        if (urlEl) urlEl.textContent = url;

        // Clear previous QR
        container.innerHTML = '';
        this._qr = null;

        // Check if QRCode library is loaded
        if (typeof QRCode === 'undefined') {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">No se pudo cargar la librería QR</p>';
            return;
        }

        try {
            const qrSize = this._getResponsiveSize(container);
            const qrRenderSize = this._getRenderSize(qrSize);
            this._qr = new QRCode(container, {
                text: url,
                width: qrRenderSize,
                height: qrRenderSize,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            requestAnimationFrame(() => this._applyPreviewSize(container, qrSize));
        } catch (err) {
            console.error('QR generation error:', err);
            container.innerHTML = '<p style="color:var(--accent-red);font-size:0.85rem;">Error al generar el QR</p>';
        }
    },

    async download() {
        const container = document.getElementById('qr-code-container');
        if (!container) return;

        const qrCanvas = container.querySelector('canvas');
        const qrImg = container.querySelector('img');
        if (!qrCanvas && !qrImg) {
            App.toast.show('Primero genera el código QR', 'warning');
            return;
        }

        // Build a branded canvas with the QR + business name
        const u = App.currentUser || {};
        const businessName = u.businessName || u.name || 'Mi Negocio';
        const url = this._url || (window.location.origin + window.location.pathname);

        const qrSize = 1024;
        const padding = 96;
        const headerHeight = 96;
        const footerHeight = 72;
        const totalW = qrSize + padding * 2;
        const totalH = headerHeight + qrSize + footerHeight + padding * 2;

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { App.toast.show('No se pudo crear la imagen', 'error'); return; }

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, totalW, totalH);

        // Header (business name)
        ctx.fillStyle = '#1a1a2e';
        ctx.font = '700 44px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(businessName, totalW / 2, padding + 50);

        // Draw QR in HD
        let qrSource = null;
        try {
            qrSource = await this._buildQrSource(url, qrSize);
        } catch (err) {
            console.error('QR HD source error:', err);
        }
        qrSource = qrSource || qrCanvas || qrImg;
        if (!qrSource) {
            App.toast.show('No se pudo generar QR HD', 'error');
            return;
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrSource, padding, padding + headerHeight, qrSize, qrSize);
        ctx.imageSmoothingEnabled = true;

        // Footer
        ctx.fillStyle = '#6b7280';
        ctx.font = '28px Inter, sans-serif';
        ctx.fillText('Escanea para reservar', totalW / 2, padding + headerHeight + qrSize + 48);

        // Download
        const link = document.createElement('a');
        link.download = `qr-${businessName.replace(/\s+/g, '-').toLowerCase()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        App.toast.show('Código QR descargado', 'success');
    },

    shareWhatsApp() {
        const u = App.currentUser || {};
        const businessName = u.businessName || u.name || 'Mi Negocio';
        const url = this._url || (window.location.origin + window.location.pathname);
        const message = `¡Hola! 👋 Reserva tu cita en *${businessName}* de forma rápida y sencilla:\n${url}`;
        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(waUrl, '_blank');
    },

    copyLink() {
        const url = this._url || (window.location.origin + window.location.pathname);
        navigator.clipboard.writeText(url).then(() => {
            App.toast.show('Enlace copiado al portapapeles', 'success');
            const btn = document.querySelector('.qr-btn-copy');
            if (btn) {
                btn.classList.add('copied');
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> ¡Copiado!';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = originalHTML;
                }, 2000);
            }
        }).catch(() => {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            App.toast.show('Enlace copiado al portapapeles', 'success');
        });
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    App.init().catch(err => console.error('App init error:', err));
});
