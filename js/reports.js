/* ============================================
   ReservaHub - Reports Module
   ============================================ */

App.reports = {
    _periodPopulated: false,

    // Dynamically populate the period selector with previous months
    populatePeriodSelect() {
        const select = document.getElementById('report-period');
        if (!select || this._periodPopulated) return;
        this._periodPopulated = true;

        const now = new Date();
        const monthNames = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        // Keep the existing static options (week, month, year)
        // Then add a separator and the last 12 previous months
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '── Meses anteriores ──';
        separator.style.fontWeight = 'bold';
        select.appendChild(separator);

        for (let i = 1; i <= 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            select.appendChild(opt);
        }
    },

    // Shared filtering logic used by both render() and exportExcel()
    getFilteredAppointments() {
        const period = document.getElementById('report-period').value;
        const appts = App.store.getList(App.getBusinessKey('appointments'));
        const now = new Date();

        if (period === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            return { filtered: appts.filter(a => new Date(a.date) >= start), period, label: 'Esta Semana' };
        } else if (period === 'month') {
            const month = now.toISOString().slice(0, 7);
            return { filtered: appts.filter(a => a.date.startsWith(month)), period, label: 'Este Mes' };
        } else if (period === 'year') {
            const year = now.getFullYear().toString();
            return { filtered: appts.filter(a => a.date.startsWith(year)), period, label: 'Este Año' };
        } else if (/^\d{4}-\d{2}$/.test(period)) {
            // Specific month: e.g. "2025-12"
            const selectEl = document.getElementById('report-period');
            const label = selectEl.options[selectEl.selectedIndex].textContent;
            return { filtered: appts.filter(a => a.date.startsWith(period)), period, label };
        }
        return { filtered: appts, period, label: 'Todos' };
    },

    render() {
        this.populatePeriodSelect();

        const { filtered, period } = this.getFilteredAppointments();
        const now = new Date();

        const total = filtered.filter(a => a.status !== 'cancelled').length;
        const completed = filtered.filter(a => a.status === 'completed');
        const revenue = completed.reduce((s, a) => s + (Number(a.price) || 0), 0);
        const cancelled = filtered.filter(a => a.status === 'cancelled').length;
        const cancelRate = filtered.length > 0 ? Math.round((cancelled / filtered.length) * 100) : 0;
        const clients = App.store.getList(App.getBusinessKey('clients'));

        // For "new clients" stat, use the appropriate month key
        let newClientsMonthKey;
        if (period === 'month') {
            newClientsMonthKey = now.toISOString().slice(0, 7);
        } else if (/^\d{4}-\d{2}$/.test(period)) {
            newClientsMonthKey = period;
        }
        const newClients = newClientsMonthKey
            ? clients.filter(c => c.createdAt && c.createdAt.startsWith(newClientsMonthKey)).length
            : clients.length;

        document.getElementById('report-total-appts').textContent = total;
        document.getElementById('report-revenue').textContent = App.formatCurrency(revenue);
        document.getElementById('report-cancel-rate').textContent = cancelRate + '%';
        document.getElementById('report-new-clients').textContent = newClients;

        this.renderRevenueChart(filtered);
        this.renderServicesChart(filtered);
        this.renderOccupancyChart(filtered);
    },

    renderRevenueChart(appts) {
        const ctx = document.getElementById('revenue-chart');
        if (!ctx) return;
        const completed = appts.filter(a => a.status === 'completed');
        const days = {};
        completed.forEach(a => { days[a.date] = (days[a.date] || 0) + (Number(a.price) || 0); });
        const labels = Object.keys(days).sort();
        const data = labels.map(l => days[l]);
        if (App.revenueChart) App.revenueChart.destroy();
        App.revenueChart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels.map(l => l.slice(5)), datasets: [{ label: 'Ingresos', data, fill: true, backgroundColor: 'rgba(67,97,238,0.1)', borderColor: '#4361ee', tension: 0.4, pointRadius: 4, pointBackgroundColor: '#4361ee' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }, animation: { duration: 1000, easing: 'easeOutQuart' } }
        });
    },

    renderServicesChart(appts) {
        const ctx = document.getElementById('services-chart');
        if (!ctx) return;
        const validAppts = appts.filter(a => a.status !== 'cancelled' && a.serviceName);
        const counts = {};
        validAppts.forEach(a => { counts[a.serviceName] = (counts[a.serviceName] || 0) + 1; });
        const labels = Object.keys(counts);
        const data = labels.map(l => counts[l]);
        const colors = ['#4361ee', '#2dc653', '#ff6b35', '#7b2cbf', '#f9a825', '#4895ef'];
        if (App.servicesChart) App.servicesChart.destroy();
        App.servicesChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } }, animation: { duration: 1000, animateRotate: true } }
        });
    },

    renderOccupancyChart(appts) {
        const ctx = document.getElementById('occupancy-chart');
        if (!ctx) return;
        const employees = App.store.getList(App.getBusinessKey('employees'));
        const validAppts = appts.filter(a => a.status !== 'cancelled');
        const counts = {};
        employees.forEach(e => { counts[e.name] = 0; });
        validAppts.forEach(a => { if (a.employeeName) counts[a.employeeName] = (counts[a.employeeName] || 0) + 1; });
        const labels = Object.keys(counts);
        const data = labels.map(l => counts[l]);
        if (App.occupancyChart) App.occupancyChart.destroy();
        App.occupancyChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Citas', data, backgroundColor: 'rgba(67,97,238,0.7)', borderRadius: 8, borderSkipped: false }] },
            options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } }, animation: { duration: 800 } }
        });
    },

    exportExcel() {
        const { filtered: appts, label: periodLabel } = this.getFilteredAppointments();
        if (appts.length === 0) { App.toast.show('No hay datos para exportar en este periodo', 'warning'); return; }
        if (typeof XLSX === 'undefined') { App.toast.show('Error: librería de Excel no cargada', 'error'); return; }

        const u = App.currentUser || {};
        const bizName = u.businessName || u.name || 'Mi Negocio';
        const today = App.getCRDate().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' });
        const headers = ['Fecha', 'Hora', 'Cliente', 'Servicio', 'Profesional', 'Precio (₡)', 'Estado'];
        const colCount = headers.length;

        // Prepare data rows
        const completed = appts.filter(a => a.status === 'completed');
        const totalRevenue = completed.reduce((s, a) => s + (Number(a.price) || 0), 0);
        const cancelled = appts.filter(a => a.status === 'cancelled').length;
        const cancelRate = appts.length > 0 ? Math.round((cancelled / appts.length) * 100) : 0;

        const dataRows = appts.map(a => [
            App.formatDate(a.date),
            App.formatTime(a.time),
            a.clientName || 'Sin nombre',
            a.serviceName || '-',
            a.employeeName || '-',
            Number(a.price) || 0,
            App.dashboard.statusLabel(a.status)
        ]);

        // Build worksheet data array
        const wsData = [];
        // Row 0: Title
        wsData.push([`Reporte — ${bizName}`]);
        // Row 1: Period + date
        wsData.push([`Periodo: ${periodLabel}  •  Generado: ${today}`]);
        // Row 2: Empty spacer
        wsData.push([]);
        // Row 3: Summary
        wsData.push(['Resumen:', '', `Total citas: ${appts.length}`, '', `Ingresos: ₡${totalRevenue.toLocaleString('es-CR')}`, '', `Cancelación: ${cancelRate}%`]);
        // Row 4: Empty spacer
        wsData.push([]);
        // Row 5: Headers
        wsData.push(headers);
        // Row 6+: Data
        dataRows.forEach(r => wsData.push(r));
        // Totals row
        const totalsRowIdx = wsData.length;
        const totalsRow = ['', '', '', '', 'TOTAL', totalRevenue, `${completed.length} completadas`];
        wsData.push(totalsRow);

        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // ---- Merge title & date rows across all columns ----
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } }
        ];

        // ---- Column widths ----
        ws['!cols'] = [
            { wch: 14 },  // Fecha
            { wch: 12 },  // Hora
            { wch: 22 },  // Cliente
            { wch: 22 },  // Servicio
            { wch: 20 },  // Profesional
            { wch: 14 },  // Precio
            { wch: 16 }   // Estado
        ];

        // ---- Row heights ----
        ws['!rows'] = [];
        ws['!rows'][0] = { hpt: 32 }; // Title
        ws['!rows'][1] = { hpt: 20 }; // Date
        ws['!rows'][3] = { hpt: 22 }; // Summary
        ws['!rows'][5] = { hpt: 24 }; // Headers

        // ---- Styles ----
        const borderThin = {
            top: { style: 'thin', color: { rgb: 'D0D5DD' } },
            bottom: { style: 'thin', color: { rgb: 'D0D5DD' } },
            left: { style: 'thin', color: { rgb: 'D0D5DD' } },
            right: { style: 'thin', color: { rgb: 'D0D5DD' } }
        };

        const titleStyle = {
            font: { bold: true, sz: 16, color: { rgb: '1A1A2E' } },
            alignment: { horizontal: 'left', vertical: 'center' }
        };
        const dateStyle = {
            font: { sz: 10, color: { rgb: '667085' }, italic: true },
            alignment: { horizontal: 'left', vertical: 'center' }
        };
        const summaryStyle = {
            font: { bold: true, sz: 11, color: { rgb: '344054' } },
            fill: { fgColor: { rgb: 'EFF4FF' } },
            border: borderThin,
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        const headerStyle = {
            font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4361EE' } },
            border: borderThin,
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        const cellStyleEven = {
            font: { sz: 10, color: { rgb: '344054' } },
            border: borderThin,
            alignment: { vertical: 'center' }
        };
        const cellStyleOdd = {
            font: { sz: 10, color: { rgb: '344054' } },
            fill: { fgColor: { rgb: 'F8F9FA' } },
            border: borderThin,
            alignment: { vertical: 'center' }
        };
        const priceStyle = (base) => Object.assign({}, base, {
            numFmt: '₡#,##0',
            alignment: { horizontal: 'right', vertical: 'center' }
        });
        const totalsStyle = {
            font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '2DC653' } },
            border: borderThin,
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        const totalsPriceStyle = Object.assign({}, totalsStyle, {
            numFmt: '₡#,##0',
            alignment: { horizontal: 'right', vertical: 'center' }
        });

        // Apply styles to cells
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            for (let C = range.s.c; C <= range.e.c; C++) {
                const addr = XLSX.utils.encode_cell({ r: R, c: C });
                if (!ws[addr]) ws[addr] = { v: '', t: 's' };

                if (R === 0) {
                    ws[addr].s = titleStyle;
                } else if (R === 1) {
                    ws[addr].s = dateStyle;
                } else if (R === 3) {
                    ws[addr].s = summaryStyle;
                } else if (R === 5) {
                    ws[addr].s = headerStyle;
                } else if (R >= 6 && R < totalsRowIdx) {
                    const isOdd = (R - 6) % 2 === 1;
                    ws[addr].s = C === 5 ? priceStyle(isOdd ? cellStyleOdd : cellStyleEven) : (isOdd ? cellStyleOdd : cellStyleEven);
                } else if (R === totalsRowIdx) {
                    ws[addr].s = C === 5 ? totalsPriceStyle : totalsStyle;
                }
            }
        }

        // Build workbook & download
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
        const periodSuffix = this.getFilteredAppointments().period.replace(/[^a-zA-Z0-9-]/g, '');
        XLSX.writeFile(wb, `ReservaHub_Reporte_${periodSuffix}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        App.toast.show('Reporte Excel exportado exitosamente', 'success');
    }
};
