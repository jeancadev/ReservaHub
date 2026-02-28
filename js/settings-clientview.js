/* ============================================
   ReservaHub - Settings Module
   ============================================ */

App.settings = {
    _pendingBusinessPhotoFile: null,
    _pendingBusinessPhotoPreview: '',
    _removeBusinessPhoto: false,

    render() {
        const u = App.currentUser;
        if (!u) return;
        const isClient = u.role === 'client';
        this._toggleRoleLayout(isClient);

        if (isClient) {
            const clientName = document.getElementById('settings-client-name');
            const clientEmail = document.getElementById('settings-client-email');
            const clientPhone = document.getElementById('settings-client-phone');
            const clientAddress = document.getElementById('settings-client-address');
            if (clientName) clientName.value = u.name || '';
            if (clientEmail) clientEmail.value = u.email || '';
            if (clientPhone) clientPhone.value = (App.phone && App.phone.format(u.phone)) || '';
            if (clientAddress) clientAddress.value = u.address || '';
            return;
        }

        document.getElementById('settings-business-name').value = u.businessName || '';
        document.getElementById('settings-phone').value = (App.phone && App.phone.format(u.phone)) || '';
        document.getElementById('settings-address').value = u.address || '';
        const businessPhotoInput = document.getElementById('settings-business-photo-file');
        const businessPhoto = typeof App.getBusinessPhotoUrl === 'function'
            ? App.getBusinessPhotoUrl(u)
            : (u.businessPhoto || '');
        if (businessPhotoInput) businessPhotoInput.value = '';
        this._clearPendingBusinessPhotoPreview();
        this._pendingBusinessPhotoFile = null;
        this._removeBusinessPhoto = false;
        u.businessPhoto = businessPhoto;
        u.businessPhotoPath = String(u.businessPhotoPath || App.store.get(u.id + '_business_profile_photo_path') || '');
        document.getElementById('settings-description').value = u.description || '';
        document.getElementById('settings-category').value = App.normalizeBusinessCategory(u.category || 'barberia');
        const capacityInput = document.getElementById('settings-daily-capacity');
        if (capacityInput) {
            const limit = App.appointments && typeof App.appointments.getDailyLimit === 'function'
                ? App.appointments.getDailyLimit(u.id)
                : 20;
            capacityInput.value = limit;
        }
        const clientLimitInput = document.getElementById('settings-client-daily-limit');
        if (clientLimitInput) {
            const limit = App.appointments && typeof App.appointments.getClientDailyLimit === 'function'
                ? App.appointments.getClientDailyLimit(u.id)
                : 1;
            clientLimitInput.value = limit;
        }
        const minHoursInput = document.getElementById('settings-booking-min-hours');
        if (minHoursInput) {
            const hours = App.appointments && typeof App.appointments.getBookingMinHours === 'function'
                ? App.appointments.getBookingMinHours(u.id)
                : 4;
            minHoursInput.value = hours;
        }
        const maxDaysInput = document.getElementById('settings-booking-max-days');
        if (maxDaysInput) {
            const days = App.appointments && typeof App.appointments.getBookingMaxDays === 'function'
                ? App.appointments.getBookingMaxDays(u.id)
                : 30;
            maxDaysInput.value = days;
        }
        this.updateBusinessPhotoPreview();
        this.renderSchedule();

        // Generate QR code for sharing business
        if (App.qrShare && typeof App.qrShare.generate === 'function') {
            App.qrShare.generate();
        }
    },

    _toggleRoleLayout(isClient) {
        const subtitle = document.getElementById('settings-subtitle');
        const businessCard = document.getElementById('settings-business-card');
        const scheduleCard = document.getElementById('settings-schedule-card');
        const clientCard = document.getElementById('settings-client-card');

        if (subtitle) {
            subtitle.textContent = isClient
                ? 'Gestiona tu perfil y datos de contacto'
                : 'Personaliza tu negocio';
        }
        if (businessCard) businessCard.style.display = isClient ? 'none' : '';
        if (scheduleCard) scheduleCard.style.display = isClient ? 'none' : '';
        if (clientCard) clientCard.style.display = isClient ? '' : 'none';
    },

    renderSchedule() {
        const container = document.getElementById('schedule-inputs');
        if (!container) return;
        const schedule = App.store.get(App.currentUser.id + '_schedule') || this._defaultSchedule();
        const lunch = this._normalizeLunchConfig(App.store.get(App.currentUser.id + '_lunch_break'));
        const lunchEnd = this._addMinutes(lunch.start, 60);
        container.innerHTML = schedule.map((s, i) => `
            <div class="schedule-row animate-fade-up" style="animation-delay:${i * 0.05}s">
                <label class="day-label">${s.day}</label>
                <select id="sched-start-${i}" class="schedule-time-select" ${!s.open ? 'disabled' : ''}>${App.buildTimeOptions(s.start || '09:00')}</select>
                <span class="schedule-separator">-</span>
                <select id="sched-end-${i}" class="schedule-time-select" ${!s.open ? 'disabled' : ''}>${App.buildTimeOptions(s.end || '18:00')}</select>
                <div class="toggle-switch">
                    <input type="checkbox" id="sched-open-${i}" ${s.open ? 'checked' : ''} onchange="document.getElementById('sched-start-${i}').disabled=!this.checked;document.getElementById('sched-end-${i}').disabled=!this.checked">
                    <label class="toggle-slider" for="sched-open-${i}"></label>
                </div>
            </div>
        `).join('') + `
            <div class="schedule-row animate-fade-up" style="animation-delay:0.4s">
                <label class="day-label">Almuerzo (1h)</label>
                <select id="sched-lunch-start" class="schedule-time-select" ${!lunch.enabled ? 'disabled' : ''} onchange="App.settings.syncLunchEnd()">${App.buildTimeOptions(lunch.start || '13:00')}</select>
                <span class="schedule-separator">-</span>
                <select id="sched-lunch-end" class="schedule-time-select" disabled>${App.buildTimeOptions(lunchEnd)}</select>
                <div class="toggle-switch">
                    <input type="checkbox" id="sched-lunch-enabled" ${lunch.enabled ? 'checked' : ''} onchange="document.getElementById('sched-lunch-start').disabled=!this.checked;App.settings.syncLunchEnd()">
                    <label class="toggle-slider" for="sched-lunch-enabled"></label>
                </div>
            </div>
            <small style="display:block;margin-top:8px;color:var(--text-muted)">Si está activo, se bloquea automáticamente 1 hora diaria para almuerzo.</small>
        `;
        this.syncLunchEnd();
    },

    _defaultSchedule() {
        return [
            { day: 'Lunes', open: true, start: '09:00', end: '18:00' },
            { day: 'Martes', open: true, start: '09:00', end: '18:00' },
            { day: 'Miércoles', open: true, start: '09:00', end: '18:00' },
            { day: 'Jueves', open: true, start: '09:00', end: '18:00' },
            { day: 'Viernes', open: true, start: '09:00', end: '18:00' },
            { day: 'Sábado', open: true, start: '09:00', end: '14:00' },
            { day: 'Domingo', open: false, start: '', end: '' }
        ];
    },

    _normalizeLunchConfig(raw) {
        const fallbackStart = '13:00';
        const start = /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(raw && raw.start ? raw.start : ''))
            ? String(raw.start)
            : fallbackStart;
        return {
            enabled: !!(raw && raw.enabled),
            start,
            duration: 60
        };
    },

    _addMinutes(time, mins) {
        const parts = String(time || '00:00').split(':').map(Number);
        const start = ((parts[0] || 0) * 60) + (parts[1] || 0);
        const total = (start + Number(mins || 0) + (24 * 60)) % (24 * 60);
        const h = Math.floor(total / 60);
        const m = total % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    syncLunchEnd() {
        const startInput = document.getElementById('sched-lunch-start');
        const endInput = document.getElementById('sched-lunch-end');
        if (!startInput || !endInput) return;
        const end = this._addMinutes(startInput.value || '13:00', 60);
        endInput.innerHTML = App.buildTimeOptions(end);
        endInput.value = end;
    },

    _clearPendingBusinessPhotoPreview() {
        const current = String(this._pendingBusinessPhotoPreview || '');
        if (current.startsWith('blob:')) URL.revokeObjectURL(current);
        this._pendingBusinessPhotoPreview = '';
    },

    onBusinessPhotoSelected(event) {
        const input = event && event.target ? event.target : document.getElementById('settings-business-photo-file');
        const file = input && input.files && input.files[0] ? input.files[0] : null;
        this._clearPendingBusinessPhotoPreview();

        if (!file) {
            this._pendingBusinessPhotoFile = null;
            this.updateBusinessPhotoPreview();
            return;
        }
        if (!App.isValidImageFile || !App.isValidImageFile(file, 10 * 1024 * 1024)) {
            App.toast.show('Selecciona una imagen valida (maximo 10MB).', 'error');
            if (input) input.value = '';
            this._pendingBusinessPhotoFile = null;
            this.updateBusinessPhotoPreview();
            return;
        }

        this._pendingBusinessPhotoFile = file;
        this._pendingBusinessPhotoPreview = URL.createObjectURL(file);
        this._removeBusinessPhoto = false;
        this.updateBusinessPhotoPreview(this._pendingBusinessPhotoPreview);
    },

    clearBusinessPhoto() {
        this._clearPendingBusinessPhotoPreview();
        this._pendingBusinessPhotoFile = null;
        this._removeBusinessPhoto = true;
        const input = document.getElementById('settings-business-photo-file');
        if (input) input.value = '';
        this.updateBusinessPhotoPreview('');
    },

    updateBusinessPhotoPreview(photoOverride) {
        const preview = document.getElementById('settings-business-photo-preview');
        if (!preview) return;
        const u = App.currentUser || {};
        const baseName = u.businessName || u.name || 'Negocio';
        const initial = baseName.charAt(0).toUpperCase();
        let photoUrl = '';
        if (photoOverride !== undefined) {
            photoUrl = String(photoOverride || '');
        } else if (this._removeBusinessPhoto) {
            photoUrl = '';
        } else if (this._pendingBusinessPhotoPreview) {
            photoUrl = this._pendingBusinessPhotoPreview;
        } else {
            photoUrl = typeof App.getBusinessPhotoUrl === 'function'
                ? App.getBusinessPhotoUrl(u)
                : (u.businessPhoto || '');
        }
        if (typeof App.setAvatarElement === 'function') {
            App.setAvatarElement(preview, initial, photoUrl);
        } else {
            preview.textContent = initial;
        }
    },

    async save(e) {
        e.preventDefault();
        const u = App.currentUser;
        if (!u) return false;
        if (u.role === 'client') return this.saveClient(e);
        const businessPhoneInput = document.getElementById('settings-phone');
        const normalizedBusinessPhone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(businessPhoneInput ? businessPhoneInput.value : '')
            : (businessPhoneInput ? businessPhoneInput.value.trim() : '');
        if (businessPhoneInput) businessPhoneInput.value = normalizedBusinessPhone;
        if (normalizedBusinessPhone && (!App.phone || !App.phone.isValid(normalizedBusinessPhone))) {
            App.toast.show('El telefono debe usar el formato +506 XXXX-XXXX', 'error');
            return false;
        }
        const minHoursInput = document.getElementById('settings-booking-min-hours');
        let bookingMinHours = minHoursInput ? Number(minHoursInput.value) : NaN;
        if (!Number.isFinite(bookingMinHours) || bookingMinHours < 0) bookingMinHours = 4;
        bookingMinHours = Math.floor(bookingMinHours);

        const maxDaysInput = document.getElementById('settings-booking-max-days');
        let bookingMaxDays = maxDaysInput ? Number(maxDaysInput.value) : NaN;
        if (!Number.isFinite(bookingMaxDays) || bookingMaxDays < 1) bookingMaxDays = 30;
        bookingMaxDays = Math.floor(bookingMaxDays);

        if (bookingMinHours > (bookingMaxDays * 24)) {
            App.toast.show('La anticipacion minima no puede ser mayor al rango maximo en dias.', 'error');
            return false;
        }

        if (minHoursInput) minHoursInput.value = bookingMinHours;
        if (maxDaysInput) maxDaysInput.value = bookingMaxDays;

        const previousBusinessPhotoPath = String(u.businessPhotoPath || App.store.get(u.id + '_business_profile_photo_path') || '');
        let normalizedBusinessPhoto = typeof App.getBusinessPhotoUrl === 'function'
            ? App.getBusinessPhotoUrl(u)
            : (u.businessPhoto || '');
        let nextBusinessPhotoPath = previousBusinessPhotoPath;
        const hasPendingPhoto = !!this._pendingBusinessPhotoFile;
        const shouldRemovePhoto = this._removeBusinessPhoto && !hasPendingPhoto;

        if (hasPendingPhoto) {
            const canUpload = App.backend
                && typeof App.backend.isStorageReady === 'function'
                && App.backend.isStorageReady();
            if (!canUpload) {
                App.toast.show('La carga de fotos requiere Supabase activo y sesion iniciada.', 'error');
                return false;
            }
        }

        if (hasPendingPhoto) {
            try {
                const compressed = await App.compressImageFile(this._pendingBusinessPhotoFile, {
                    maxWidth: 1200,
                    maxHeight: 1200,
                    maxBytes: 450 * 1024,
                    quality: 0.82,
                    minQuality: 0.52
                });
                const upload = await App.backend.uploadPhotoBlob({
                    blob: compressed.blob,
                    ownerId: u.id,
                    scope: 'business-photo',
                    originalName: this._pendingBusinessPhotoFile.name
                });
                normalizedBusinessPhoto = upload.url;
                nextBusinessPhotoPath = upload.path;
                if (previousBusinessPhotoPath && previousBusinessPhotoPath !== nextBusinessPhotoPath) {
                    await App.backend.removeStoragePath(previousBusinessPhotoPath);
                }
            } catch (err) {
                console.error('Business photo upload error:', err);
                App.toast.show('No se pudo subir la foto del negocio.', 'error');
                return false;
            }
        } else if (shouldRemovePhoto) {
            normalizedBusinessPhoto = '';
            nextBusinessPhotoPath = '';
            if (previousBusinessPhotoPath && App.backend && typeof App.backend.removeStoragePath === 'function') {
                await App.backend.removeStoragePath(previousBusinessPhotoPath);
            }
        }

        u.businessName = document.getElementById('settings-business-name').value.trim();
        u.phone = normalizedBusinessPhone;
        u.address = document.getElementById('settings-address').value.trim();
        u.businessPhoto = normalizedBusinessPhoto;
        u.businessPhotoPath = nextBusinessPhotoPath;
        u.description = document.getElementById('settings-description').value.trim();
        u.category = App.normalizeBusinessCategory(document.getElementById('settings-category').value);
        App.store.set(u.id + '_business_profile_photo', normalizedBusinessPhoto);
        App.store.set(u.id + '_business_profile_photo_path', nextBusinessPhotoPath);
        this._clearPendingBusinessPhotoPreview();
        this._pendingBusinessPhotoFile = null;
        this._removeBusinessPhoto = false;
        const businessPhotoInput = document.getElementById('settings-business-photo-file');
        if (businessPhotoInput) businessPhotoInput.value = '';
        const capacityInput = document.getElementById('settings-daily-capacity');
        let dailyCapacity = capacityInput ? Number(capacityInput.value) : NaN;
        if (!Number.isFinite(dailyCapacity) || dailyCapacity < 1) dailyCapacity = 20;
        dailyCapacity = Math.floor(dailyCapacity);
        if (capacityInput) capacityInput.value = dailyCapacity;
        App.store.set(u.id + '_daily_capacity', dailyCapacity);

        const clientLimitInput = document.getElementById('settings-client-daily-limit');
        let clientDailyLimit = clientLimitInput ? Number(clientLimitInput.value) : NaN;
        if (!Number.isFinite(clientDailyLimit) || clientDailyLimit < 1) clientDailyLimit = 1;
        clientDailyLimit = Math.floor(clientDailyLimit);
        if (clientLimitInput) clientLimitInput.value = clientDailyLimit;
        App.store.set(u.id + '_client_daily_limit', clientDailyLimit);
        App.store.set(u.id + '_booking_min_hours', bookingMinHours);
        App.store.set(u.id + '_booking_max_days', bookingMaxDays);

        const users = App.store.getList('users');
        const idx = users.findIndex(x => x.id === u.id);
        if (idx !== -1) { users[idx] = u; App.store.set('users', users, { skipCloud: true }); }
        App.store.set('currentUser', u, { skipCloud: true });
        App.currentUser = u;
        if (App.backend && App.backend.enabled && typeof App.backend.updateCurrentProfile === 'function') {
            try {
                await App.backend.updateCurrentProfile(u);
            } catch (err) {
                console.error('Supabase profile update error:', err);
                App.toast.show('No se pudo sincronizar el perfil en Supabase', 'warning');
            }
        }
        document.getElementById('dashboard-welcome').textContent = u.businessName || u.name;
        if (typeof App.syncUserPanels === 'function') App.syncUserPanels(u);
        if (typeof App.applyBusinessVisualIdentity === 'function') App.applyBusinessVisualIdentity(u);
        App.toast.show('Configuración guardada', 'success');
        return false;
    },

    async saveClient(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const u = App.currentUser;
        if (!u) return false;

        const nameInput = document.getElementById('settings-client-name');
        const emailInput = document.getElementById('settings-client-email');
        const phoneInput = document.getElementById('settings-client-phone');
        const addressInput = document.getElementById('settings-client-address');

        const name = nameInput ? nameInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const phone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(phoneInput ? phoneInput.value : '')
            : (phoneInput ? phoneInput.value.trim() : '');
        if (phoneInput) phoneInput.value = phone;
        const address = addressInput ? addressInput.value.trim() : '';

        if (!name) {
            App.toast.show('Ingresa tu nombre completo', 'error');
            return false;
        }
        if (!email) {
            App.toast.show('Ingresa un correo valido', 'error');
            return false;
        }
        if (!phone || !App.phone || !App.phone.isValid(phone)) {
            App.toast.show('El telefono debe usar el formato +506 XXXX-XXXX', 'error');
            return false;
        }

        const users = App.store.getList('users');
        const emailExists = users.some(user =>
            user.id !== u.id && String(user.email || '').toLowerCase() === email
        );
        if (emailExists) {
            App.toast.show('Ese correo ya esta registrado por otro usuario', 'error');
            return false;
        }

        const previous = {
            name: String(u.name || ''),
            email: String(u.email || '').toLowerCase()
        };

        u.name = name;
        u.email = email;
        u.phone = phone;
        u.address = address;

        const idx = users.findIndex(user => user.id === u.id);
        if (idx !== -1) users[idx] = u;
        App.store.set('users', users, { skipCloud: true });
        App.store.set('currentUser', u, { skipCloud: true });
        App.currentUser = u;

        this._syncClientRecords(previous, u);

        if (App.backend && App.backend.enabled) {
            try {
                if (typeof App.backend.syncAuthEmail === 'function') {
                    const emailResult = await App.backend.syncAuthEmail(email);
                    if (emailResult && emailResult.changed) {
                        App.toast.show('Te enviamos confirmacion al nuevo correo para actualizar login', 'info');
                    }
                }
                if (typeof App.backend.updateCurrentProfile === 'function') {
                    await App.backend.updateCurrentProfile(u);
                }
            } catch (err) {
                console.error('Supabase client profile update error:', err);
                App.toast.show('Perfil guardado localmente, pero fallo la sincronizacion en Supabase', 'warning');
            }
        }

        if (typeof App.syncUserPanels === 'function') App.syncUserPanels(u);
        if (App.currentSection === 'client-dashboard' && App.clientView && typeof App.clientView.render === 'function') {
            App.clientView.render();
        }
        if (App.currentSection === 'client-history' && App.clientView && typeof App.clientView.renderHistory === 'function') {
            App.clientView.renderHistory();
        }

        App.toast.show('Perfil actualizado', 'success');
        return false;
    },

    _syncClientRecords(previous, updated) {
        const users = App.store.getList('users');
        const businesses = users.filter(user => user.role === 'business');

        businesses.forEach(biz => {
            const appointmentsKey = biz.id + '_appointments';
            const appointments = App.store.getList(appointmentsKey);
            let appointmentsChanged = false;
            const nextAppointments = appointments.map(appt => {
                const apptEmail = String(appt.clientEmail || '').toLowerCase();
                const matchByEmail = previous.email && apptEmail === previous.email;
                const matchByName = !previous.email && appt.clientName === previous.name;
                if (!matchByEmail && !matchByName) return appt;
                appointmentsChanged = true;
                return Object.assign({}, appt, {
                    clientName: updated.name,
                    clientEmail: updated.email
                });
            });
            if (appointmentsChanged) App.store.set(appointmentsKey, nextAppointments);

            const clientsKey = biz.id + '_clients';
            const clients = App.store.getList(clientsKey);
            let clientsChanged = false;
            const nextClients = clients.map(client => {
                const clientEmail = String(client.email || '').toLowerCase();
                const matchByEmail = previous.email && clientEmail === previous.email;
                const matchByName = !previous.email && client.name === previous.name;
                if (!matchByEmail && !matchByName) return client;
                clientsChanged = true;
                return Object.assign({}, client, {
                    name: updated.name,
                    email: updated.email,
                    phone: updated.phone || ''
                });
            });
            if (clientsChanged) App.store.set(clientsKey, nextClients);
        });
    },

    saveSchedule(e) {
        e.preventDefault();
        if (!App.currentUser || App.currentUser.role === 'client') return false;
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const schedule = days.map((d, i) => ({
            day: d,
            open: document.getElementById('sched-open-' + i).checked,
            start: document.getElementById('sched-start-' + i).value,
            end: document.getElementById('sched-end-' + i).value
        }));
        const invalid = schedule.find(s => s.open && (!s.start || !s.end || s.start >= s.end));
        if (invalid) {
            App.toast.show(`Revisa el horario de ${invalid.day}: la hora final debe ser mayor que la inicial.`, 'error');
            return false;
        }

        const lunch = this._normalizeLunchConfig({
            enabled: !!(document.getElementById('sched-lunch-enabled') && document.getElementById('sched-lunch-enabled').checked),
            start: document.getElementById('sched-lunch-start') ? document.getElementById('sched-lunch-start').value : '13:00'
        });
        App.store.set(App.currentUser.id + '_schedule', schedule);
        App.store.set(App.currentUser.id + '_lunch_break', lunch);
        App.toast.show('Horario guardado', 'success');
        return false;
    },

    deleteAccount() {
        const u = App.currentUser;
        if (!u) return;
        const isBusiness = u.role === 'business';
        const roleName = isBusiness ? 'negocio' : 'cliente';

        App.confirm.show(
            'Eliminar cuenta permanentemente',
            `¿Estas seguro de que deseas eliminar tu cuenta de ${roleName}? Se borraran tus datos, perfil y credenciales de acceso.`,
            () => {
                (async () => {
                    const userId = u.id;
                    let authUserDeleted = false;

                    if (isBusiness) {
                        const employees = App.store.getList(userId + '_employees');
                        const businessPhotoPath = String(
                            u.businessPhotoPath
                            || App.store.get(userId + '_business_profile_photo_path')
                            || ''
                        );
                        if (businessPhotoPath && App.backend && typeof App.backend.removeStoragePath === 'function') {
                            await App.backend.removeStoragePath(businessPhotoPath);
                        }
                        if (App.backend && typeof App.backend.removeStoragePath === 'function') {
                            for (let i = 0; i < employees.length; i += 1) {
                                const photoPath = String(employees[i] && employees[i].photoPath ? employees[i].photoPath : '');
                                if (photoPath) await App.backend.removeStoragePath(photoPath);
                            }
                        }
                        const suffixes = ['appointments', 'clients', 'services', 'employees', 'schedule',
                                        'daily_capacity', 'client_daily_limit', 'booking_min_hours', 'booking_max_days',
                                        'lunch_break', 'business_profile_photo', 'business_profile_photo_path'];
                        suffixes.forEach(s => App.store.remove(userId + '_' + s));

                        employees.forEach(emp => App.store.remove('ap_' + userId + '_emp_avail_' + emp.id));
                    } else {
                        const users = App.store.getList('users');
                        const businesses = users.filter(x => x.role === 'business');
                        const clientEmail = String(u.email || '').toLowerCase();
                        businesses.forEach(biz => {
                            // --- Cancel active appointments & notify business ---
                            const apptsKey = biz.id + '_appointments';
                            const appts = App.store.getList(apptsKey);
                            const clientAppts = appts.filter(a =>
                                String(a.clientEmail || '').toLowerCase() === clientEmail
                            );
                            const activeAppts = clientAppts.filter(a =>
                                a.status === 'pending' || a.status === 'confirmed'
                            );
                            if (clientAppts.length > 0) {
                                // Remove all client appointments (history + active)
                                const remaining = appts.filter(a =>
                                    String(a.clientEmail || '').toLowerCase() !== clientEmail
                                );
                                App.store.set(apptsKey, remaining);
                            }
                            // Create in-app notification for each cancelled active appointment
                            if (activeAppts.length > 0 && App.inAppNotifications) {
                                activeAppts.forEach(appt => {
                                    App.inAppNotifications.add(biz.id, {
                                        type: 'client_deleted_account',
                                        clientName: u.name || '',
                                        clientEmail: u.email || '',
                                        appointmentDate: appt.date || '',
                                        appointmentTime: appt.time || '',
                                        serviceName: appt.serviceName || '',
                                        employeeName: appt.employeeName || ''
                                    });
                                });
                            }
                            // --- Remove client from clients list ---
                            const clientsKey = biz.id + '_clients';
                            const clients = App.store.getList(clientsKey);
                            const updated = clients.filter(c =>
                                String(c.email || '').toLowerCase() !== clientEmail
                            );
                            if (updated.length !== clients.length) {
                                App.store.set(clientsKey, updated);
                            }
                        });
                    }

                    const users = App.store.getList('users');
                    const filtered = users.filter(x => x.id !== userId);
                    App.store.set('users', filtered, { skipCloud: true });

                    if (App.backend && App.backend.enabled && typeof App.backend.deleteCurrentAccountData === 'function') {
                        try {
                            await App.backend.flushStateWrites();
                            await App.backend.deleteCurrentAccountData(u);
                        } catch (err) {
                            console.error('Supabase delete account error:', err);
                        }
                    }

                    if (App.backend && App.backend.enabled && typeof App.backend.deleteCurrentAuthUser === 'function') {
                        try {
                            await App.backend.deleteCurrentAuthUser();
                            authUserDeleted = true;
                        } catch (err) {
                            console.error('Supabase auth user delete error:', err);
                            App.toast.show('No se pudo eliminar el usuario de autenticacion (auth.users)', 'warning');
                        }
                    }

                    if (!authUserDeleted && App.backend && App.backend.enabled && typeof App.backend.signOut === 'function') {
                        try {
                            await App.backend.signOut();
                        } catch (err) {
                            console.error('Supabase signout after delete error:', err);
                        }
                    }

                    App.store.remove('currentUser', { skipCloud: true });
                    App.currentUser = null;
                    if (App.session && typeof App.session.stop === 'function') App.session.stop();
                    if (App.ui && typeof App.ui.closeMobileProfile === 'function') App.ui.closeMobileProfile();
                    if (App.ui && typeof App.ui.closeSidebar === 'function') App.ui.closeSidebar();
                    document.getElementById('app-shell').style.display = 'none';
                    document.getElementById('auth-screen').style.display = 'flex';
                    if (App.auth && typeof App.auth.resetAuthForms === 'function') App.auth.resetAuthForms();
                    App.auth.showLogin();
                    App.toast.show('Cuenta eliminada permanentemente', 'info');
                })().catch(err => {
                    console.error('Delete account flow error:', err);
                    App.toast.show('No se pudo completar la eliminacion de la cuenta', 'error');
                });
            }
        );
    }
};

