/* ============================================
   ReservaHub - Services Module
   ============================================ */

App.services = {
    render() {
        const services = App.store.getList(App.getBusinessKey('services'));
        const grid = document.getElementById('services-grid');
        const cfg = App.getCategoryConfig(App.currentUser);
        if (services.length === 0) {
            grid.innerHTML = `<div class="empty-state animate-fade-in"><i class="fas ${cfg.serviceIcon}"></i><p>No hay servicios registrados</p><button class="btn btn-primary ripple-btn" onclick="App.services.showCreate()">Agregar Servicio</button></div>`;
            return;
        }
        const icons = App.getServiceIconSet(cfg.key);
        grid.innerHTML = services.map((s, i) => `
            <div class="service-card animate-fade-up" style="animation-delay:${i * 0.08}s">
                <div class="service-icon"><i class="fas ${icons[i % icons.length]}"></i></div>
                <h4>${s.name}</h4>
                <div class="service-meta">
                    <span><i class="fas fa-clock"></i> ${s.duration} min</span>
                </div>
                <div class="service-price">${App.formatCurrency(s.price)}</div>
                ${s.description ? `<p style="margin-top:8px;font-size:0.9rem;color:var(--text-muted)">${s.description}</p>` : ''}
                <div class="card-actions">
                    <button class="btn btn-sm btn-outline ripple-btn" onclick="App.services.showEdit('${s.id}')"><i class="fas fa-edit"></i> Editar</button>
                    <button class="btn btn-sm btn-outline ripple-btn" onclick="App.services.delete('${s.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
        App.ui.initRipple();
    },

    showCreate() {
        App.modal.open('Nuevo Servicio', `
            <form onsubmit="return App.services.save(event)">
                <div class="input-group"><label>Nombre</label><input type="text" id="svc-name" class="form-input" required placeholder="Ej: Corte de cabello"></div>
                <div class="input-group"><label>Duración (minutos)</label><input type="number" id="svc-duration" class="form-input" required value="30" min="5"></div>
                <div class="input-group"><label>Precio (₡)</label><input type="number" id="svc-price" class="form-input" required step="100" min="0" placeholder="4000"></div>
                <div class="input-group"><label>Descripción (opcional)</label><textarea id="svc-desc" class="form-input" rows="2" placeholder="Breve descripción del servicio..."></textarea></div>
                <button type="submit" class="btn btn-primary btn-full ripple-btn"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `);
        App.ui.initRipple();
    },

    showEdit(id) {
        const s = App.store.getList(App.getBusinessKey('services')).find(x => x.id === id);
        if (!s) return;
        App.modal.open('Editar Servicio', `
            <form onsubmit="return App.services.save(event, '${id}')">
                <div class="input-group"><label>Nombre</label><input type="text" id="svc-name" class="form-input" required value="${s.name}"></div>
                <div class="input-group"><label>Duración (minutos)</label><input type="number" id="svc-duration" class="form-input" required value="${s.duration}" min="5"></div>
                <div class="input-group"><label>Precio (₡)</label><input type="number" id="svc-price" class="form-input" required step="100" value="${s.price}"></div>
                <div class="input-group"><label>Descripción</label><textarea id="svc-desc" class="form-input" rows="2">${s.description || ''}</textarea></div>
                <button type="submit" class="btn btn-primary btn-full ripple-btn"><i class="fas fa-save"></i> Actualizar</button>
            </form>
        `);
        App.ui.initRipple();
    },

    save(e, editId) {
        e.preventDefault();
        const data = { name: document.getElementById('svc-name').value.trim(), duration: Number(document.getElementById('svc-duration').value), price: Number(document.getElementById('svc-price').value), description: document.getElementById('svc-desc').value.trim() };
        if (editId) { App.store.updateInList(App.getBusinessKey('services'), editId, data); App.toast.show('Servicio actualizado', 'success'); }
        else { App.store.addToList(App.getBusinessKey('services'), data); App.toast.show('Servicio creado', 'success'); }
        App.modal.close();
        this.render();
        return false;
    },

    delete(id) {
        App.confirm.show('Eliminar Servicio', '¿Estás seguro de eliminar este servicio?', () => {
            App.store.removeFromList(App.getBusinessKey('services'), id);
            App.toast.show('Servicio eliminado', 'warning');
            this.render();
        });
    }
};

/* ============================================
   ReservaHub - Employees Module
   (with per-employee availability scheduling)
   ============================================ */

App.employees = {
    render() {
        const employees = App.store.getList(App.getBusinessKey('employees'));
        const grid = document.getElementById('employees-grid');
        const cfg = App.getCategoryConfig(App.currentUser);
        if (employees.length === 0) {
            grid.innerHTML = `<div class="empty-state animate-fade-in"><i class="fas ${cfg.employeeIcon}"></i><p>No hay ${cfg.employeeLabelPlural.toLowerCase()} registrados</p><button class="btn btn-primary ripple-btn" onclick="App.employees.showCreate()">Agregar ${cfg.employeeLabel}</button></div>`;
            return;
        }
        grid.innerHTML = employees.map((emp, i) => {
            const avail = this.getAvailability(emp.id);
            const activeDays = avail.filter(d => d.available).map(d => d.day.slice(0, 3)).join(', ') || 'No definido';
            return `
            <div class="employee-card animate-fade-up" style="animation-delay:${i * 0.08}s">
                <div class="employee-avatar">${emp.name.charAt(0).toUpperCase()}</div>
                <h4>${emp.name}</h4>
                <p><i class="fas fa-briefcase"></i> ${emp.specialty || 'General'}</p>
                <p><i class="fas fa-envelope"></i> ${emp.email || '-'}</p>
                <p><i class="fas fa-phone"></i> ${(App.phone && App.phone.format(emp.phone)) || '-'}</p>
                <p style="margin-top:4px"><i class="fas fa-calendar-check"></i> <small>${activeDays}</small></p>
                <div class="card-actions">
                    <button class="btn btn-sm btn-outline ripple-btn" onclick="App.employees.showAvailability('${emp.id}')"><i class="fas fa-calendar-alt"></i> Horario</button>
                    <button class="btn btn-sm btn-outline ripple-btn" onclick="App.employees.showEdit('${emp.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-sm btn-outline ripple-btn" onclick="App.employees.delete('${emp.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>`;
        }).join('');
        // Also update calendar filter
        const filter = document.getElementById('calendar-employee-filter');
        if (filter) {
            filter.innerHTML = '<option value="all">Todos los profesionales</option>' + employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        }
        App.ui.initRipple();
    },

    // Get/set availability per employee
    getAvailability(empId) {
        return this.ensureAvailability(empId, true);
    },

    _defaultAvailability() {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const businessSchedule = App.store.get(App.currentUser.id + '_schedule') || [];
        return days.map((day, idx) => {
            const bizDay = businessSchedule[idx] || {};
            const available = bizDay.open !== false && idx < 6;
            return {
                day,
                available,
                start: bizDay.start || '09:00',
                end: bizDay.end || '18:00'
            };
        });
    },

    _normalizeAvailability(raw) {
        const defaults = this._defaultAvailability();
        if (!Array.isArray(raw) || !raw.length) return defaults;

        return defaults.map((base, idx) => {
            const current = raw[idx] || {};
            const available = current.available !== undefined
                ? !!current.available
                : (current.open !== undefined ? !!current.open : base.available);
            return {
                day: base.day,
                available,
                start: current.start || base.start,
                end: current.end || base.end
            };
        });
    },

    ensureAvailability(empId, persist = true) {
        if (!empId) return this._defaultAvailability();
        const key = App.getBusinessKey('emp_avail_' + empId);
        const stored = App.store.get(key);
        const normalized = this._normalizeAvailability(stored);
        if (persist) {
            const same = Array.isArray(stored) && JSON.stringify(stored) === JSON.stringify(normalized);
            if (!same) App.store.set(key, normalized);
        }
        return normalized;
    },

    saveAvailability(empId) {
        const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
        const avail = days.map((d, i) => ({
            day: d,
            available: document.getElementById('emp-avail-' + i).checked,
            start: document.getElementById('emp-avail-start-' + i).value,
            end: document.getElementById('emp-avail-end-' + i).value
        }));
        const key = App.getBusinessKey('emp_avail_' + empId);
        App.store.set(key, avail);
        App.toast.show('Disponibilidad guardada', 'success');
        App.modal.close();
        this.render();
    },

    showAvailability(empId) {
        const emp = App.store.getList(App.getBusinessKey('employees')).find(e => e.id === empId);
        if (!emp) return;
        const avail = this.ensureAvailability(empId, true);

        let html = `<p style="margin-bottom:16px">Configura los días y horarios en los que <strong>${emp.name}</strong> está disponible:</p>`;
        html += avail.map((a, i) => `
            <div class="schedule-row animate-fade-up" style="animation-delay:${i * 0.05}s">
                <label class="day-label">${a.day}</label>
                <select id="emp-avail-start-${i}" class="schedule-time-select" ${!a.available ? 'disabled' : ''}>${App.buildTimeOptions(a.start || '09:00')}</select>
                <span class="schedule-separator">-</span>
                <select id="emp-avail-end-${i}" class="schedule-time-select" ${!a.available ? 'disabled' : ''}>${App.buildTimeOptions(a.end || '18:00')}</select>
                <div class="toggle-switch">
                    <input type="checkbox" id="emp-avail-${i}" ${a.available ? 'checked' : ''} onchange="document.getElementById('emp-avail-start-${i}').disabled=!this.checked;document.getElementById('emp-avail-end-${i}').disabled=!this.checked">
                    <label class="toggle-slider" for="emp-avail-${i}"></label>
                </div>
            </div>
        `).join('');
        html += `<button class="btn btn-primary btn-full ripple-btn" style="margin-top:16px" onclick="App.employees.saveAvailability('${empId}')"><i class="fas fa-save"></i> Guardar Disponibilidad</button>`;
        App.modal.open('Disponibilidad - ' + emp.name, html);
        App.ui.initRipple();
    },

    // Check if employee is available on a specific date
    isAvailableOn(empId, dateStr) {
        const avail = this.getAvailability(empId);
        const dateObj = new Date(dateStr + 'T00:00:00');
        const jsDay = dateObj.getDay(); // 0=Sun
        const dayIdx = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon
        return avail[dayIdx] && avail[dayIdx].available;
    },

    // Get the employee's schedule for a specific date (start/end times)
    getScheduleFor(empId, dateStr) {
        const avail = this.ensureAvailability(empId, true);
        const dateObj = new Date(dateStr + 'T00:00:00');
        const jsDay = dateObj.getDay();
        const dayIdx = jsDay === 0 ? 6 : jsDay - 1;
        return avail[dayIdx] || { available: true, start: '09:00', end: '18:00' };
    },

    showCreate() {
        const cfg = App.getCategoryConfig(App.currentUser);
        App.modal.open(`Nuevo ${cfg.employeeLabel}`, `
            <form onsubmit="return App.employees.save(event)">
                <div class="input-group"><label>Nombre completo</label><input type="text" id="emp-name" class="form-input" required placeholder="Nombre del profesional"></div>
                <div class="input-group"><label>Especialidad</label><input type="text" id="emp-specialty" class="form-input" placeholder="Ej: ${cfg.employeeLabel}, Especialista"></div>
                <div class="input-group"><label>Email</label><input type="email" id="emp-email" class="form-input" placeholder="email@ejemplo.com"></div>
                <div class="input-group"><label>Teléfono</label><input type="tel" id="emp-phone" class="form-input" placeholder="+506 XXXX-XXXX"></div>
                <button type="submit" class="btn btn-primary btn-full ripple-btn"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `);
        App.ui.initRipple();
    },

    showEdit(id) {
        const emp = App.store.getList(App.getBusinessKey('employees')).find(e => e.id === id);
        if (!emp) return;
        const cfg = App.getCategoryConfig(App.currentUser);
        App.modal.open(`Editar ${cfg.employeeLabel}`, `
            <form onsubmit="return App.employees.save(event, '${id}')">
                <div class="input-group"><label>Nombre</label><input type="text" id="emp-name" class="form-input" required value="${emp.name}"></div>
                <div class="input-group"><label>Especialidad</label><input type="text" id="emp-specialty" class="form-input" value="${emp.specialty || ''}"></div>
                <div class="input-group"><label>Email</label><input type="email" id="emp-email" class="form-input" value="${emp.email || ''}"></div>
                <div class="input-group"><label>Teléfono</label><input type="tel" id="emp-phone" class="form-input" value="${emp.phone || ''}"></div>
                <button type="submit" class="btn btn-primary btn-full ripple-btn"><i class="fas fa-save"></i> Actualizar</button>
            </form>
        `);
        App.ui.initRipple();
    },

    save(e, editId) {
        e.preventDefault();
        const phoneInput = document.getElementById('emp-phone');
        const normalizedPhone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(phoneInput ? phoneInput.value : '')
            : (phoneInput ? phoneInput.value.trim() : '');
        if (phoneInput) phoneInput.value = normalizedPhone;
        if (normalizedPhone && (!App.phone || !App.phone.isValid(normalizedPhone))) {
            App.toast.show('El telefono debe usar el formato +506 XXXX-XXXX', 'error');
            return false;
        }
        const data = {
            name: document.getElementById('emp-name').value.trim(),
            specialty: document.getElementById('emp-specialty').value.trim(),
            email: document.getElementById('emp-email').value.trim(),
            phone: normalizedPhone
        };
        if (editId) {
            App.store.updateInList(App.getBusinessKey('employees'), editId, data);
            this.ensureAvailability(editId, true);
            App.toast.show('Empleado actualizado', 'success');
        } else {
            const created = App.store.addToList(App.getBusinessKey('employees'), data);
            this.ensureAvailability(created.id, true);
            App.toast.show('Empleado agregado', 'success');
        }
        App.modal.close();
        this.render();
        return false;
    },

    delete(id) {
        App.confirm.show('Eliminar Empleado', '¿Estás seguro de eliminar este empleado?', () => {
            App.store.removeFromList(App.getBusinessKey('employees'), id);
            App.toast.show('Empleado eliminado', 'warning');
            this.render();
        });
    }
};

