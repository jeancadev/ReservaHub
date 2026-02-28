/* ============================================
   ReservaHub - Notifications Module
   ============================================ */

App.notifications = {
    _emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

    async _extractFunctionInvokeError(error) {
        const fallbackMessage = String(error && error.message ? error.message : '');
        const out = {
            status: 0,
            reason: '',
            error: fallbackMessage
        };

        const context = error && error.context ? error.context : null;
        if (!context) return out;

        const status = Number(context.status);
        if (Number.isFinite(status) && status > 0) out.status = status;

        try {
            if (typeof context.clone === 'function') {
                const cloned = context.clone();
                const body = await cloned.json();
                if (body && typeof body === 'object') {
                    if (body.reason) out.reason = String(body.reason);
                    if (body.error) out.error = String(body.error);
                    else if (body.message) out.error = String(body.message);
                }
            } else if (typeof context.text === 'function') {
                const raw = await context.text();
                if (raw) out.error = String(raw);
            }
        } catch {
            // Keep fallback message.
        }

        if (!out.error) {
            out.error = out.status ? `HTTP ${out.status}` : fallbackMessage;
        }
        return out;
    },

    _safeString(value, maxLength = 250) {
        const text = String(value || '').replace(/\s+/g, ' ').trim();
        if (!maxLength || text.length <= maxLength) return text;
        return text.slice(0, maxLength).trim();
    },

    _toNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    },

    _resolveBusinessProfile(inputBusiness) {
        const business = inputBusiness || App.currentUser || {};
        const users = App.store.getList('users');
        const fromUsers = users.find(u => u && u.id === business.id);
        return fromUsers || business;
    },

    _normalizeCategoryLabel(user) {
        const normalized = typeof App.normalizeBusinessCategory === 'function'
            ? App.normalizeBusinessCategory(user && user.category ? user.category : '')
            : 'barberia';
        if (normalized === 'salon') return 'Salon de belleza';
        if (normalized === 'consultorio') return 'Consultorio';
        return 'Barberia';
    },

    _resolveClientEmail(appointment) {
        const fromAppointment = this._safeString(appointment && appointment.clientEmail ? appointment.clientEmail : '', 254).toLowerCase();
        if (fromAppointment) return fromAppointment;

        if (!appointment || !appointment.clientId) return '';
        const clients = App.store.getList(App.getBusinessKey('clients'));
        const client = clients.find(c => c && c.id === appointment.clientId);
        return this._safeString(client && client.email ? client.email : '', 254).toLowerCase();
    },

    _buildPayload({ appointment, business, clientEmail }) {
        const owner = this._resolveBusinessProfile(business);

        return {
            toEmail: clientEmail,
            toName: this._safeString(appointment && appointment.clientName ? appointment.clientName : 'Cliente', 120),
            appointment: {
                id: this._safeString(appointment && appointment.id ? appointment.id : '', 80),
                date: this._safeString(appointment && appointment.date ? appointment.date : '', 20),
                time: this._safeString(appointment && appointment.time ? appointment.time : '', 10),
                serviceName: this._safeString(appointment && appointment.serviceName ? appointment.serviceName : 'Servicio', 120),
                employeeName: this._safeString(appointment && appointment.employeeName ? appointment.employeeName : 'Por asignar', 120),
                durationMinutes: this._toNumber(appointment && appointment.duration ? appointment.duration : 0, 0),
                price: this._toNumber(appointment && appointment.price ? appointment.price : 0, 0),
                prepaymentRequired: !!(appointment && appointment.prepaymentRequired),
                prepaymentRate: this._toNumber(appointment && appointment.prepaymentRate ? appointment.prepaymentRate : 0, 0),
                prepaymentAmount: this._toNumber(appointment && appointment.prepaymentAmount ? appointment.prepaymentAmount : 0, 0),
                prepaymentStatus: this._safeString(appointment && appointment.prepaymentStatus ? appointment.prepaymentStatus : '', 30),
                prepaymentPhone: this._safeString(appointment && appointment.prepaymentPhone ? appointment.prepaymentPhone : '', 40),
                prepaymentReceiptPhone: this._safeString(appointment && appointment.prepaymentReceiptPhone ? appointment.prepaymentReceiptPhone : '', 40),
                notes: this._safeString(appointment && appointment.notes ? appointment.notes : '', 1500),
                status: this._safeString(appointment && appointment.status ? appointment.status : '', 30)
            },
            business: {
                id: this._safeString(owner && owner.id ? owner.id : '', 80),
                name: this._safeString((owner && (owner.businessName || owner.name)) ? (owner.businessName || owner.name) : 'Negocio', 140),
                category: this._normalizeCategoryLabel(owner),
                phone: this._safeString(owner && owner.phone ? owner.phone : '', 60),
                email: this._safeString(owner && owner.email ? owner.email : '', 254).toLowerCase(),
                address: this._safeString(owner && owner.address ? owner.address : '', 220),
                description: this._safeString(owner && owner.description ? owner.description : '', 600)
            }
        };
    },

    async sendAppointmentConfirmation({ appointment, business } = {}) {
        if (!appointment || !appointment.id) {
            return { sent: false, reason: 'missing-appointment' };
        }

        const clientEmail = this._resolveClientEmail(appointment);
        if (!clientEmail) {
            return { sent: false, reason: 'missing-client-email' };
        }
        if (!this._emailPattern.test(clientEmail)) {
            return { sent: false, reason: 'invalid-client-email' };
        }

        const backendReady = App.backend
            && App.backend.client
            && App.backend.enabled
            && typeof App.backend.isCloudReady === 'function'
            && App.backend.isCloudReady()
            && App.backend.client.functions
            && typeof App.backend.client.functions.invoke === 'function';

        if (!backendReady) {
            return { sent: false, reason: 'backend-unavailable' };
        }

        const payload = this._buildPayload({ appointment, business, clientEmail });
        const invokeOptions = { body: payload };

        try {
            const sessionResult = await App.backend.client.auth.getSession();
            const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
            const token = session && session.access_token ? String(session.access_token) : '';
            if (token) {
                invokeOptions.headers = { Authorization: `Bearer ${token}` };
            }
        } catch {
            // Continue and let Supabase SDK handle auth headers if available.
        }

        try {
            const { data, error } = await App.backend.client.functions.invoke('appointment-confirmation-email', {
                ...invokeOptions
            });

            if (error) {
                const details = await this._extractFunctionInvokeError(error);
                const message = String(details.error || error.message || '');
                const lower = message.toLowerCase();
                let reason = details.reason || 'send-failed';

                if (!details.reason) {
                    if (details.status === 404 || lower.includes('not found') || lower.includes('404')) reason = 'function-missing';
                    else if (details.status === 401) reason = 'unauthorized';
                    else if (details.status === 403) reason = 'forbidden';
                    else if (details.status === 400) reason = 'invalid-recipient';
                    else if (details.status === 502) reason = 'provider-error';
                }

                return { sent: false, reason, error: message };
            }

            if (data && data.sent === false) {
                return {
                    sent: false,
                    reason: data.reason ? String(data.reason) : 'send-failed',
                    error: data.error ? String(data.error) : ''
                };
            }

            return {
                sent: true,
                provider: data && data.provider ? String(data.provider) : 'supabase-edge',
                id: data && data.id ? String(data.id) : '',
                sentAt: new Date().toISOString()
            };
        } catch (err) {
            const details = await this._extractFunctionInvokeError(err);
            const message = String(details.error || (err && err.message ? err.message : err || ''));
            const lower = message.toLowerCase();
            if (details.status === 404 || lower.includes('not found') || lower.includes('404')) {
                return { sent: false, reason: 'function-missing', error: message };
            }
            if (details.status === 401) return { sent: false, reason: 'unauthorized', error: message };
            if (details.status === 403) return { sent: false, reason: 'forbidden', error: message };
            if (details.status === 400) return { sent: false, reason: 'invalid-recipient', error: message };
            if (details.status === 502) return { sent: false, reason: 'provider-error', error: message };
            return { sent: false, reason: details.reason || 'send-failed', error: message };
        }
    },

    async sendAppointmentNotification({ appointment, business } = {}) {
        if (!appointment || !appointment.id) {
            return { sent: false, reason: 'missing-appointment' };
        }

        const backendReady = App.backend
            && App.backend.client
            && App.backend.enabled
            && typeof App.backend.isCloudReady === 'function'
            && App.backend.isCloudReady()
            && App.backend.client.functions
            && typeof App.backend.client.functions.invoke === 'function';

        if (!backendReady) {
            return { sent: false, reason: 'backend-unavailable' };
        }

        let employeeEmail = '';
        if (appointment.employeeId) {
            const owner = this._resolveBusinessProfile(business);
            if (owner && owner.id) {
                const employees = App.store.getList(owner.id + '_employees');
                const emp = employees.find(e => e.id === appointment.employeeId);
                if (emp && emp.email) employeeEmail = emp.email;
            }
        }

        const u = App.currentUser || {};
        const clientEmail = this._resolveClientEmail(appointment) || u.email || '';
        const clientName = appointment.clientName || u.name || 'Cliente';
        const clientPhone = u.role === 'client' ? u.phone : (appointment.clientPhone || '');

        const payload = this._buildPayload({ appointment, business, clientEmail });
        // Add specific notification properties to the payload
        payload.client = {
            email: clientEmail,
            name: clientName,
            phone: clientPhone
        };
        payload.employee = {
            email: employeeEmail
        };

        const invokeOptions = { body: payload };

        try {
            const sessionResult = await App.backend.client.auth.getSession();
            const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
            const token = session && session.access_token ? String(session.access_token) : '';
            if (token) {
                invokeOptions.headers = { Authorization: `Bearer ${token}` };
            }
        } catch {
            // Continue and let Supabase SDK handle auth headers if available.
        }

        try {
            const { data, error } = await App.backend.client.functions.invoke('appointment-notification-email', {
                ...invokeOptions
            });

            if (error) {
                const details = await this._extractFunctionInvokeError(error);
                return { sent: false, error: details.error || error.message };
            }

            if (data && data.sent === false) {
                return { sent: false, error: data.error };
            }

            return { sent: true };
        } catch (err) {
             console.error("Function invocation error:", err);
             return { sent: false, error: err.message || err };
        }
    }
};