/* ============================================
   ReservaHub - Client View Module (COMPLETE)
   Full booking flow from client's profile
   ============================================ */

App.clientView = {
    _renderAvatar(name, photoUrl) {
        const displayName = String(name || '').trim();
        const initial = (displayName.charAt(0) || 'U').toUpperCase();
        const normalizedPhoto = typeof App.normalizePhotoUrl === 'function'
            ? App.normalizePhotoUrl(photoUrl)
            : String(photoUrl || '').trim();
        if (!normalizedPhoto) {
            return `<div class="employee-avatar">${initial}</div>`;
        }
        return `<div class="employee-avatar has-photo"><img class="avatar-image" src="${normalizedPhoto}" alt="Foto de perfil"></div>`;
    },

    _getBusinessPhoto(biz) {
        if (!biz) return '';
        if (typeof App.getBusinessPhotoUrl === 'function') return App.getBusinessPhotoUrl(biz);
        return String(biz.businessPhoto || '').trim();
    },

    // -- Main dashboard for client --
    render() {
        const u = App.currentUser;
        const allAppts = this._getAllAppointments();
        const now = new Date().toISOString().slice(0, 10);
        const upcoming = allAppts.filter(a => a.date >= now && a.status !== 'cancelled');
        const completed = allAppts.filter(a => a.status === 'completed');

        document.getElementById('client-upcoming').textContent = upcoming.length;
        document.getElementById('client-total-visits').textContent = completed.length;

        // Render upcoming and past combined
        const tbody = document.getElementById('client-appointments-list');
        if (allAppts.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No hay citas aún. ¡Reserva tu primera cita!</td></tr>';
            return;
        }
        allAppts.sort((a, b) => b.date.localeCompare(a.date));
        tbody.innerHTML = allAppts.map(a => `
            <tr class="animate-fade-up">
                <td data-label="Fecha">${App.formatDate(a.date)}</td>
                <td data-label="Hora">${App.formatTime(a.time)}</td>
                <td data-label="Servicio">${a.serviceName || '-'}</td>
                <td data-label="Profesional">${a.employeeName || '-'}</td>
                <td data-label="Negocio">${a._business || '-'}</td>
                <td data-label="Estado"><span class="badge badge-${a.status}">${App.appointments && typeof App.appointments.getAppointmentStatusLabel === 'function' ? App.appointments.getAppointmentStatusLabel(a) : App.dashboard.statusLabel(a.status)}</span></td>
            </tr>
        `).join('');
    },

    _getAllAppointments() {
        const u = App.currentUser;
        const allAppts = [];
        const businesses = App.store.getList('users').filter(x => x.role === 'business');
        businesses.forEach(biz => {
            const appts = App.store.getList(biz.id + '_appointments');
            appts.forEach(a => {
                if (a.clientEmail === u.email || a.clientName === u.name) {
                    a._business = biz.businessName || biz.name;
                    a._bizId = biz.id;
                    allAppts.push(a);
                }
            });
        });
        return allAppts;
    },

    // -- Booking flow --
    renderBooking() {
        const container = document.getElementById('client-booking-content');
        // Step 1: Choose a business
        const businesses = App.store.getList('users').filter(x => x.role === 'business');
        if (businesses.length === 0) {
            container.innerHTML = '<div class="empty-state animate-fade-in"><i class="fas fa-store"></i><p>No hay negocios disponibles todavía</p></div>';
            return;
        }

        // Reset booking data
        App.clientBookingStep = App.clientBookingStep || 1;
        App.clientBookingData = App.clientBookingData || {};

        this._renderBookingStep(container);
    },

    _renderBookingStep(container) {
        const step = App.clientBookingStep;
        const bd = App.clientBookingData;

        // Step progress indicator
        const stepNames = ['Negocio', 'Servicio', 'Profesional', 'Fecha y Hora', 'Confirmar'];
        let progressHtml = '<div class="booking-steps-bar">';
        stepNames.forEach((name, i) => {
            const num = i + 1;
            const cls = num < step ? 'completed' : num === step ? 'active' : '';
            progressHtml += `<div class="step-indicator ${cls}"><span class="step-num">${num < step ? '<i class="fas fa-check"></i>' : num}</span><span class="step-label">${name}</span></div>`;
        });
        progressHtml += '</div>';

        let bodyHtml = '';

        if (step === 1) {
            // Choose business
            const businesses = App.store.getList('users').filter(x => x.role === 'business');
            bodyHtml = '<h3 class="booking-section-title">Selecciona un negocio</h3><div class="booking-options-grid">';
            bodyHtml += businesses.map(biz => `
                <div class="booking-option ${bd.bizId === biz.id ? 'selected' : ''}" onclick="App.clientView._selectBiz('${biz.id}')">
                    ${this._renderAvatar((biz.businessName || biz.name), this._getBusinessPhoto(biz))}
                    <h4>${biz.businessName || biz.name}</h4>
                    <p style="color:var(--text-muted);font-size:0.85rem">${App.getCategoryConfig(biz).label}</p>
                    ${biz.address ? `<p style="color:var(--text-muted);font-size:0.8rem"><i class="fas fa-map-marker-alt"></i> ${biz.address}</p>` : ''}
                </div>
            `).join('');
            bodyHtml += '</div>';
        } else if (step === 2) {
            // Choose service
            const services = App.store.getList(App.getBizKey(bd.bizId, 'services'));
            const biz = App.store.getList('users').find(u => u.id === bd.bizId);
            const icons = App.getServiceIconSet(biz || App.currentUser);
            bodyHtml = '<h3 class="booking-section-title">Elige un servicio</h3><div class="booking-options-grid">';
            if (services.length === 0) {
                bodyHtml += '<p class="empty-text">Este negocio no tiene servicios configurados</p>';
            } else {
                bodyHtml += services.map((s, i) => `
                    <div class="booking-option ${bd.serviceId === s.id ? 'selected' : ''}" onclick="App.clientView._selectService('${s.id}')">
                        <div class="service-icon" style="margin-bottom:8px"><i class="fas ${icons[i % icons.length]}"></i></div>
                        <h4>${s.name}</h4>
                        <p><i class="fas fa-clock"></i> ${s.duration} min</p>
                        <div class="price">${App.formatCurrency(s.price)}</div>
                        ${s.description ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${s.description}</p>` : ''}
                    </div>
                `).join('');
            }
            bodyHtml += '</div>';
        } else if (step === 3) {
            // Choose barber/employee: only show those available on a future date
            const employees = App.store.getList(App.getBizKey(bd.bizId, 'employees'));
            const biz = App.store.getList('users').find(u => u.id === bd.bizId);
            const cfg = App.getCategoryConfig(biz || App.currentUser);
            bodyHtml = `<h3 class="booking-section-title">Elige tu ${cfg.employeeLabel.toLowerCase()}</h3><div class="booking-options-grid">`;
            if (employees.length === 0) {
                bodyHtml += '<p class="empty-text">No hay profesionales disponibles</p>';
            } else {
                bodyHtml += employees.map(e => {
                    // Show their available days summary
                    const avail = App.store.get('ap_' + bd.bizId + '_emp_avail_' + e.id);
                    const availDays = avail ? avail.filter(d => d.available).map(d => d.day.slice(0, 3)).join(', ') : 'Lun-Sáb';
                    return `
                    <div class="booking-option ${bd.empId === e.id ? 'selected' : ''}" onclick="App.clientView._selectEmp('${e.id}')">
                        ${this._renderAvatar(e.name, e.photoUrl)}
                        <h4>${e.name}</h4>
                        <p>${e.specialty || 'General'}</p>
                        <p style="font-size:0.8rem;color:var(--text-muted);margin-top:6px"><i class="fas fa-calendar-check"></i> ${availDays}</p>
                    </div>`;
                }).join('');
            }
            bodyHtml += '</div>';
        } else if (step === 4) {
            // Choose date and time
            bodyHtml = this._renderDateTimePicker();
        } else if (step === 5) {
            // Confirm + notes
            bodyHtml = this._renderConfirmation();
        }

        // Navigation buttons
        let navHtml = '<div class="booking-nav-btns">';
        if (step > 1) navHtml += `<button class="btn btn-outline ripple-btn" onclick="App.clientView._prevStep()"><i class="fas fa-arrow-left"></i> Atrás</button>`;
        else navHtml += '<div></div>';
        if (step < 5) navHtml += `<button class="btn btn-primary ripple-btn" onclick="App.clientView._nextStep()">Siguiente <i class="fas fa-arrow-right"></i></button>`;
        else navHtml += `<button class="btn btn-primary ripple-btn" onclick="App.clientView._confirmBooking()"><i class="fas fa-check"></i> Confirmar Reserva</button>`;
        navHtml += '</div>';

        container.innerHTML = progressHtml + bodyHtml + navHtml;
        App.ui.initRipple();
    },

    _selectBiz(bizId) {
        App.clientBookingData.bizId = bizId;
        const biz = App.store.getList('users').find(u => u.id === bizId);
        App.clientBookingData.bizName = biz ? (biz.businessName || biz.name) : '';
        App.clientBookingData.bizAddress = biz ? (biz.address || '') : '';
        App.clientBookingData.bizPhoto = biz ? this._getBusinessPhoto(biz) : '';
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _selectService(svcId) {
        const bd = App.clientBookingData;
        bd.serviceId = svcId;
        const s = App.store.getList(App.getBizKey(bd.bizId, 'services')).find(x => x.id === svcId);
        bd.serviceName = s ? s.name : '';
        bd.servicePrice = s ? s.price : 0;
        bd.serviceDuration = s ? s.duration : 30;
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _selectEmp(empId) {
        const bd = App.clientBookingData;
        bd.empId = empId;
        const emp = App.store.getList(App.getBizKey(bd.bizId, 'employees')).find(e => e.id === empId);
        bd.empName = emp ? emp.name : '';
        bd.empPhoto = emp ? (emp.photoUrl || '') : '';
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _nextStep() {
        const bd = App.clientBookingData;
        const step = App.clientBookingStep;
        if (step === 1 && !bd.bizId) { App.toast.show('Selecciona un negocio', 'warning'); return; }
        if (step === 2 && !bd.serviceId) { App.toast.show('Selecciona un servicio', 'warning'); return; }
        if (step === 3 && !bd.empId) { App.toast.show('Selecciona un profesional', 'warning'); return; }
        if (step === 4 && (!bd.date || !bd.time)) { App.toast.show('Selecciona fecha y hora', 'warning'); return; }
        App.clientBookingStep++;
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _prevStep() {
        if (App.clientBookingStep > 1) {
            App.clientBookingStep--;
            this._renderBookingStep(document.getElementById('client-booking-content'));
        }
    },

    _renderDateTimePicker() {
        const bd = App.clientBookingData;
        const month = App.clientBookingMonth || new Date();
        App.clientBookingMonth = month;
        const year = month.getFullYear(), m = month.getMonth();
        const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const firstDay = new Date(year, m, 1).getDay();
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const today = App.getCRDate(); today.setHours(0,0,0,0);

        // Check employee availability key using biz prefix
        const availKey = bd.bizId + '_emp_avail_' + bd.empId;
        const avail = App.store.get('ap_' + availKey) || null;

        const bookingPolicy = App.appointments && typeof App.appointments.getBookingPolicy === 'function'
            ? App.appointments.getBookingPolicy(bd.bizId)
            : null;

        let html = '<h3 class="booking-section-title">Selecciona fecha y hora</h3>';
        if (bookingPolicy) {
            html += `<p class="booking-lunch-note"><i class="fas fa-hourglass-half"></i> Reservas permitidas con minimo ${bookingPolicy.minHours}h y maximo ${bookingPolicy.maxDays} dias de anticipacion.</p>`;
        }
        html += '<div class="booking-calendar-wrapper">';
        html += '<div class="calendar-header">';
        html += `<button class="btn btn-sm btn-outline" onclick="App.clientView._prevMonth()"><i class="fas fa-chevron-left"></i></button>`;
        html += `<h4>${months[m]} ${year}</h4>`;
        html += `<button class="btn btn-sm btn-outline" onclick="App.clientView._nextMonth()"><i class="fas fa-chevron-right"></i></button>`;
        html += '</div>';
        html += '<div class="booking-calendar-grid">';
        ['Do','Lu','Ma','Mi','Ju','Vi','Sa'].forEach(d => { html += `<div class="day-name">${d}</div>`; });
        for (let i = 0; i < firstDay; i++) html += '<div class="day-cell empty"></div>';
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, m, day);
            const dateStr = `${year}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isPast = date < today;
            const isToday = date.getTime() === today.getTime();
            const selected = bd.date === dateStr;
            // Check if employee is available on this day
            const jsDay = date.getDay();
            const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
            const dayAvail = avail ? avail[dayIdx] : null;
            const empAvailable = !avail || (dayAvail && dayAvail.available);
            const daily = App.appointments && typeof App.appointments.getDailyAvailability === 'function'
                ? App.appointments.getDailyAvailability(dateStr, null, bd.bizId)
                : null;
            const isFull = !!(daily && daily.isFull);
            const bookingStatus = App.appointments && typeof App.appointments.getBookingDateStatus === 'function'
                ? App.appointments.getBookingDateStatus(dateStr, bd.bizId)
                : { isTooSoon: false, isTooFar: false, minHours: 0, maxDays: 0 };
            const disabledByWindow = !!(bookingStatus.isTooSoon || bookingStatus.isTooFar);
            const disabled = isPast || !empAvailable || isFull || disabledByWindow;
            let title = '';
            if (isFull && daily) title = `Cupo completo (${daily.booked}/${daily.limit})`;
            else if (bookingStatus.isTooSoon) title = `Solo se permiten reservas con ${bookingStatus.minHours} horas de anticipacion`;
            else if (bookingStatus.isTooFar) title = `Solo se permiten reservas hasta ${bookingStatus.maxDays} dias hacia adelante`;
            html += `<div class="day-cell ${disabled ? 'disabled' : ''} ${isFull ? 'full' : ''} ${isToday ? 'today' : ''} ${selected ? 'selected' : ''}" title="${title}" onclick="${disabled ? '' : `App.clientView._selectDate('${dateStr}')`}">${day}</div>`;
        }
        html += '</div></div>';

        // Time slots
        html += '<div class="time-slots-section">';
        html += '<h4 style="margin:16px 0 8px">Horarios disponibles</h4>';
        const lunchInfo = this._getClientLunchInfo(bd.date || null);
        if (lunchInfo) {
            html += `<p class="booking-lunch-note"><i class="fas fa-utensils"></i> ${lunchInfo.message}</p>`;
        }
        html += '<div id="client-time-slots">';
        if (bd.date) {
            html += this._getTimeSlotsHtml();
        } else {
            html += '<p class="empty-text">Selecciona una fecha para ver horarios</p>';
        }
        html += '</div></div>';

        return html;
    },

    _selectDate(dateStr) {
        App.clientBookingData.date = dateStr;
        App.clientBookingData.time = null;
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _prevMonth() {
        App.clientBookingMonth = App.clientBookingMonth || new Date();
        App.clientBookingMonth.setMonth(App.clientBookingMonth.getMonth() - 1);
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _nextMonth() {
        App.clientBookingMonth = App.clientBookingMonth || new Date();
        App.clientBookingMonth.setMonth(App.clientBookingMonth.getMonth() + 1);
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _getTimeSlotsHtml() {
        const bd = App.clientBookingData;
        if (!bd.date) return '<p class="empty-text">Selecciona una fecha</p>';
        const bookingStatus = App.appointments && typeof App.appointments.getBookingDateStatus === 'function'
            ? App.appointments.getBookingDateStatus(bd.date, bd.bizId)
            : null;
        if (bookingStatus && bookingStatus.isTooSoon) {
            return `<p class="empty-text">Esta fecha aun no se puede reservar. Debe existir al menos ${bookingStatus.minHours} horas de anticipacion.</p>`;
        }
        if (bookingStatus && bookingStatus.isTooFar) {
            return `<p class="empty-text">Esta fecha supera el maximo permitido de ${bookingStatus.maxDays} dias de anticipacion.</p>`;
        }
        const daily = App.appointments && typeof App.appointments.getDailyAvailability === 'function'
            ? App.appointments.getDailyAvailability(bd.date, null, bd.bizId)
            : null;
        if (daily && daily.isFull) return `<p class="empty-text">Cupo diario completo (${daily.booked}/${daily.limit})</p>`;

        const duration = Number(bd.serviceDuration) || 30;
        const slots = App.appointments && typeof App.appointments._getAvailableSlots === 'function'
            ? App.appointments._getAvailableSlots(bd.date, bd.empId, duration, null, bd.bizId, { useTeamCapacity: true })
            : [];
        const lunchBlockedSlots = this._getLunchBlockedSlots(bd.date, bd.empId, bd.bizId, duration);

        if (!slots.length && !lunchBlockedSlots.length) return '<p class="empty-text">No hay horarios disponibles para este día</p>';

        const mixed = [];
        slots.forEach(slot => mixed.push({ time: slot, type: 'available' }));
        lunchBlockedSlots
            .filter(slot => !slots.includes(slot))
            .forEach(slot => mixed.push({ time: slot, type: 'lunch' }));
        mixed.sort((a, b) => this._toMinutes(a.time) - this._toMinutes(b.time));

        return '<div class="time-slots-grid">' + mixed.map(item => {
            const slot = item.time;
            const isLunch = item.type === 'lunch';
            const selected = bd.time === slot;
            const display = App.formatTime(slot);
            if (isLunch) {
                return `<div class="time-slot blocked-lunch"><span>${display}</span><small>Almuerzo</small></div>`;
            }
            return `<div class="time-slot ${selected ? 'selected' : ''}" onclick="App.clientView._selectTime('${slot}')">${display}</div>`;
        }).join('') + '</div>';
    },

    _selectTime(time) {
        App.clientBookingData.time = time;
        this._renderBookingStep(document.getElementById('client-booking-content'));
    },

    _getClientLunchInfo(dateStr) {
        const bd = App.clientBookingData || {};
        const bizId = bd.bizId;
        if (!bizId) return null;
        const raw = App.store.get(bizId + '_lunch_break');
        if (!raw || !raw.enabled) return null;
        const [h, m] = String(raw.start || '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        const startMin = (h * 60) + m;
        const endMin = startMin + 60;
        let start = startMin;
        let end = endMin;

        if (dateStr && App.appointments && typeof App.appointments._getScheduleWindow === 'function') {
            const window = App.appointments._getScheduleWindow(dateStr, bd.empId, bizId);
            if (!window) return null;
            start = Math.max(startMin, window.start);
            end = Math.min(endMin, window.end);
            if (end <= start) return null;
        }

        return {
            start,
            end,
            message: `Horario bloqueado por almuerzo del equipo: ${App.formatTime(this._minutesToTime(start))} - ${App.formatTime(this._minutesToTime(end))}.`
        };
    },

    _getLunchBlockedSlots(dateStr, employeeId, bizId, duration) {
        if (!dateStr || !employeeId || !bizId) return [];
        const lunch = this._getClientLunchInfo(dateStr);
        if (!lunch) return [];
        if (!App.appointments || typeof App.appointments._getScheduleWindow !== 'function') return [];
        const window = App.appointments._getScheduleWindow(dateStr, employeeId, bizId);
        if (!window) return [];

        const step = 30;
        const out = [];

        for (let min = window.start; min + duration <= window.end; min += step) {
            const slot = this._minutesToTime(min);
            const insideWindow = App.appointments && typeof App.appointments.isWithinBookingWindow === 'function'
                ? App.appointments.isWithinBookingWindow(dateStr, slot, bizId)
                : true;
            if (!insideWindow) continue;
            const overlapsLunch = min < lunch.end && lunch.start < (min + duration);
            if (!overlapsLunch) continue;
            out.push(slot);
        }
        return out;
    },

    _toMinutes(time) {
        const [h, m] = String(time || '00:00').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    },

    _minutesToTime(total) {
        const value = Math.max(0, Number(total) || 0);
        const h = Math.floor(value / 60) % 24;
        const m = value % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    _renderConfirmation() {
        const bd = App.clientBookingData;
        const u = App.currentUser;
        const biz = App.store.getList('users').find(x => x.id === bd.bizId);
        const cfg = App.getCategoryConfig(biz || App.currentUser);
        const bizAddress = (biz && biz.address) || bd.bizAddress || '';
        const prepaymentRate = App.appointments && typeof App.appointments.getPrepaymentRate === 'function'
            ? App.appointments.getPrepaymentRate()
            : 0.4;
        const prepaymentPercent = Math.round(prepaymentRate * 100);
        const totalPrice = Number(bd.servicePrice) || 0;
        const prepaymentAmount = Math.round(totalPrice * prepaymentRate);
        const prepaymentPhone = App.appointments && typeof App.appointments.getPrepaymentPhone === 'function'
            ? App.appointments.getPrepaymentPhone()
            : '6454-2137';
        const whatsappText = `Hola, adjunto comprobante del adelanto de mi cita para ${bd.serviceName || 'el servicio'} el ${bd.date || ''} a las ${bd.time || ''}.`;
        const whatsappLink = App.appointments && typeof App.appointments.getPrepaymentWhatsAppLink === 'function'
            ? App.appointments.getPrepaymentWhatsAppLink(whatsappText)
            : '';

        let html = '<h3 class="booking-section-title">Confirma tu reserva</h3>';
        html += '<div class="booking-summary-card">';
        html += `<div class="summary-row"><span><i class="fas ${cfg.businessIcon}"></i> Negocio</span><span>${bd.bizName || '-'}</span></div>`;
        html += `<div class="summary-row"><span><i class="fas fa-map-marker-alt"></i> Direccion</span><span>${bizAddress || 'No especificada'}</span></div>`;
        html += `<div class="summary-row"><span><i class="fas ${cfg.serviceIcon}"></i> Servicio</span><span>${bd.serviceName || '-'}</span></div>`;
        html += `<div class="summary-row"><span><i class="fas ${cfg.employeeIcon}"></i> ${cfg.employeeLabel}</span><span>${bd.empName || '-'}</span></div>`;
        html += `<div class="summary-row"><span><i class="fas fa-calendar"></i> Fecha</span><span>${bd.date ? App.formatDate(bd.date) : '-'}</span></div>`;
        html += `<div class="summary-row"><span><i class="fas fa-clock"></i> Hora</span><span>${bd.time ? App.formatTime(bd.time) : '-'}</span></div>`;
        html += `<div class="summary-row total"><span><i class="fas fa-tag"></i> Total</span><span>${App.formatCurrency(bd.servicePrice)}</span></div>`;
        html += `<div class="summary-row"><span><i class="fas fa-money-bill-wave"></i> Adelanto (${prepaymentPercent}%)</span><span>${App.formatCurrency(prepaymentAmount)}</span></div>`;
        html += '</div>';
        html += `<div style="margin-top:16px;background:#fffbeb;border:1px solid #facc15;border-radius:10px;padding:14px">
            <p style="margin:0 0 8px;color:#854d0e;font-weight:600"><i class="fas fa-shield-alt"></i> Reserva sujeta a adelanto</p>
            <p style="margin:0 0 8px;color:#854d0e;font-size:0.92rem">Para asegurar tu espacio debes pagar ${App.formatCurrency(prepaymentAmount)} (${prepaymentPercent}% del servicio) por SINPE Movil al ${prepaymentPhone} y enviar el comprobante por WhatsApp. El negocio confirmara tu cita cuando valide ese comprobante.</p>
            ${whatsappLink ? `<a href="${whatsappLink}" target="_blank" rel="noopener" class="btn btn-sm btn-outline"><i class="fab fa-whatsapp"></i> Enviar comprobante por WhatsApp</a>` : ''}
        </div>`;

        // Notes field
        html += `<div class="input-group" style="margin-top:16px">
            <label><i class="fas fa-sticky-note"></i> Notas para el profesional (opcional)</label>
            <textarea id="client-booking-notes" class="form-input" rows="3" placeholder="Ej: Soy alérgico al alcohol, quiero el corte tipo fade, etc...">${bd.notes || ''}</textarea>
        </div>`;

        html += `<div class="booking-client-info">
            <p><strong>Datos de contacto:</strong></p>
            <p><i class="fas fa-user"></i> ${u.name}</p>
            <p><i class="fas fa-envelope"></i> ${u.email}</p>
        </div>`;

        return html;
    },

    _confirmBooking() {
        const bd = App.clientBookingData;
        const u = App.currentUser;
        const notes = document.getElementById('client-booking-notes') ? document.getElementById('client-booking-notes').value.trim() : '';
        const insideWindow = App.appointments && typeof App.appointments.isWithinBookingWindow === 'function'
            ? App.appointments.isWithinBookingWindow(bd.date, bd.time, bd.bizId)
            : true;
        if (!insideWindow) {
            App.toast.show('La cita seleccionada no cumple la ventana de anticipacion permitida.', 'warning');
            App.clientBookingStep = 4;
            this._renderBookingStep(document.getElementById('client-booking-content'));
            return;
        }
        const clientLimit = App.appointments && typeof App.appointments.getClientDailyAvailability === 'function'
            ? App.appointments.getClientDailyAvailability({
                bizId: bd.bizId,
                date: bd.date,
                clientEmail: u.email,
                clientPhone: u.phone || '',
                clientName: u.name
            })
            : { allowed: true, limit: 1 };
        if (!clientLimit.allowed) {
            App.toast.show(`Solo puedes agendar ${clientLimit.limit} cita por dia.`, 'warning');
            App.clientBookingStep = 4;
            this._renderBookingStep(document.getElementById('client-booking-content'));
            return;
        }
        const duration = Number(bd.serviceDuration) || 30;
        const slots = App.appointments && typeof App.appointments._getAvailableSlots === 'function'
            ? App.appointments._getAvailableSlots(bd.date, bd.empId, duration, null, bd.bizId, { useTeamCapacity: true })
            : [];
        if (!slots.includes(bd.time)) {
            App.toast.show('La disponibilidad cambió. Selecciona otra hora.', 'warning');
            App.clientBookingStep = 4;
            this._renderBookingStep(document.getElementById('client-booking-content'));
            return;
        }
        const assignment = App.appointments && typeof App.appointments.resolveBookingEmployee === 'function'
            ? App.appointments.resolveBookingEmployee(bd.date, bd.time, duration, bd.bizId, bd.empId, null)
            : { id: bd.empId, name: bd.empName };
        if (!assignment || !assignment.id) {
            App.toast.show('Ya no hay profesionales disponibles en esa hora. Elige otro horario.', 'warning');
            App.clientBookingStep = 4;
            this._renderBookingStep(document.getElementById('client-booking-content'));
            return;
        }
        if (bd.empId && assignment.id !== bd.empId) {
            App.toast.show(`Te asignamos con ${assignment.name} para esa hora.`, 'info');
        }
        const prepaymentRate = App.appointments && typeof App.appointments.getPrepaymentRate === 'function'
            ? App.appointments.getPrepaymentRate()
            : 0.4;
        const prepaymentPercent = Math.round(prepaymentRate * 100);
        const prepaymentAmount = Math.round((Number(bd.servicePrice) || 0) * prepaymentRate);
        const prepaymentPhone = App.appointments && typeof App.appointments.getPrepaymentPhone === 'function'
            ? App.appointments.getPrepaymentPhone()
            : '6454-2137';

        // Auto-register client in the business's client list
        const clientsKey = bd.bizId + '_clients';
        const clients = App.store.getList(clientsKey);
        let client = clients.find(c => c.email === u.email);
        if (!client) {
            client = App.store.addToList(clientsKey, {
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                visits: 0,
                notes: notes ? 'Nota del cliente: ' + notes : ''
            });
        }

        // Increment visit count
        App.store.updateInList(clientsKey, client.id, { visits: (client.visits || 0) + 1, lastVisit: bd.date });

        // Create the appointment
        const appointmentObj = {
            clientId: client.id,
            clientName: u.name,
            clientEmail: u.email,
            clientPhone: u.phone || '',
            serviceId: bd.serviceId,
            serviceName: bd.serviceName,
            employeeId: assignment.id,
            employeeName: assignment.name,
            date: bd.date,
            time: bd.time,
            duration: Number(bd.serviceDuration) || 30,
            price: bd.servicePrice,
            status: 'pending',
            notes: notes,
            source: 'client-app',
            prepaymentRequired: true,
            prepaymentRate: prepaymentRate,
            prepaymentAmount: prepaymentAmount,
            prepaymentStatus: 'pending',
            prepaymentRequestedAt: new Date().toISOString(),
            prepaymentMethod: 'SINPE_MOVIL',
            prepaymentPhone: prepaymentPhone,
            prepaymentReceiptChannel: 'whatsapp',
            prepaymentReceiptPhone: prepaymentPhone
        };
        const savedAppt = App.store.addToList(bd.bizId + '_appointments', appointmentObj);

        // Resolve the business user object for notifications
        const biz = App.store.getList('users').find(x => x.id === bd.bizId);

        // In-app notification for the business owner
        if (App.inAppNotifications) {
            App.inAppNotifications.add(bd.bizId, {
                type: 'new_booking',
                clientName: u.name || '',
                clientEmail: u.email || '',
                appointmentDate: bd.date || '',
                appointmentTime: bd.time || '',
                serviceName: bd.serviceName || '',
                employeeName: assignment.name || ''
            });
        }

        // Email notification to the business owner
        if (App.notifications && typeof App.notifications.sendAppointmentNotification === 'function') {
            App.notifications.sendAppointmentNotification({
                appointment: savedAppt || appointmentObj,
                business: biz
            }).catch(console.error); // Async fire-and-forget
        }

        const prepaymentLabel = prepaymentAmount > 0
            ? App.formatCurrency(prepaymentAmount)
            : `${prepaymentPercent}% del servicio`;
        App.toast.show(
            `Reserva creada. Envia el adelanto de ${prepaymentLabel} por SINPE al ${prepaymentPhone} y manda el comprobante por WhatsApp para confirmar tu cita.`,
            'warning'
        );

        // Reset booking
        App.clientBookingStep = 1;
        App.clientBookingData = {};
        App.clientBookingMonth = new Date();

        // Go back to client dashboard
        setTimeout(() => App.navigate('client-dashboard'), 1500);
    },

    // -- History view --
    renderHistory() {
        const container = document.getElementById('client-history-content');
        const allAppts = this._getAllAppointments();
        const completed = allAppts.filter(a => a.status === 'completed');
        completed.sort((a, b) => b.date.localeCompare(a.date));

        if (completed.length === 0) {
            container.innerHTML = '<div class="empty-state animate-fade-in"><i class="fas fa-history"></i><p>No tienes visitas anteriores</p></div>';
            return;
        }

        container.innerHTML = '<div class="history-list">' + completed.map((a, i) => {
            const biz = App.store.getList('users').find(x => x.id === a._bizId);
            const cfg = App.getCategoryConfig(biz || App.currentUser);
            return `
            <div class="history-card animate-fade-up" style="animation-delay:${i * 0.06}s">
                <div class="history-date"><i class="fas fa-calendar"></i> ${App.formatDate(a.date)} - ${App.formatTime(a.time)}</div>
                <div class="history-details">
                    <span><i class="fas ${cfg.serviceIcon}"></i> ${a.serviceName || '-'}</span>
                    <span><i class="fas ${cfg.employeeIcon}"></i> ${a.employeeName || '-'}</span>
                    <span><i class="fas ${cfg.businessIcon}"></i> ${a._business || '-'}</span>
                    <span class="history-price">${App.formatCurrency(a.price)}</span>
                </div>
            </div>`;
        }).join('') + '</div>';
    },

    showBooking() {
        App.clientBookingStep = 1;
        App.clientBookingData = {};
        App.clientBookingMonth = new Date();
        App.navigate('client-booking');
    }
};
