/* ============================================
   ReservaHub - Calendar Module
   ============================================ */

App.calendar = {
    prev() {
        App.calendarWeekOffset = (App.calendarWeekOffset || 0) - 1;
        this.render();
    },

    next() {
        App.calendarWeekOffset = (App.calendarWeekOffset || 0) + 1;
        this.render();
    },

    goToday() {
        App.calendarWeekOffset = 0;
        this.render();
    },

    selectCompactDay(index) {
        App.calendarCompactDayIndex = Number(index) || 0;
        this.render();
    },

    render() {
        const grid = document.getElementById('calendar-grid');
        const wrapper = document.querySelector('.calendar-grid-wrapper');
        if (!grid) return;
        this._ensureResponsiveBinding();

        try {
            this._syncEmployeeFilter();

            const filterEl = document.getElementById('calendar-employee-filter');
            const employeeFilter = filterEl ? filterEl.value : 'all';

            const weekDays = this._getWeekDays(App.calendarWeekOffset || 0);
            const appointments = this._safeList(App.store.getList(App.getBusinessKey('appointments')))
                .filter(a => a.status !== 'cancelled' && (employeeFilter === 'all' || a.employeeId === employeeFilter));
            const dayCapacity = {};
            weekDays.forEach(day => {
                dayCapacity[day.dateStr] = this._getDayCapacity(day.dateStr);
            });

            const title = document.getElementById('calendar-title');
            if (title && weekDays.length >= 7) title.textContent = this._formatRangeTitle(weekDays[0].date, weekDays[6].date);

            if (this._isCompactMode()) {
                if (wrapper) wrapper.classList.add('compact-mode');
                this._renderCompactWeek(grid, weekDays, appointments, employeeFilter, dayCapacity);
                return;
            }

            if (wrapper) wrapper.classList.remove('compact-mode');
            grid.classList.remove('calendar-compact', 'phone-mode');

            const hours = this._getHourRange();
            let html = '<div class="cal-header">Hora</div>';
            weekDays.forEach(day => {
                const isToday = this._isToday(day.dateStr);
                const cap = dayCapacity[day.dateStr];
                html += `
                    <div class="cal-header ${isToday ? 'today-header' : ''}">
                        ${day.short}<br><small>${day.display}</small>
                        <span class="cal-capacity-badge ${cap && cap.isFull ? 'full' : 'open'}" title="${cap ? `${cap.booked}/${cap.limit}` : ''}">
                            ${cap ? (cap.isFull ? 'Sin cupo' : `${cap.remaining} libres`) : ''}
                        </span>
                    </div>
                `;
            });

            hours.forEach(h => {
                const timeKey = `${String(h).padStart(2, '0')}:00`;
                html += `<div class="cal-time">${App.formatHour12(h)}</div>`;

                weekDays.forEach(day => {
                    const isLunchSlot = this._isLunchBlockedTime(day.dateStr, timeKey, employeeFilter);
                    const cellEvents = appointments
                        .filter(a => a.date === day.dateStr && Number(String(a.time || '').split(':')[0]) === h)
                        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

                    const eventsHtml = cellEvents.map(a => `
                        <div class="cal-event ${this._statusColor(a.status)}" title="${a.clientName || 'Cliente'} - ${a.serviceName || ''}" onclick="event.stopPropagation();App.appointments.openDetails('${a.id}')">
                            <small>${App.formatTime(a.time)}</small> ${a.clientName || 'Cliente'}
                        </div>
                    `).join('');
                    const lunchLabel = isLunchSlot && !cellEvents.length
                        ? '<div class="cal-lunch-label"><i class="fas fa-utensils"></i> Almuerzo</div>'
                        : '';
                    const cellClass = `cal-cell${isLunchSlot ? ' lunch-blocked' : ''}`;
                    const cellAction = isLunchSlot ? '' : `onclick="App.calendar.createFromCell('${day.dateStr}','${timeKey}')"`;

                    html += `
                        <div class="${cellClass}" ${cellAction}>
                            ${lunchLabel}
                            ${eventsHtml}
                        </div>
                    `;
                });
            });

            grid.innerHTML = html;
        } catch (err) {
            grid.innerHTML = '<div class="empty-text" style="grid-column:1 / -1">No se pudo cargar el calendario. Recarga la pagina.</div>';
            console.error('Calendar render error:', err);
        }
    },

    createFromCell(date, time) {
        const cap = this._getDayCapacity(date);
        if (cap && cap.isFull) {
            App.toast.show(`Sin cupo diario para ${date} (${cap.booked}/${cap.limit})`, 'warning');
            return;
        }
        const filterEl = document.getElementById('calendar-employee-filter');
        const employeeId = filterEl && filterEl.value !== 'all' ? filterEl.value : '';
        if (this._isLunchBlockedTime(date, time, employeeId || 'all')) {
            App.toast.show('Horario bloqueado por almuerzo del equipo', 'warning');
            return;
        }
        App.appointments.showCreate({ date, time, employeeId });
    },

    _syncEmployeeFilter() {
        const filter = document.getElementById('calendar-employee-filter');
        if (!filter) return;

        const employees = this._safeList(App.store.getList(App.getBusinessKey('employees')));
        const current = filter.value || 'all';

        filter.innerHTML = '<option value="all">Todos los profesionales</option>' +
            employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');

        const exists = employees.some(e => e.id === current);
        filter.value = current === 'all' || exists ? current : 'all';
    },

    _getWeekDays(offset) {
        const today = App.getCRDate();
        today.setHours(0, 0, 0, 0);
        const mondayOffset = (today.getDay() + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - mondayOffset + (offset * 7));

        const dayNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
        const days = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push({
                date: d,
                dateStr: d.toISOString().slice(0, 10),
                short: dayNames[i],
                display: d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
            });
        }

        return days;
    },

    _formatRangeTitle(startDate, endDate) {
        const start = startDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        const end = endDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        return `Semana ${start} - ${end}`;
    },

    _getHourRange() {
        if (!App.currentUser || !App.currentUser.id) return this._buildHourArray(9, 18);
        const schedule = this._safeList(App.store.get(App.currentUser.id + '_schedule') || []);
        const openDays = schedule.filter(s => s && s.open !== false && s.start && s.end);
        if (!openDays.length) return this._buildHourArray(9, 18);

        let minHour = 23;
        let maxHour = 0;
        openDays.forEach(s => {
            minHour = Math.min(minHour, Number(String(s.start).split(':')[0] || 9));
            maxHour = Math.max(maxHour, Number(String(s.end).split(':')[0] || 18));
        });

        if (!Number.isFinite(minHour) || !Number.isFinite(maxHour) || maxHour <= minHour) return this._buildHourArray(9, 18);
        minHour = Math.max(6, minHour);
        maxHour = Math.min(22, maxHour);

        return this._buildHourArray(minHour, maxHour);
    },

    _buildHourArray(start, end) {
        const out = [];
        for (let h = start; h < end; h++) out.push(h);
        return out;
    },

    _statusColor(status) {
        if (status === 'confirmed') return 'green';
        if (status === 'completed') return 'blue';
        return 'orange';
    },

    _isToday(dateStr) {
        return dateStr === App.getCRDateString();
    },

    _isCompactMode() {
        return window.matchMedia('(max-width: 1024px)').matches;
    },

    _isPhoneMode() {
        return window.matchMedia('(max-width: 700px)').matches;
    },

    _renderCompactWeek(grid, weekDays, appointments, employeeFilter, dayCapacity) {
        if (this._isPhoneMode()) {
            this._renderPhoneWeek(grid, weekDays, appointments, employeeFilter, dayCapacity);
            return;
        }

        grid.classList.add('calendar-compact');
        grid.classList.remove('phone-mode');

        const employeeName = employeeFilter === 'all'
            ? 'Todo el equipo'
            : (App.store.getList(App.getBusinessKey('employees')).find(e => e.id === employeeFilter)?.name || 'Profesional');

        grid.innerHTML = weekDays.map(day => {
            const isToday = this._isToday(day.dateStr);
            const cap = dayCapacity ? dayCapacity[day.dateStr] : null;
            const dayItems = appointments
                .filter(a => a.date === day.dateStr)
                .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
            const lunchWindow = this._getLunchWindowForDate(day.dateStr, employeeFilter);

            const itemsHtml = dayItems.length
                ? dayItems.map(a => `
                    <article class="cal-day-item ${this._statusColor(a.status)}" onclick="App.appointments.openDetails('${a.id}')">
                        <div class="cal-day-time">${App.formatTime(a.time)}</div>
                        <div class="cal-day-main">
                            <strong>${a.clientName || 'Cliente'}</strong>
                            <small>${a.serviceName || 'Servicio'}${employeeFilter === 'all' ? ` - ${a.employeeName || 'Profesional'}` : ''}</small>
                        </div>
                        <span class="badge badge-${a.status}">${App.dashboard.statusLabel(a.status)}</span>
                    </article>
                `).join('')
                : '<p class="cal-day-empty">Sin citas para este dia</p>';

            return `
                <section class="cal-day-card ${isToday ? 'today' : ''}">
                    <div class="cal-day-header">
                        <div>
                            <h4>${day.short} ${day.display}</h4>
                            <p>${employeeName}</p>
                            ${lunchWindow ? `<p class="cal-day-lunch"><i class="fas fa-utensils"></i> Bloqueado por almuerzo ${App.formatTime(lunchWindow.startStr)} - ${App.formatTime(lunchWindow.endStr)}</p>` : ''}
                            <span class="cal-capacity-pill ${cap && cap.isFull ? 'full' : 'open'}">
                                ${cap ? `${cap.booked}/${cap.limit} ${cap.isFull ? 'sin cupo' : `(${cap.remaining} libres)`}` : ''}
                            </span>
                        </div>
                        <button class="btn btn-sm btn-outline ripple-btn" ${cap && cap.isFull ? 'disabled' : ''} onclick="App.calendar.createFromCell('${day.dateStr}','09:00')">
                            <i class="fas fa-plus"></i> Cita
                        </button>
                    </div>
                    <div class="cal-day-list">
                        ${itemsHtml}
                    </div>
                </section>
            `;
        }).join('');
        App.ui.initRipple();
    },

    _renderPhoneWeek(grid, weekDays, appointments, employeeFilter, dayCapacity) {
        grid.classList.add('calendar-compact', 'phone-mode');

        const idx = this._normalizeCompactDayIndex(weekDays);
        const selectedDay = weekDays[idx];
        const selectedCapacity = dayCapacity ? dayCapacity[selectedDay.dateStr] : null;
        const monthLabel = selectedDay.date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        const employeeName = employeeFilter === 'all'
            ? 'Todo el equipo'
            : (App.store.getList(App.getBusinessKey('employees')).find(e => e.id === employeeFilter)?.name || 'Profesional');

        const services = App.store.getList(App.getBusinessKey('services'));
        const durationMap = {};
        services.forEach(s => { durationMap[s.id] = Number(s.duration) || 30; });

        const dayItems = appointments
            .filter(a => a.date === selectedDay.dateStr)
            .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));

        const range = this._getDayWindow(selectedDay.dateStr, employeeFilter);
        const startHour = range ? range.startHour : 9;
        const endHour = range ? range.endHour : 18;
        const lunchWindow = this._getLunchWindowForDate(selectedDay.dateStr, employeeFilter);

        let timelineHtml = '';
        if (selectedCapacity && selectedCapacity.isFull) {
            timelineHtml = `<p class="cal-phone-empty">Cupo diario completo (${selectedCapacity.booked}/${selectedCapacity.limit})</p>`;
        } else if (!range) {
            timelineHtml = '<p class="cal-phone-empty">Sin horario disponible para este dia</p>';
        } else {
            for (let h = startHour; h < endHour; h++) {
                const slot = `${String(h).padStart(2, '0')}:00`;
                const isLunchSlot = this._isLunchBlockedTime(selectedDay.dateStr, slot, employeeFilter);
                const byHour = dayItems.filter(a => Number(String(a.time || '').split(':')[0]) === h);
                const cards = byHour.map(a => {
                    const duration = Number(a.duration) || durationMap[a.serviceId] || 30;
                    const end = this._minutesToTime(this._toMinutes(a.time) + duration);
                    return `
                        <article class="cal-phone-event ${this._statusColor(a.status)}" onclick="App.appointments.openDetails('${a.id}')">
                            <small>${App.formatTime(a.time)} - ${App.formatTime(end)}</small>
                            <strong>${a.clientName || 'Cliente'}</strong>
                            <p>${a.serviceName || 'Servicio'}</p>
                        </article>
                    `;
                }).join('');
                const line = isLunchSlot
                    ? '<div class="cal-phone-line blocked"><span>Almuerzo</span></div>'
                    : '<div class="cal-phone-line"></div>';
                const rowAction = byHour.length || isLunchSlot ? '' : `onclick="App.calendar.createFromCell('${selectedDay.dateStr}','${slot}')"`;

                timelineHtml += `
                    <div class="cal-phone-row ${isLunchSlot ? 'lunch-blocked' : ''}" ${rowAction}>
                        <span class="cal-phone-hour">${App.formatTime(slot)}</span>
                        <div class="cal-phone-row-main">
                            ${cards || line}
                        </div>
                    </div>
                `;
            }
        }

        grid.innerHTML = `
            <section class="cal-phone-shell">
                <div class="cal-phone-topbar">
                    <i class="fas fa-sliders-h"></i>
                    <span>${monthLabel}</span>
                    <i class="far fa-calendar-alt"></i>
                </div>
                <div class="cal-phone-weekstrip">
                    ${weekDays.map((d, i) => `
                        <button class="cal-phone-day ${i === idx ? 'active' : ''}" onclick="App.calendar.selectCompactDay(${i})">
                            <small>${d.short}</small>
                            <strong>${d.date.getDate()}</strong>
                        </button>
                    `).join('')}
                </div>
                <div class="cal-phone-employee">
                    <div class="cal-phone-avatar">${employeeName.charAt(0).toUpperCase()}</div>
                    <div class="cal-phone-employee-meta">
                        <span>${employeeName}</span>
                        ${lunchWindow ? `<small class="cal-phone-lunch"><i class="fas fa-utensils"></i> Almuerzo ${App.formatTime(lunchWindow.startStr)} - ${App.formatTime(lunchWindow.endStr)}</small>` : ''}
                        <small class="cal-capacity-pill ${selectedCapacity && selectedCapacity.isFull ? 'full' : 'open'}">
                            ${selectedCapacity ? (selectedCapacity.isFull ? 'Sin cupo' : `${selectedCapacity.remaining} libres`) : ''}
                        </small>
                    </div>
                </div>
                <div class="cal-phone-timeline">
                    ${timelineHtml}
                </div>
                <button class="cal-phone-fab" ${selectedCapacity && selectedCapacity.isFull ? 'disabled' : ''} onclick="App.calendar.createFromCell('${selectedDay.dateStr}','${String(startHour).padStart(2, '0')}:00')">
                    <i class="fas fa-plus"></i>
                </button>
            </section>
        `;

        App.ui.initRipple();
    },

    _normalizeCompactDayIndex(weekDays) {
        const todayIndex = weekDays.findIndex(d => this._isToday(d.dateStr));
        let idx = Number(App.calendarCompactDayIndex);
        if (!Number.isFinite(idx) || idx < 0 || idx > 6) {
            idx = todayIndex >= 0 ? todayIndex : 0;
        }
        App.calendarCompactDayIndex = idx;
        return idx;
    },

    _getDayWindow(dateStr, employeeFilter) {
        const dateObj = new Date(dateStr + 'T00:00:00');
        const jsDay = dateObj.getDay();
        const dayIdx = jsDay === 0 ? 6 : jsDay - 1;

        const businessSchedule = this._safeList(App.store.get(App.currentUser.id + '_schedule') || []);
        const bizDay = businessSchedule[dayIdx];
        if (!bizDay || bizDay.open === false) return null;

        let startHour = Number(String(bizDay.start || '09:00').split(':')[0]);
        let endHour = Number(String(bizDay.end || '18:00').split(':')[0]);
        if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
            startHour = 9;
            endHour = 18;
        }

        if (employeeFilter && employeeFilter !== 'all' && App.employees && typeof App.employees.getScheduleFor === 'function') {
            const empDay = App.employees.getScheduleFor(employeeFilter, dateStr);
            if (!empDay) return null;
            const empOpen = empDay.available !== undefined ? empDay.available : empDay.open;
            if (empOpen === false) return null;
            const eStart = Number(String(empDay.start || '09:00').split(':')[0]);
            const eEnd = Number(String(empDay.end || '18:00').split(':')[0]);
            if (Number.isFinite(eStart)) startHour = Math.max(startHour, eStart);
            if (Number.isFinite(eEnd)) endHour = Math.min(endHour, eEnd);
        }

        if (endHour <= startHour) return null;
        return { startHour, endHour };
    },

    _getDayCapacity(dateStr) {
        if (!App.appointments || typeof App.appointments.getDailyAvailability !== 'function') return null;
        return App.appointments.getDailyAvailability(dateStr, null, App.currentUser && App.currentUser.id ? App.currentUser.id : null);
    },

    _getLunchConfig() {
        if (!App.currentUser || !App.currentUser.id) return null;
        const raw = App.store.get(App.currentUser.id + '_lunch_break');
        if (!raw || !raw.enabled) return null;
        const [h, m] = String(raw.start || '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        const start = (h * 60) + m;
        const end = start + 60;
        return { start, end };
    },

    _getLunchWindowForDate(dateStr, employeeFilter = 'all') {
        const lunch = this._getLunchConfig();
        if (!lunch) return null;
        const dayWindow = this._getDayWindow(dateStr, employeeFilter || 'all');
        if (!dayWindow) return null;
        const dayStart = dayWindow.startHour * 60;
        const dayEnd = dayWindow.endHour * 60;
        const start = Math.max(dayStart, lunch.start);
        const end = Math.min(dayEnd, lunch.end);
        if (end <= start) return null;
        return {
            start,
            end,
            startStr: this._minutesToTime(start),
            endStr: this._minutesToTime(end)
        };
    },

    _isLunchBlockedTime(dateStr, time, employeeFilter = 'all') {
        const lunch = this._getLunchWindowForDate(dateStr, employeeFilter || 'all');
        if (!lunch) return false;
        const minute = this._toMinutes(time);
        return minute >= lunch.start && minute < lunch.end;
    },

    _toMinutes(time) {
        const [h, m] = String(time || '00:00').split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    },

    _minutesToTime(totalMinutes) {
        const value = Math.max(0, totalMinutes);
        const h = Math.floor(value / 60) % 24;
        const m = value % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    _safeList(value) {
        return Array.isArray(value) ? value.filter(v => v && typeof v === 'object') : [];
    },

    _ensureResponsiveBinding() {
        if (this._resizeBound) return;
        this._resizeBound = true;
        let timer = null;
        window.addEventListener('resize', () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (App.currentSection === 'calendar') this.render();
            }, 120);
        });
    }
};
