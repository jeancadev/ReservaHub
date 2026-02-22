/* ============================================
   ReservaHub - Clients Module
   ============================================ */

App.clients = {
    render() {
        const clients = App.store.getList(App.getBusinessKey('clients'));
        this._renderTable(clients);
    },

    _renderTable(clients) {
        const tbody = document.getElementById('clients-list');
        if (clients.length === 0) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No hay clientes registrados</td></tr>';
            return;
        }
        tbody.innerHTML = clients.map((c, i) => `
            <tr class="animate-fade-up" style="animation-delay:${i * 0.05}s">
                <td data-label="Nombre"><strong>${c.name}</strong></td>
                <td data-label="Teléfono">${(App.phone && App.phone.format(c.phone)) || '-'}</td>
                <td data-label="Email">${c.email || '-'}</td>
                <td data-label="Visitas">${c.visits || 0}</td>
                <td data-label="Última visita">${c.lastVisit ? App.formatDate(c.lastVisit) : 'Nunca'}</td>
                <td data-label="Acciones">
                    <button class="action-btn view ripple-btn" title="Ver historial" onclick="App.clients.showHistory('${c.id}')"><i class="fas fa-eye"></i></button>
                    <button class="action-btn edit ripple-btn" title="Editar" onclick="App.clients.showEdit('${c.id}')"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete ripple-btn" title="Eliminar" onclick="App.clients.delete('${c.id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
        App.ui.initRipple();
    },

    search(query) {
        const clients = App.store.getList(App.getBusinessKey('clients'));
        const q = query.toLowerCase();
        const filtered = q ? clients.filter(c => c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q)) || (c.phone && c.phone.includes(q))) : clients;
        this._renderTable(filtered);
    },

    showCreate() {
        App.modal.open('Nuevo Cliente', `
            <form onsubmit="return App.clients.save(event)">
                <div class="input-group"><label>Nombre completo</label><input type="text" id="cli-name" class="form-input" required placeholder="Nombre del cliente"></div>
                <div class="input-group"><label>Teléfono</label><input type="tel" id="cli-phone" class="form-input" placeholder="+506 XXXX-XXXX"></div>
                <div class="input-group"><label>Email</label><input type="email" id="cli-email" class="form-input" placeholder="email@ejemplo.com"></div>
                <div class="input-group"><label>Notas</label><textarea id="cli-notes" class="form-input" rows="3" placeholder="Preferencias, alergias, notas..."></textarea></div>
                <button type="submit" class="btn btn-primary btn-full ripple-btn"><i class="fas fa-save"></i> Guardar</button>
            </form>
        `);
        App.ui.initRipple();
    },

    showEdit(id) {
        const c = App.store.getList(App.getBusinessKey('clients')).find(x => x.id === id);
        if (!c) return;
        App.modal.open('Editar Cliente', `
            <form onsubmit="return App.clients.save(event, '${id}')">
                <div class="input-group"><label>Nombre</label><input type="text" id="cli-name" class="form-input" required value="${c.name}"></div>
                <div class="input-group"><label>Teléfono</label><input type="tel" id="cli-phone" class="form-input" value="${(App.phone && App.phone.format(c.phone)) || ''}"></div>
                <div class="input-group"><label>Email</label><input type="email" id="cli-email" class="form-input" value="${c.email || ''}"></div>
                <div class="input-group"><label>Notas</label><textarea id="cli-notes" class="form-input" rows="3">${c.notes || ''}</textarea></div>
                <button type="submit" class="btn btn-primary btn-full ripple-btn"><i class="fas fa-save"></i> Actualizar</button>
            </form>
        `);
        App.ui.initRipple();
    },

    save(e, editId) {
        e.preventDefault();
        const phoneInput = document.getElementById('cli-phone');
        const normalizedPhone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(phoneInput ? phoneInput.value : '')
            : (phoneInput ? phoneInput.value.trim() : '');
        if (phoneInput) phoneInput.value = normalizedPhone;
        if (normalizedPhone && (!App.phone || !App.phone.isValid(normalizedPhone))) {
            App.toast.show('El telefono debe usar el formato +506 XXXX-XXXX', 'error');
            return false;
        }
        const data = {
            name: document.getElementById('cli-name').value.trim(),
            phone: normalizedPhone,
            email: document.getElementById('cli-email').value.trim(),
            notes: document.getElementById('cli-notes').value.trim()
        };
        if (editId) { App.store.updateInList(App.getBusinessKey('clients'), editId, data); App.toast.show('Cliente actualizado', 'success'); }
        else { data.visits = 0; App.store.addToList(App.getBusinessKey('clients'), data); App.toast.show('Cliente agregado', 'success'); }
        App.modal.close();
        this.render();
        return false;
    },

    showHistory(id) {
        const c = App.store.getList(App.getBusinessKey('clients')).find(x => x.id === id);
        if (!c) return;
        const appts = App.store.getList(App.getBusinessKey('appointments')).filter(a => a.clientId === id).sort((a, b) => b.date.localeCompare(a.date));
        
        let html = `<div style="margin-bottom:16px"><strong>${c.name}</strong><br><small style="color:var(--text-muted)">${c.email || ''} · ${(App.phone && App.phone.format(c.phone)) || ''}</small></div>`;
        if (c.notes) html += `<div style="background:var(--bg-input);padding:12px;border-radius:8px;margin-bottom:16px;font-size:0.9rem"><strong>Notas:</strong> ${c.notes}</div>`;
        
        if (appts.length === 0) {
            html += '<p class="empty-text">Sin historial de visitas</p>';
        } else {
            html += appts.map(a => `
                <div class="client-history-item">
                    <span class="history-date">${App.formatDate(a.date)}</span>
                    <span class="history-service">${a.serviceName || '-'}</span>
                    <span class="badge badge-${a.status}">${App.dashboard.statusLabel(a.status)}</span>
                    <span class="history-price">${App.formatCurrency(a.price)}</span>
                </div>
            `).join('');
        }
        App.modal.open('Historial - ' + c.name, html);
    },

    delete(id) {
        App.confirm.show('Eliminar Cliente', '¿Estás seguro de eliminar este cliente?', () => {
            App.store.removeFromList(App.getBusinessKey('clients'), id);
            App.toast.show('Cliente eliminado', 'warning');
            this.render();
        });
    }
};


