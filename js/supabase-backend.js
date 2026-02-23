/* ============================================
   ReservaHub - Supabase Backend Bridge
   ============================================ */

(() => {
    const SUPABASE_URL = 'https://znplrsasplrrzrqgexcr.supabase.co';
    const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_0Jt40ZNqZRGgQj4raCnPVw_oPAqN8eu';
    const MEDIA_BUCKET = 'reservahub-media';
    const LOCAL_ONLY_KEYS = new Set(['currentUser', 'users', 'theme']);

    function clone(value) {
        if (value === undefined) return null;
        try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
    }

    App.backend = {
        client: null,
        enabled: false,
        authUserId: null,
        _pendingStateWrites: new Map(),
        _flushTimer: null,
        _setupWarningShown: false,
        _isRecoveryFlow: false,

        async bootstrap() {
            if (!window.supabase || typeof window.supabase.createClient !== 'function') {
                console.warn('Supabase SDK not available.');
                return false;
            }
            this._isRecoveryFlow = this.isRecoveryFlowUrl();

            this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
            this.enabled = true;

            this.client.auth.onAuthStateChange((event, session) => {
                this.authUserId = session && session.user ? session.user.id : null;
                if (event === 'PASSWORD_RECOVERY' && App.auth && typeof App.auth.enterRecoveryMode === 'function') {
                    App.auth.enterRecoveryMode();
                }
            });

            const { data, error } = await this.client.auth.getSession();
            if (error) {
                console.error('Supabase getSession error:', error);
                return false;
            }

            const sessionUser = data && data.session && data.session.user ? data.session.user : null;
            this.authUserId = sessionUser ? sessionUser.id : null;
            if (this._isRecoveryFlow) {
                App.store.remove('currentUser', { skipCloud: true });
                App.currentUser = null;
                if (App.auth && typeof App.auth.enterRecoveryMode === 'function') {
                    App.auth.enterRecoveryMode();
                }
                return true;
            }
            if (!sessionUser) {
                App.store.remove('currentUser', { skipCloud: true });
                App.currentUser = null;
                return true;
            }

            const user = await this.ensureProfile(sessionUser);
            if (!user) return true;

            App.currentUser = user;
            App.store.set('currentUser', user, { skipCloud: true });

            await this.refreshUsersCache();
            await this.hydrateStateCache();
            App.showApp();
            return true;
        },

        isRecoveryFlowUrl() {
            const hash = String(window.location.hash || '').toLowerCase();
            const query = String(window.location.search || '').toLowerCase();
            return hash.includes('type=recovery') || query.includes('type=recovery');
        },

        isCloudReady() {
            return this.enabled && !!this.authUserId;
        },

        isStorageReady() {
            return this.isCloudReady() && !!(this.client && this.client.storage);
        },

        shouldSyncKey(key) {
            return !!key && !LOCAL_ONLY_KEYS.has(String(key));
        },

        queueStateUpsert(key, value) {
            if (!this.isCloudReady()) return;
            this._pendingStateWrites.set(String(key), { op: 'upsert', value: clone(value) });
            this._scheduleFlush();
        },

        queueStateDelete(key) {
            if (!this.isCloudReady()) return;
            this._pendingStateWrites.set(String(key), { op: 'delete' });
            this._scheduleFlush();
        },

        _scheduleFlush() {
            if (this._flushTimer) return;
            this._flushTimer = setTimeout(() => {
                this._flushTimer = null;
                this.flushStateWrites().catch(err => {
                    console.error('Supabase state flush error:', err);
                });
            }, 250);
        },

        async flushStateWrites() {
            if (!this.isCloudReady() || this._pendingStateWrites.size === 0) return;
            const writes = Array.from(this._pendingStateWrites.entries());
            this._pendingStateWrites.clear();

            const upserts = [];
            const deletes = [];
            writes.forEach(([key, payload]) => {
                if (payload.op === 'delete') {
                    deletes.push(key);
                } else {
                    upserts.push({
                        key,
                        value: payload.value,
                        updated_by: this.authUserId,
                        updated_at: new Date().toISOString()
                    });
                }
            });

            if (upserts.length) {
                const { error } = await this.client.from('app_state').upsert(upserts, { onConflict: 'key' });
                if (error) {
                    this._handleSetupError(error, 'guardar datos');
                    upserts.forEach(item => this._pendingStateWrites.set(item.key, { op: 'upsert', value: item.value }));
                }
            }

            if (deletes.length) {
                const { error } = await this.client.from('app_state').delete().in('key', deletes);
                if (error) {
                    this._handleSetupError(error, 'eliminar datos');
                    deletes.forEach(key => this._pendingStateWrites.set(key, { op: 'delete' }));
                }
            }
        },

        normalizeProfileRow(row) {
            const role = String(row.role || '').toLowerCase() === 'client' ? 'client' : 'business';
            const normalizedCategory = typeof App.normalizeBusinessCategory === 'function'
                ? App.normalizeBusinessCategory(row.category || 'barberia')
                : (row.category || 'barberia');
            return {
                id: row.id,
                name: row.name || 'Usuario',
                email: row.email || '',
                phone: row.phone || '',
                role,
                businessName: role === 'business' ? (row.business_name || row.name || '') : '',
                category: role === 'business' ? normalizedCategory : '',
                address: row.address || '',
                description: row.description || '',
                businessPhoto: role === 'business' ? (row.business_photo_url || '') : '',
                businessPhotoPath: role === 'business' ? (row.business_photo_path || '') : '',
                createdAt: row.created_at || new Date().toISOString()
            };
        },

        toProfilePayload(user) {
            const role = String(user.role || '').toLowerCase() === 'client' ? 'client' : 'business';
            return {
                id: user.id,
                name: user.name || 'Usuario',
                email: String(user.email || '').toLowerCase(),
                phone: user.phone || '',
                role,
                business_name: role === 'business' ? (user.businessName || user.name || '') : '',
                category: role === 'business'
                    ? (typeof App.normalizeBusinessCategory === 'function'
                        ? App.normalizeBusinessCategory(user.category || 'barberia')
                        : (user.category || 'barberia'))
                    : null,
                address: user.address || '',
                description: user.description || '',
                business_photo_url: role === 'business' ? (user.businessPhoto || '') : '',
                business_photo_path: role === 'business' ? (user.businessPhotoPath || '') : '',
                created_at: user.createdAt || new Date().toISOString()
            };
        },

        async refreshUsersCache() {
            if (!this.enabled) return App.store.getList('users');
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: true });
            if (error) {
                this._handleSetupError(error, 'cargar usuarios');
                return App.store.getList('users');
            }
            const users = (data || []).map(row => this.normalizeProfileRow(row));
            App.store.set('users', users, { skipCloud: true });
            return users;
        },

        async hydrateStateCache() {
            if (!this.isCloudReady()) return;
            const { data, error } = await this.client
                .from('app_state')
                .select('key,value')
                .limit(10000);
            if (error) {
                this._handleSetupError(error, 'sincronizar datos');
                return;
            }
            (data || []).forEach(row => {
                if (!row || !row.key) return;
                App.store.set(row.key, row.value, { skipCloud: true });
            });
        },

        async ensureProfile(authUser) {
            if (!authUser || !authUser.id) return null;
            const { data, error } = await this.client
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .maybeSingle();
            if (error) {
                this._handleSetupError(error, 'leer perfil');
                return null;
            }
            if (data) return this.normalizeProfileRow(data);

            const metadata = authUser.user_metadata || {};
            const role = String(metadata.role || '').toLowerCase() === 'client' ? 'client' : 'business';
            const payload = {
                id: authUser.id,
                name: metadata.name || (authUser.email ? authUser.email.split('@')[0] : 'Usuario'),
                email: String(authUser.email || metadata.email || '').toLowerCase(),
                phone: metadata.phone || '',
                role,
                business_name: role === 'business' ? (metadata.business_name || metadata.name || '') : '',
                category: role === 'business'
                    ? (typeof App.normalizeBusinessCategory === 'function'
                        ? App.normalizeBusinessCategory(metadata.category || 'barberia')
                        : (metadata.category || 'barberia'))
                    : null,
                address: metadata.address || '',
                description: metadata.description || '',
                business_photo_url: '',
                business_photo_path: '',
                created_at: new Date().toISOString()
            };
            const { error: insertError } = await this.client
                .from('profiles')
                .upsert(payload, { onConflict: 'id' });
            if (insertError) {
                this._handleSetupError(insertError, 'crear perfil');
            }
            return this.normalizeProfileRow(payload);
        },

        async loginWithPassword(email, password) {
            if (!this.enabled) throw new Error('Supabase no esta disponible.');
            const { data, error } = await this.client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const sessionUser = data && data.user ? data.user : null;
            this.authUserId = sessionUser ? sessionUser.id : null;
            if (!sessionUser) throw new Error('No se pudo iniciar sesion.');
            const profile = await this.ensureProfile(sessionUser);
            if (!profile) throw new Error('No se pudo cargar tu perfil.');
            await this.refreshUsersCache();
            await this.hydrateStateCache();
            return profile;
        },

        async registerWithPassword(payload) {
            if (!this.enabled) throw new Error('Supabase no esta disponible.');
            const metadata = {
                name: payload.name || '',
                role: payload.role || 'business',
                phone: payload.phone || '',
                business_name: payload.businessName || '',
                category: payload.category || 'barberia'
            };
            const { data, error } = await this.client.auth.signUp({
                email: payload.email,
                password: payload.password,
                options: { data: metadata }
            });
            if (error) throw error;
            const session = data && data.session ? data.session : null;
            const authUser = data && data.user ? data.user : null;
            if (!authUser) throw new Error('No se pudo crear el usuario.');

            this.authUserId = session && session.user ? session.user.id : null;
            const profilePayload = {
                id: authUser.id,
                name: payload.name,
                email: String(payload.email || '').toLowerCase(),
                phone: payload.phone || '',
                role: payload.role,
                business_name: payload.role === 'business' ? (payload.businessName || payload.name || '') : '',
                category: payload.role === 'business'
                    ? (typeof App.normalizeBusinessCategory === 'function'
                        ? App.normalizeBusinessCategory(payload.category || 'barberia')
                        : (payload.category || 'barberia'))
                    : null,
                address: '',
                description: '',
                business_photo_url: '',
                business_photo_path: '',
                created_at: new Date().toISOString()
            };

            if (this.authUserId) {
                const { error: profileError } = await this.client
                    .from('profiles')
                    .upsert(profilePayload, { onConflict: 'id' });
                if (profileError) this._handleSetupError(profileError, 'guardar perfil');
                await this.refreshUsersCache();
                await this.hydrateStateCache();
            }

            return {
                user: this.normalizeProfileRow(profilePayload),
                emailConfirmationRequired: !session
            };
        },

        async sendPasswordRecoveryEmail(email) {
            if (!this.enabled) throw new Error('Supabase no esta disponible.');
            const redirectTo = `${window.location.origin}${window.location.pathname}`;
            const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
            if (error) throw error;
        },

        async updatePassword(newPassword) {
            if (!this.enabled) throw new Error('Supabase no esta disponible.');
            const { error } = await this.client.auth.updateUser({ password: newPassword });
            if (error) throw error;
        },

        async updateCurrentProfile(user) {
            if (!this.isCloudReady() || !user || !user.id) return;
            const payload = this.toProfilePayload(user);
            const { error } = await this.client
                .from('profiles')
                .upsert(payload, { onConflict: 'id' });
            if (error) throw error;
            await this.refreshUsersCache();
        },

        async syncAuthEmail(email) {
            if (!this.isCloudReady()) return { changed: false };
            const next = String(email || '').trim().toLowerCase();
            if (!next) return { changed: false };
            const { data: userData } = await this.client.auth.getUser();
            const current = userData && userData.user && userData.user.email
                ? String(userData.user.email).toLowerCase()
                : '';
            if (!current || current === next) return { changed: false };
            const { error } = await this.client.auth.updateUser({ email: next });
            if (error) throw error;
            return { changed: true };
        },

        _safePathPart(value) {
            return String(value || '')
                .toLowerCase()
                .replace(/[^a-z0-9._-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '') || 'file';
        },

        _buildPhotoPath(ownerId, scope, originalName) {
            const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const owner = this._safePathPart(ownerId);
            const safeScope = this._safePathPart(scope || 'profile');
            return `users/${owner}/${safeScope}/${stamp}.jpg`;
        },

        async uploadPhotoBlob({ blob, ownerId, scope, originalName }) {
            if (!this.isStorageReady()) throw new Error('Storage no disponible');
            if (!blob) throw new Error('Archivo vacio');

            const path = this._buildPhotoPath(ownerId || this.authUserId, scope, originalName);
            const { error: uploadError } = await this.client.storage
                .from(MEDIA_BUCKET)
                .upload(path, blob, {
                    upsert: false,
                    contentType: blob.type || 'image/jpeg',
                    cacheControl: '31536000'
                });
            if (uploadError) throw uploadError;

            const { data } = this.client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
            const url = data && data.publicUrl ? data.publicUrl : '';
            return { path, url };
        },

        async removeStoragePath(path) {
            if (!this.isStorageReady()) return;
            const clean = String(path || '').trim();
            if (!clean) return;
            const { error } = await this.client.storage.from(MEDIA_BUCKET).remove([clean]);
            if (error) console.error('Supabase storage remove error:', error);
        },

        async deleteCurrentAccountData(user) {
            if (!this.isCloudReady() || !user || !user.id) return;
            const likeUserKeys = `${user.id}_%`;
            const likeEmpAvailKeys = `ap_${user.id}_emp_avail_%`;
            const { error: stateError } = await this.client
                .from('app_state')
                .delete()
                .or(`key.like.${likeUserKeys},key.like.${likeEmpAvailKeys}`);
            if (stateError) this._handleSetupError(stateError, 'eliminar datos de cuenta');

            const { error: profileError } = await this.client
                .from('profiles')
                .delete()
                .eq('id', user.id);
            if (profileError) this._handleSetupError(profileError, 'eliminar perfil');
            await this.refreshUsersCache();
        },

        async deleteCurrentAuthUser() {
            if (!this.isCloudReady()) return;
            const { error } = await this.client.rpc('delete_current_user');
            if (error) throw error;
            this.authUserId = null;
        },

        async signOut() {
            if (!this.enabled) return;
            const { error } = await this.client.auth.signOut();
            this.authUserId = null;
            if (error) throw error;
        },

        _handleSetupError(error, action) {
            console.error(`Supabase setup error while trying to ${action}:`, error);
            const message = String((error && error.message) || '').toLowerCase();
            const missingSchema =
                message.includes('relation') ||
                message.includes('does not exist') ||
                message.includes('app_state') ||
                message.includes('profiles') ||
                message.includes('storage') ||
                message.includes(MEDIA_BUCKET);
            if (missingSchema && !this._setupWarningShown && App.toast && typeof App.toast.show === 'function') {
                this._setupWarningShown = true;
                App.toast.show('Falta configurar tablas en Supabase. Ejecuta SUPABASE_SETUP.sql.', 'warning');
            }
        }
    };
})();
