/* ============================================
   ReservaHub - Dashboard Module
   ============================================ */

App.dashboard = {
    render() {
        const appts = App.store.getList(App.getBusinessKey('appointments'));
        const today = new Date().toISOString().slice(0, 10);
        const todayAppts = appts.filter(a => a.date === today && a.status !== 'cancelled');
        const upcomingAppts = appts.filter(a => a.date > today && a.status !== 'cancelled');
        const month = today.slice(0, 7);
        const monthAppts = appts.filter(a => a.date.startsWith(month) && a.status === 'completed');
        const revenue = monthAppts.reduce((s, a) => s + (Number(a.price) || 0), 0);

        // Stats
        this.animateValue('stat-today', todayAppts.length);
        this.animateValue('stat-upcoming', upcomingAppts.length);
        document.getElementById('stat-revenue').textContent = App.formatCurrency(revenue);
        const schedule = App.store.get(App.getBusinessKey('schedule').replace(App.currentUser.id + '_', App.currentUser.id + '_')) || App.store.get(App.currentUser.id + '_schedule') || [];
        const workDays = schedule.filter(d => d.open).length || 6;
        const totalSlots = workDays * 8; // approx 8 slots per day
        const weekAppts = appts.filter(a => { const d = new Date(a.date); const now = new Date(); const diff = (d - now) / 86400000; return diff >= -7 && diff <= 0 && a.status !== 'cancelled'; });
        const occ = totalSlots > 0 ? Math.min(100, Math.round((weekAppts.length / totalSlots) * 100)) : 0;
        document.getElementById('stat-occupancy').textContent = occ + '%';
        const capacityEl = document.getElementById('dashboard-capacity-summary');
        if (capacityEl) {
            const daily = App.appointments && typeof App.appointments.getDailyAvailability === 'function'
                ? App.appointments.getDailyAvailability(today, null, App.currentUser && App.currentUser.id ? App.currentUser.id : null)
                : { booked: todayAppts.length, limit: todayAppts.length, remaining: 0, isFull: true };
            capacityEl.textContent = `Cupos de hoy: ${daily.booked}/${daily.limit} usados (${daily.remaining} libres)`;
            capacityEl.classList.toggle('full', !!daily.isFull);
        }

        // Tab counts
        document.getElementById('tab-today-count').textContent = todayAppts.length;
        document.getElementById('tab-upcoming-count').textContent = upcomingAppts.length;

        // Table
        this.filterAppointments(App.dashboardFilter || 'today');

        // Chart
        this.renderWeeklyChart();

        // Quick summary
        this.renderQuickSummary(upcomingAppts);
    },

    animateValue(id, val) {
        const el = document.getElementById(id);
        let current = 0;
        const step = Math.max(1, Math.ceil(val / 20));
        const timer = setInterval(() => {
            current += step;
            if (current >= val) { current = val; clearInterval(timer); }
            el.textContent = current;
            el.style.animation = 'countUp 0.3s ease both';
        }, 30);
    },

    filterAppointments(filter) {
        App.dashboardFilter = filter;
        document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (filter === 'today' && i === 0) || (filter === 'upcoming' && i === 1)));
        const appts = App.store.getList(App.getBusinessKey('appointments'));
        const today = new Date().toISOString().slice(0, 10);
        const filtered = filter === 'today'
            ? appts.filter(a => a.date === today && a.status !== 'cancelled')
            : appts.filter(a => a.date > today && a.status !== 'cancelled');
        const tbody = document.getElementById('dashboard-appointments-list');
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No hay citas para mostrar</td></tr>';
            return;
        }
        filtered.sort((a, b) => a.time.localeCompare(b.time));
        tbody.innerHTML = filtered.map((a, i) => `
            <tr class="animate-fade-up stagger-${Math.min(i + 1, 5)}">
                <td data-label="Hora"><strong>${App.formatTime(a.time)}</strong></td>
                <td data-label="Cliente">${a.clientName || '-'}</td>
                <td data-label="Servicio">${a.serviceName || '-'}</td>
                <td data-label="Profesional">${a.employeeName || '-'}</td>
                <td data-label="Precio">${App.formatCurrency(a.price)}</td>
                <td data-label="Estado"><span class="badge badge-${a.status}">${this.statusLabel(a.status)}</span></td>
                <td data-label="Acciones">
                    <button class="action-btn edit ripple-btn" title="Editar" onclick="App.appointments.showEdit('${a.id}')"><i class="fas fa-edit"></i></button>
                    ${a.status === 'pending' ? `<button class="action-btn view ripple-btn" title="Confirmar" onclick="App.appointments.confirm('${a.id}')"><i class="fas fa-check"></i></button>` : ''}
                    ${a.status !== 'completed' && a.status !== 'cancelled' ? `<button class="action-btn ripple-btn" title="Completar" onclick="App.appointments.complete('${a.id}')"><i class="fas fa-check-double"></i></button>` : ''}
                    <button class="action-btn delete ripple-btn" title="Cancelar" onclick="App.appointments.cancel('${a.id}')"><i class="fas fa-times"></i></button>
                </td>
            </tr>
        `).join('');
        App.ui.initRipple();
    },

    statusLabel(s) {
        const map = { pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada' };
        return map[s] || s;
    },

    renderWeeklyChart() {
        const ctx = document.getElementById('weekly-chart');
        if (!ctx) return;
        const appts = App.store.getList(App.getBusinessKey('appointments'));
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        const counts = [0, 0, 0, 0, 0, 0, 0];
        appts.forEach(a => {
            if (a.status === 'cancelled') return;
            const d = new Date(a.date + 'T00:00:00');
            const diff = Math.floor((d - startOfWeek) / 86400000);
            if (diff >= 0 && diff < 7) counts[diff]++;
        });
        if (App.weeklyChart) App.weeklyChart.destroy();
        App.weeklyChart = new Chart(ctx, {
            type: 'bar', data: { labels: days, datasets: [{ label: 'Citas', data: counts, backgroundColor: 'rgba(67,97,238,0.7)', borderRadius: 8, borderSkipped: false }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }, animation: { duration: 800, easing: 'easeOutQuart' } }
        });
    },

    renderQuickSummary(upcoming) {
        const el = document.getElementById('quick-summary');
        if (upcoming.length === 0) { el.innerHTML = '<p class="empty-text">No hay citas próximas</p>'; return; }
        const colors = ['#4361ee', '#2dc653', '#ff6b35', '#7b2cbf', '#f9a825'];
        el.innerHTML = upcoming.slice(0, 5).map((a, i) => `
            <div class="summary-item animate-fade-up" style="animation-delay:${i * 0.1}s">
                <span class="summary-dot" style="background:${colors[i % 5]}"></span>
                <div><strong>${a.clientName || 'Cliente'}</strong><br><small style="color:var(--text-muted)">${App.formatDate(a.date)} ${App.formatTime(a.time)} - ${a.serviceName || ''}</small></div>
            </div>
        `).join('');
    }
};
