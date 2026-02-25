/* ============================================
   ReservaHub - Appointments Module
   ============================================ */

App.appointments = {
    showCreate(prefill = {}) {
        this._openForm('Nueva Cita', {
            clientId: '',
            clientName: '',
            clientEmail: '',
            clientPhone: '',
            serviceId: '',
            employeeId: prefill.employeeId || '',
            date: prefill.date || this._suggestDate(prefill.employeeId || ''),
            time: prefill.time || '',
            status: 'pending',
            notes: ''
        }, null);
    },

    showEdit(id) {
        const appt = App.store.getList(App.getBusinessKey('appointments')).find(a => a.id === id);
        if (!appt) {
            App.toast.show('No se encontro la cita', 'error');
            return;
        }
        this._openForm('Editar Cita', {
            clientId: appt.clientId || '',
            clientName: appt.clientName || '',
            clientEmail: appt.clientEmail || '',
            clientPhone: appt.clientPhone || '',
            serviceId: appt.serviceId || '',
            employeeId: appt.employeeId || '',
            date: appt.date || '',
            time: appt.time || '',
            status: appt.status || 'pending',
            notes: appt.notes || ''
        }, id);
    },

    _openForm(title, data, editId) {
        this._activeEditId = editId || null;
        const services = App.store.getList(App.getBusinessKey('services'));
        const employees = App.store.getList(App.getBusinessKey('employees'));
        const clients = App.store.getList(App.getBusinessKey('clients'));

        if (!services.length) {
            App.toast.show('Debes crear al menos un servicio', 'warning');
            return;
        }
        if (!employees.length) {
            App.toast.show('Debes crear al menos un profesional', 'warning');
            return;
        }

        const body = `
            <form id="appointment-form" onsubmit="return App.appointments.save(event, '${editId || ''}')">
                <div class="input-group">
                    <label>Cliente registrado (opcional)</label>
                    <select id="appt-client-id" class="select-input" onchange="App.appointments.fillClientFromSelect()">
                        <option value="">Cliente nuevo</option>
                        ${clients.map(c => `<option value="${c.id}" ${data.clientId === c.id ? 'selected' : ''}>${c.name} ${c.email ? '(' + c.email + ')' : ''}</option>`).join('')}
                    </select>
                </div>

                <div class="input-group">
                    <label>Nombre del cliente</label>
                    <input type="text" id="appt-client-name" class="form-input" required value="${data.clientName || ''}" placeholder="Nombre completo">
                </div>

                <div class="input-group">
                    <label>Email del cliente</label>
                    <input type="email" id="appt-client-email" class="form-input" value="${data.clientEmail || ''}" placeholder="cliente@email.com">
                </div>

                <div class="input-group">
                    <label>Telefono del cliente</label>
                    <input type="tel" id="appt-client-phone" class="form-input" value="${data.clientPhone || ''}" placeholder="+506 XXXX-XXXX">
                </div>

                <div class="input-group">
                    <label>Servicio</label>
                    <select id="appt-service" class="select-input" required onchange="App.appointments.syncPriceAndSlots()">
                        <option value="">Selecciona un servicio</option>
                        ${services.map(s => `<option value="${s.id}" ${data.serviceId === s.id ? 'selected' : ''}>${s.name} (${s.duration} min)</option>`).join('')}
                    </select>
                </div>

                <div class="input-group">
                    <label>Profesional</label>
                    <select id="appt-employee" class="select-input" required onchange="App.appointments.updateTimeSlots()">
                        <option value="">Selecciona un profesional</option>
                        ${employees.map(e => `<option value="${e.id}" ${data.employeeId === e.id ? 'selected' : ''}>${e.name}</option>`).join('')}
                    </select>
                </div>

                <div class="input-group form-grid-two">
                    <div>
                        <label>Fecha</label>
                        <input type="date" id="appt-date" class="form-input" required value="${data.date || ''}" onchange="App.appointments.updateTimeSlots()">
                    </div>
                    <div>
                        <label>Hora</label>
                        <select id="appt-time" class="select-input" required data-initial="${data.time || ''}">
                            <option value="">Selecciona hora</option>
                        </select>
                    </div>
                </div>

                <div class="input-group form-grid-two">
                    <div>
                        <label>Duracion (min)</label>
                        <input type="number" id="appt-duration" class="form-input" readonly>
                    </div>
                    <div>
                        <label>Precio</label>
                        <input type="number" id="appt-price" class="form-input" min="0" step="100">
                    </div>
                </div>

                <div class="input-group">
                    <label>Estado</label>
                    <select id="appt-status" class="select-input">
                        <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                        <option value="confirmed" ${data.status === 'confirmed' ? 'selected' : ''}>Confirmada</option>
                        <option value="completed" ${data.status === 'completed' ? 'selected' : ''}>Completada / Pagada</option>
                        <option value="cancelled" ${data.status === 'cancelled' ? 'selected' : ''}>Cancelada</option>
                    </select>
                </div>

                <div class="input-group">
                    <label>Notas (opcional)</label>
                    <textarea id="appt-notes" class="form-input" rows="3" placeholder="Indicaciones para la cita">${data.notes || ''}</textarea>
                </div>

                <p id="appt-time-hint" style="font-size:0.82rem;color:var(--text-muted);margin-bottom:12px"></p>

                <button type="submit" class="btn btn-primary btn-full ripple-btn">
                    <i class="fas fa-save"></i> ${editId ? 'Actualizar Cita' : 'Guardar Cita'}
                </button>
            </form>
        `;

        App.modal.open(title, body);
        App.ui.initRipple();
        this.syncPriceAndSlots();
        this.updateTimeSlots(editId || null);
    },

    fillClientFromSelect() {
        const id = document.getElementById('appt-client-id').value;
        if (!id) return;
        const clients = App.store.getList(App.getBusinessKey('clients'));
        const c = clients.find(x => x.id === id);
        if (!c) return;
        document.getElementById('appt-client-name').value = c.name || '';
        document.getElementById('appt-client-email').value = c.email || '';
        document.getElementById('appt-client-phone').value = (App.phone && App.phone.format(c.phone)) || '';
    },

    syncPriceAndSlots() {
        const serviceId = document.getElementById('appt-service').value;
        const services = App.store.getList(App.getBusinessKey('services'));
        const svc = services.find(s => s.id === serviceId);
        document.getElementById('appt-duration').value = svc ? (Number(svc.duration) || 30) : 30;
        if (svc && !document.getElementById('appt-price').value) {
            document.getElementById('appt-price').value = Number(svc.price) || 0;
        }
        this.updateTimeSlots();
    },

    updateTimeSlots(ignoreId) {
        if (ignoreId === undefined) ignoreId = this._activeEditId || null;
        const date = document.getElementById('appt-date') ? document.getElementById('appt-date').value : '';
        const employeeId = document.getElementById('appt-employee') ? document.getElementById('appt-employee').value : '';
        const duration = Number(document.getElementById('appt-duration') ? document.getElementById('appt-duration').value : 30) || 30;
        const select = document.getElementById('appt-time');
        const hint = document.getElementById('appt-time-hint');
        if (!select) return;

        const currentValue = select.value || select.dataset.initial || '';
        select.dataset.initial = '';

        if (!date || !employeeId) {
            select.innerHTML = '<option value="">Selecciona fecha y profesional</option>';
            if (hint) hint.textContent = 'Selecciona fecha y profesional para cargar horarios disponibles.';
            return;
        }

        const bookingStatus = this.getBookingDateStatus(date);
        if (bookingStatus.isTooSoon || bookingStatus.isTooFar) {
            select.innerHTML = '<option value="">Sin disponibilidad</option>';
            if (hint) {
                hint.textContent = bookingStatus.isTooSoon
                    ? `Reservas disponibles con minimo ${bookingStatus.minHours} horas de anticipacion.`
                    : `Reservas disponibles hasta ${bookingStatus.maxDays} dias hacia adelante.`;
            }
            return;
        }

        const daily = this.getDailyAvailability(date, ignoreId || null);
        const slots = this._getAvailableSlots(
            date,
            employeeId,
            duration,
            ignoreId || null,
            null,
            { useTeamCapacity: true }
        );

        if (!slots.length) {
            select.innerHTML = '<option value="">Sin disponibilidad</option>';
            if (hint) {
                hint.textContent = daily.isFull
                    ? `Cupo diario completo (${daily.booked}/${daily.limit}).`
                    : 'No hay horarios disponibles en esa fecha para el equipo.';
            }
            return;
        }

        select.innerHTML = '<option value="">Selecciona hora</option>' + slots.map(s => `<option value="${s}">${App.formatTime(s)}</option>`).join('');

        if (currentValue && slots.includes(currentValue)) {
            select.value = currentValue;
        }

        if (hint) {
            hint.textContent = `Disponibles ${slots.length} horarios para el equipo. Cupo diario: ${daily.booked}/${daily.limit}.`;
        }
    },

    save(e, editId) {
        e.preventDefault();

        const serviceId = document.getElementById('appt-service').value;
        const employeeId = document.getElementById('appt-employee').value;
        const date = document.getElementById('appt-date').value;
        const time = document.getElementById('appt-time').value;
        const status = document.getElementById('appt-status').value || 'pending';
        const selectedClientId = document.getElementById('appt-client-id').value || '';
        const clientName = document.getElementById('appt-client-name').value.trim();
        const clientEmail = document.getElementById('appt-client-email').value.trim();
        const clientPhoneInput = document.getElementById('appt-client-phone');
        const clientPhone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(clientPhoneInput ? clientPhoneInput.value : '')
            : (clientPhoneInput ? clientPhoneInput.value.trim() : '');
        if (clientPhoneInput) clientPhoneInput.value = clientPhone;
        if (clientPhone && (!App.phone || !App.phone.isValid(clientPhone))) {
            App.toast.show('El telefono debe usar el formato +506 XXXX-XXXX', 'error');
            return false;
        }

        const services = App.store.getList(App.getBusinessKey('services'));
        const employees = App.store.getList(App.getBusinessKey('employees'));
        const service = services.find(s => s.id === serviceId);
        const employee = employees.find(x => x.id === employeeId);

        if (!service || !employee) {
            App.toast.show('Selecciona servicio y profesional', 'warning');
            return false;
        }

        const perClient = this.getClientDailyAvailability({
            date,
            clientId: selectedClientId,
            clientEmail,
            clientPhone,
            clientName,
            ignoreId: editId || null
        });
        if (status !== 'cancelled' && !perClient.allowed) {
            App.toast.show(`Este cliente ya tiene una cita para ${date}. Límite diario: ${perClient.limit}`, 'warning');
            return false;
        }

        const duration = Number(service.duration) || Number(document.getElementById('appt-duration').value) || 30;
        const bookingDateStatus = this.getBookingDateStatus(date);
        if (status !== 'cancelled' && (bookingDateStatus.isTooSoon || bookingDateStatus.isTooFar)) {
            App.toast.show(
                bookingDateStatus.isTooSoon
                    ? `Esta fecha requiere minimo ${bookingDateStatus.minHours} horas de anticipacion.`
                    : `Solo se permiten reservas hasta ${bookingDateStatus.maxDays} dias hacia adelante.`,
                'error'
            );
            this.updateTimeSlots(editId || null);
            return false;
        }
        const daily = this.getDailyAvailability(date, editId || null);
        if (status !== 'cancelled' && daily.isFull) {
            App.toast.show(`Sin cupo diario para ${date} (${daily.booked}/${daily.limit})`, 'error');
            this.updateTimeSlots(editId || null);
            return false;
        }
        const slots = this._getAvailableSlots(
            date,
            employeeId,
            duration,
            editId || null,
            null,
            { useTeamCapacity: true }
        );
        if (status !== 'cancelled' && (!time || !slots.includes(time))) {
            App.toast.show('La hora seleccionada no esta disponible o no cumple la anticipacion configurada', 'error');
            this.updateTimeSlots(editId || null);
            return false;
        }
        const assignment = this.resolveBookingEmployee(date, time, duration, null, employeeId, editId || null);
        if (status !== 'cancelled' && (!assignment || !assignment.id)) {
            App.toast.show('Ya no hay profesionales disponibles en esa hora. Selecciona otro horario.', 'warning');
            this.updateTimeSlots(editId || null);
            return false;
        }
        if (status !== 'cancelled' && assignment.id !== employee.id) {
            App.toast.show(`Se asigno la cita con ${assignment.name} por disponibilidad del equipo.`, 'info');
        }

        const client = this._upsertClient();
        const payload = {
            clientId: client.id,
            clientName: document.getElementById('appt-client-name').value.trim(),
            clientEmail: document.getElementById('appt-client-email').value.trim(),
            clientPhone,
            serviceId: service.id,
            serviceName: service.name,
            employeeId: (assignment && assignment.id) || employee.id,
            employeeName: (assignment && assignment.name) || employee.name,
            date,
            time,
            duration,
            price: Number(document.getElementById('appt-price').value || service.price || 0),
            status,
            notes: document.getElementById('appt-notes').value.trim(),
            source: editId ? 'manual-edit' : 'manual'
        };

        if (editId) {
            const prev = App.store.getList(App.getBusinessKey('appointments')).find(a => a.id === editId);
            const updated = App.store.updateInList(App.getBusinessKey('appointments'), editId, payload)
                || Object.assign({}, prev || {}, payload, { id: editId });
            if (prev && prev.status !== 'completed' && payload.status === 'completed') this._markClientVisit(client.id, payload.date);
            if ((!prev || prev.status !== 'confirmed') && payload.status === 'confirmed') {
                this._notifyAppointmentConfirmed(updated);
            }
            App.toast.show('Cita actualizada', 'success');
        } else {
            const created = App.store.addToList(App.getBusinessKey('appointments'), payload);
            if (payload.status === 'completed') this._markClientVisit(client.id, payload.date);
            if (payload.status === 'confirmed') {
                this._notifyAppointmentConfirmed(created);
            }
            App.toast.show('Cita creada', 'success');
        }

        App.modal.close();
        this._activeEditId = null;
        this._refreshViews();
        return false;
    },

    openDetails(id) {
        const appt = App.store.getList(App.getBusinessKey('appointments')).find(a => a.id === id);
        if (!appt) return;

        const body = `
            <div style="display:grid;gap:10px">
                <div><strong>Cliente:</strong> ${appt.clientName || '-'}</div>
                <div><strong>Servicio:</strong> ${appt.serviceName || '-'}</div>
                <div><strong>Profesional:</strong> ${appt.employeeName || '-'}</div>
                <div><strong>Fecha:</strong> ${App.formatDate(appt.date)} ${App.formatTime(appt.time)}</div>
                <div><strong>Estado:</strong> ${this.statusLabel(appt.status)}</div>
                <div><strong>Total:</strong> ${App.formatCurrency(appt.price)}</div>
                ${appt.notes ? `<div><strong>Notas:</strong> ${appt.notes}</div>` : ''}
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
                    <button class="btn btn-outline ripple-btn" onclick="App.appointments.showEdit('${appt.id}')"><i class="fas fa-edit"></i> Editar</button>
                    ${appt.status === 'pending' ? `<button class="btn btn-outline ripple-btn" onclick="App.appointments.confirm('${appt.id}')"><i class="fas fa-check"></i> Confirmar</button>` : ''}
                    ${appt.status !== 'completed' && appt.status !== 'cancelled' ? `<button class="btn btn-outline ripple-btn" onclick="App.appointments.complete('${appt.id}')"><i class="fas fa-check-double"></i> Completar</button>` : ''}
                    <button class="btn btn-danger ripple-btn" onclick="App.appointments.cancel('${appt.id}')"><i class="fas fa-times"></i> Cancelar</button>
                </div>
            </div>
        `;

        App.modal.open('Detalle de Cita', body);
        App.ui.initRipple();
    },

    async confirm(id) {
        const key = App.getBusinessKey('appointments');
        const prev = App.store.getList(key).find(a => a.id === id);
        if (!prev) {
            App.toast.show('No se encontro la cita', 'error');
            return;
        }

        const updated = App.store.updateInList(key, id, { status: 'confirmed' })
            || Object.assign({}, prev, { status: 'confirmed' });

        App.toast.show('Cita confirmada', 'success');
        App.modal.close();
        this._refreshViews();

        if (prev.status !== 'confirmed') {
            await this._notifyAppointmentConfirmed(updated);
        }
    },

    complete(id) {
        const appt = App.store.getList(App.getBusinessKey('appointments')).find(a => a.id === id);
        if (!appt) return;
        App.store.updateInList(App.getBusinessKey('appointments'), id, { status: 'completed' });
        if (appt.status !== 'completed' && appt.clientId) this._markClientVisit(appt.clientId, appt.date);
        App.toast.show('Cita completada', 'success');
        App.modal.close();
        this._refreshViews();
    },

    cancel(id) {
        App.confirm.show('Cancelar cita', 'Se marcara la cita como cancelada.', () => {
            App.store.updateInList(App.getBusinessKey('appointments'), id, { status: 'cancelled' });
            App.toast.show('Cita cancelada', 'warning');
            App.modal.close();
            this._refreshViews();
        });
    },

    statusLabel(status) {
        const labels = {
            pending: 'Pendiente',
            confirmed: 'Confirmada',
            completed: 'Completada/Pagada',
            cancelled: 'Cancelada'
        };
        return labels[status] || status;
    },

    async _notifyAppointmentConfirmed(appt) {
        if (!appt || !appt.id || appt.status !== 'confirmed') {
            return { sent: false, reason: 'invalid-appointment' };
        }
        if (appt.confirmationEmailSentAt) {
            return { sent: false, reason: 'already-sent' };
        }
        if (!App.notifications || typeof App.notifications.sendAppointmentConfirmation !== 'function') {
            console.warn('Notifications module is not available.');
            return { sent: false, reason: 'module-missing' };
        }

        const result = await App.notifications.sendAppointmentConfirmation({
            appointment: appt,
            business: App.currentUser
        });

        const key = App.getBusinessKey('appointments');
        const reason = result && result.reason ? String(result.reason) : '';
        const errorMessage = result && result.error ? String(result.error) : '';
        const shortError = errorMessage ? errorMessage.slice(0, 220) : '';

        if (result && result.sent) {
            App.store.updateInList(key, appt.id, {
                confirmationEmailSentAt: result.sentAt || new Date().toISOString(),
                confirmationEmailStatus: 'sent',
                confirmationEmailError: ''
            });
            App.toast.show('Correo de confirmacion enviado al cliente.', 'success');
            return result;
        }

        if (reason === 'missing-client-email' || reason === 'invalid-client-email' || reason === 'invalid-recipient') {
            App.store.updateInList(key, appt.id, {
                confirmationEmailStatus: 'skipped',
                confirmationEmailError: reason
            });
            App.toast.show('La cita se confirmo, pero el cliente no tiene un correo valido.', 'warning');
            return result;
        }

        if (reason && reason !== 'already-sent') {
            App.store.updateInList(key, appt.id, {
                confirmationEmailStatus: 'error',
                confirmationEmailError: errorMessage || reason
            });
        }

        if (reason === 'backend-unavailable' || reason === 'function-missing') {
            App.toast.show('Cita confirmada. Configura la funcion de correo para activar el envio automatico.', 'warning');
            return result;
        }

        if (reason === 'missing-config') {
            App.toast.show('Cita confirmada. Faltan variables de entorno en la funcion (RESEND_API_KEY o NOTIFY_FROM_EMAIL).', 'warning');
            return result;
        }

        if (reason === 'unauthorized' || reason === 'forbidden') {
            App.toast.show('Cita confirmada. La funcion rechazo el envio por permisos/sesion. Vuelve a iniciar sesion y prueba de nuevo.', 'warning');
            return result;
        }

        if (reason === 'provider-error') {
            App.toast.show(`Cita confirmada, pero Resend rechazo el correo: ${shortError || 'Revisa remitente y dominio verificado.'}`, 'warning');
            return result;
        }

        if (reason === 'send-failed') {
            App.toast.show(`Cita confirmada, pero ocurrio un error al enviar: ${shortError || 'Revisa logs de la funcion.'}`, 'warning');
            return result;
        }

        if (reason && reason !== 'already-sent') {
            App.toast.show('Cita confirmada, pero el correo no se pudo enviar.', 'warning');
        }
        return result;
    },

    getDailyLimit(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        const raw = targetBizId ? App.store.get(targetBizId + '_daily_capacity') : null;
        const parsed = Number(raw);
        const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 20;
        if (targetBizId && (!Number.isFinite(parsed) || parsed <= 0)) {
            App.store.set(targetBizId + '_daily_capacity', limit);
        }
        return limit;
    },

    getDailyAvailability(date, ignoreId, bizId) {
        const limit = this.getDailyLimit(bizId);
        const booked = this._countDailyAppointments(date, ignoreId || null, bizId);
        return {
            limit,
            booked,
            remaining: Math.max(limit - booked, 0),
            isFull: booked >= limit
        };
    },

    getClientDailyLimit(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        const raw = targetBizId ? App.store.get(targetBizId + '_client_daily_limit') : null;
        const parsed = Number(raw);
        const limit = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
        if (targetBizId && (!Number.isFinite(parsed) || parsed <= 0)) {
            App.store.set(targetBizId + '_client_daily_limit', limit);
        }
        return limit;
    },

    getClientDailyAvailability(data = {}) {
        const date = String(data.date || '');
        const ignoreId = data.ignoreId || null;
        const limit = this.getClientDailyLimit(data.bizId);
        if (!date) {
            return { limit, used: 0, remaining: limit, allowed: true };
        }

        const criteria = this._buildClientCriteria(data);
        const used = App.store.getList(this._appointmentsKey(data.bizId)).filter(a => {
            if (!a || typeof a !== 'object') return false;
            if (a.date !== date) return false;
            if (a.status === 'cancelled') return false;
            if (a.id === ignoreId) return false;
            return this._matchesClientCriteria(a, criteria);
        }).length;

        return {
            limit,
            used,
            remaining: Math.max(limit - used, 0),
            allowed: used < limit
        };
    },

    getBookingMinHours(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        const raw = targetBizId ? App.store.get(targetBizId + '_booking_min_hours') : null;
        const parsed = Number(raw);
        const hours = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 4;
        if (targetBizId && (!Number.isFinite(parsed) || parsed < 0)) {
            App.store.set(targetBizId + '_booking_min_hours', hours);
        }
        return hours;
    },

    getBookingMaxDays(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        const raw = targetBizId ? App.store.get(targetBizId + '_booking_max_days') : null;
        const parsed = Number(raw);
        const days = Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 30;
        if (targetBizId && (!Number.isFinite(parsed) || parsed < 1)) {
            App.store.set(targetBizId + '_booking_max_days', days);
        }
        return days;
    },

    getBookingPolicy(bizId) {
        const minHours = this.getBookingMinHours(bizId);
        const maxDays = this.getBookingMaxDays(bizId);
        const now = new Date();
        const earliest = new Date(now.getTime() + (minHours * 60 * 60 * 1000));
        const latest = new Date(now);
        latest.setHours(23, 59, 59, 999);
        latest.setDate(latest.getDate() + maxDays);
        return { minHours, maxDays, earliest, latest };
    },

    getBookingDateStatus(date, bizId) {
        const policy = this.getBookingPolicy(bizId);
        const dayStart = this._parseDateTimeLocal(date, '00:00');
        const dayEnd = this._parseDateTimeLocal(date, '23:59');
        if (!dayStart || !dayEnd) {
            return {
                allowed: false,
                isTooSoon: false,
                isTooFar: false,
                minHours: policy.minHours,
                maxDays: policy.maxDays,
                earliestDate: this._toLocalDateIso(policy.earliest),
                latestDate: this._toLocalDateIso(policy.latest)
            };
        }
        const isTooSoon = dayEnd < policy.earliest;
        const isTooFar = dayStart > policy.latest;
        return {
            allowed: !isTooSoon && !isTooFar,
            isTooSoon,
            isTooFar,
            minHours: policy.minHours,
            maxDays: policy.maxDays,
            earliestDate: this._toLocalDateIso(policy.earliest),
            latestDate: this._toLocalDateIso(policy.latest)
        };
    },

    isWithinBookingWindow(date, time, bizId) {
        const policy = this.getBookingPolicy(bizId);
        const slotDateTime = this._parseDateTimeLocal(date, time);
        if (!slotDateTime) return false;
        return slotDateTime >= policy.earliest && slotDateTime <= policy.latest;
    },

    _markClientVisit(clientId, date) {
        const key = App.getBusinessKey('clients');
        const client = App.store.getList(key).find(c => c.id === clientId);
        if (!client) return;
        App.store.updateInList(key, clientId, {
            visits: (Number(client.visits) || 0) + 1,
            lastVisit: date
        });
    },

    _upsertClient() {
        const key = App.getBusinessKey('clients');
        const list = App.store.getList(key);
        const selectId = document.getElementById('appt-client-id').value;
        const name = document.getElementById('appt-client-name').value.trim();
        const email = document.getElementById('appt-client-email').value.trim();
        const phone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(document.getElementById('appt-client-phone').value)
            : document.getElementById('appt-client-phone').value.trim();

        let client = null;
        if (selectId) {
            client = list.find(c => c.id === selectId);
        }
        if (!client && email) client = list.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (!client) client = list.find(c => c.name && c.name.toLowerCase() === name.toLowerCase());

        if (client) {
            App.store.updateInList(key, client.id, { name, email, phone });
            return App.store.getList(key).find(c => c.id === client.id);
        }

        return App.store.addToList(key, {
            name,
            email,
            phone,
            visits: 0,
            notes: ''
        });
    },

    _getAvailableSlots(date, employeeId, duration, ignoreId, bizId, options = {}) {
        if (!date) return [];
        const requestedDuration = Math.max(5, Number(duration) || 30);
        const useTeamCapacity = !!(options && options.useTeamCapacity);
        if (!useTeamCapacity && !employeeId) return [];

        const daily = this.getDailyAvailability(date, ignoreId || null, bizId);
        if (daily.isFull) return [];

        const window = this._getScheduleWindow(date, useTeamCapacity ? '' : employeeId, bizId);
        if (!window) return [];
        const lunch = this._getLunchWindow(bizId);

        const step = 30;
        const slots = [];

        for (let min = window.start; min + requestedDuration <= window.end; min += step) {
            const candidate = this._minutesToTime(min);
            if (!this.isWithinBookingWindow(date, candidate, bizId)) continue;
            if (lunch && this._rangesOverlap(min, min + requestedDuration, lunch.start, lunch.end)) continue;
            if (useTeamCapacity) {
                const assignable = this.getAssignableEmployeesForSlot(
                    date,
                    candidate,
                    requestedDuration,
                    bizId,
                    ignoreId || null,
                    employeeId || ''
                );
                if (assignable.length) slots.push(candidate);
                continue;
            }
            if (!this._hasConflict(date, employeeId, min, min + requestedDuration, ignoreId, bizId)) {
                slots.push(candidate);
            }
        }

        return slots;
    },

    _hasConflict(date, employeeId, startMin, endMin, ignoreId, bizId) {
        if (!employeeId) return false;
        const services = App.store.getList(this._servicesKey(bizId));
        const map = {};
        services.forEach(s => { map[s.id] = Number(s.duration) || 30; });

        const appts = App.store.getList(this._appointmentsKey(bizId)).filter(a =>
            a.date === date &&
            a.employeeId === employeeId &&
            a.status !== 'cancelled' &&
            a.id !== ignoreId
        );

        return appts.some(a => {
            const aStart = this._toMinutes(a.time);
            const aDuration = Number(a.duration) || map[a.serviceId] || 30;
            const aEnd = aStart + aDuration;
            return startMin < aEnd && aStart < endMin;
        });
    },

    getAssignableEmployeesForSlot(date, time, duration, bizId, ignoreId, preferredEmployeeId) {
        if (!date || !time) return [];
        const requestedDuration = Math.max(5, Number(duration) || 30);
        const startMin = this._toMinutes(time);
        const endMin = startMin + requestedDuration;

        const employees = App.store.getList(this._employeesKey(bizId)).filter(emp => emp && emp.id);
        const available = employees.filter(emp => {
            const window = this._getScheduleWindow(date, emp.id, bizId);
            if (!window) return false;
            if (startMin < window.start || endMin > window.end) return false;
            return !this._hasConflict(date, emp.id, startMin, endMin, ignoreId || null, bizId);
        });

        if (!preferredEmployeeId || available.length <= 1) return available;

        return available.slice().sort((a, b) => {
            if (a.id === preferredEmployeeId) return -1;
            if (b.id === preferredEmployeeId) return 1;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });
    },

    resolveBookingEmployee(date, time, duration, bizId, preferredEmployeeId, ignoreId) {
        const available = this.getAssignableEmployeesForSlot(
            date,
            time,
            duration,
            bizId,
            ignoreId || null,
            preferredEmployeeId || ''
        );
        if (!available.length) return null;
        return {
            id: available[0].id,
            name: available[0].name || 'Profesional'
        };
    },

    _getScheduleWindow(date, employeeId, bizId) {
        const dayIdx = this._dayIndex(date);
        const targetBizId = this._resolveBusinessId(bizId);
        const businessSchedule = App.store.get((targetBizId || App.currentUser.id) + '_schedule') || [];
        const bizDay = businessSchedule[dayIdx] || { open: true, start: '09:00', end: '18:00' };
        if (bizDay.open === false) return null;

        let start = this._toMinutes(bizDay.start || '09:00');
        let end = this._toMinutes(bizDay.end || '18:00');

        if (employeeId) {
            let empDay = null;
            if (!bizId && App.employees && typeof App.employees.getScheduleFor === 'function') {
                empDay = App.employees.getScheduleFor(employeeId, date);
            }
            if (!empDay && targetBizId) {
                const rawAvail = App.store.get(targetBizId + '_emp_avail_' + employeeId);
                if (Array.isArray(rawAvail) && rawAvail.length) empDay = rawAvail[dayIdx] || null;
            }
            if (!empDay) return { start, end };
            const empOpen = empDay.available !== undefined ? empDay.available : (empDay.open !== undefined ? empDay.open : true);
            if (empOpen === false) return null;
            start = Math.max(start, this._toMinutes(empDay.start || '09:00'));
            end = Math.min(end, this._toMinutes(empDay.end || '18:00'));
        }

        if (end <= start) return null;
        return { start, end };
    },

    _getLunchWindow(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        if (!targetBizId) return null;
        const raw = App.store.get(targetBizId + '_lunch_break');
        if (!raw || !raw.enabled) return null;

        const parts = String(raw.start || '').split(':').map(Number);
        const h = parts[0];
        const m = parts[1];
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;

        const start = (h * 60) + m;
        return { start, end: start + 60 };
    },

    _rangesOverlap(startA, endA, startB, endB) {
        return startA < endB && startB < endA;
    },

    _resolveBusinessId(bizId) {
        if (bizId) return bizId;
        if (App.currentUser && App.currentUser.id) return App.currentUser.id;
        return '';
    },

    _appointmentsKey(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        if (!targetBizId) return App.getBusinessKey('appointments');
        return App.getBizKey(targetBizId, 'appointments');
    },

    _servicesKey(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        if (!targetBizId) return App.getBusinessKey('services');
        return App.getBizKey(targetBizId, 'services');
    },

    _employeesKey(bizId) {
        const targetBizId = this._resolveBusinessId(bizId);
        if (!targetBizId) return App.getBusinessKey('employees');
        return App.getBizKey(targetBizId, 'employees');
    },

    _buildClientCriteria(data) {
        const clean = value => String(value || '').trim();
        const lower = value => clean(value).toLowerCase();
        const digits = value => clean(value).replace(/\D/g, '');

        return {
            id: clean(data.clientId),
            email: lower(data.clientEmail),
            phone: digits(data.clientPhone),
            name: lower(data.clientName)
        };
    },

    _matchesClientCriteria(appt, criteria) {
        if (!criteria) return false;
        const apptId = String(appt.clientId || '').trim();
        const apptEmail = String(appt.clientEmail || '').trim().toLowerCase();
        const apptPhone = String(appt.clientPhone || '').trim().replace(/\D/g, '');
        const apptName = String(appt.clientName || '').trim().toLowerCase();

        if (criteria.id && apptId && criteria.id === apptId) return true;
        if (criteria.email && apptEmail && criteria.email === apptEmail) return true;
        if (criteria.phone && apptPhone && criteria.phone === apptPhone) return true;
        if (!criteria.email && !criteria.phone && criteria.name && apptName && criteria.name === apptName) return true;
        return false;
    },

    _countDailyAppointments(date, ignoreId, bizId) {
        if (!date) return 0;
        return App.store.getList(this._appointmentsKey(bizId)).filter(a =>
            a.date === date &&
            a.status !== 'cancelled' &&
            a.id !== ignoreId
        ).length;
    },

    _suggestDate(employeeId) {
        const policy = this.getBookingPolicy();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const maxDays = Math.max(0, Number(policy.maxDays) || 0);

        for (let i = 0; i <= maxDays; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateStr = this._toLocalDateIso(d);
            const status = this.getBookingDateStatus(dateStr);
            if (status.isTooSoon || status.isTooFar) continue;
            const window = this._getScheduleWindow(dateStr, employeeId || '');
            if (!window) continue;
            const lunch = this._getLunchWindow();
            if (employeeId) {
                if (this._getAvailableSlots(dateStr, employeeId, 30, null).length) return dateStr;
                continue;
            }
            for (let min = window.start; min + 30 <= window.end; min += 30) {
                const candidate = this._minutesToTime(min);
                if (lunch && this._rangesOverlap(min, min + 30, lunch.start, lunch.end)) continue;
                if (this.isWithinBookingWindow(dateStr, candidate)) return dateStr;
            }
        }
        return this._toLocalDateIso(today);
    },

    _dayIndex(date) {
        const d = new Date(date + 'T00:00:00');
        const jsDay = d.getDay();
        return jsDay === 0 ? 6 : jsDay - 1;
    },

    _parseDateTimeLocal(date, time) {
        const [year, month, day] = String(date || '').split('-').map(Number);
        const [hour, minute] = String(time || '00:00').split(':').map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
        return new Date(year, month - 1, day, hour, minute, 0, 0);
    },

    _toLocalDateIso(date) {
        const value = date instanceof Date ? date : new Date(date);
        if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, '0');
        const d = String(value.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    _toMinutes(time) {
        const [h, m] = String(time || '00:00').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    },

    _minutesToTime(value) {
        const total = Math.max(0, value);
        const h = Math.floor(total / 60) % 24;
        const m = total % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    _refreshViews() {
        if (App.dashboard && typeof App.dashboard.render === 'function') App.dashboard.render();
        if (App.calendar && typeof App.calendar.render === 'function' && App.currentSection === 'calendar') App.calendar.render();
        if (App.clients && typeof App.clients.render === 'function' && App.currentSection === 'clients') App.clients.render();
        if (App.clientView && typeof App.clientView.render === 'function' && App.currentSection === 'client-dashboard') App.clientView.render();
    }
};
