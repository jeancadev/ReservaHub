/* ============================================
   ReservaHub - Auth Module
   ============================================ */

App.auth = {
    togglePasswordVisibility(inputId, btnElement) {
        const input = document.getElementById(inputId);
        const icon = btnElement.querySelector('i');
        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    },

    showLogin() {
        this._recoveryModeShown = false;
        document.getElementById('login-form').style.display = 'block';
        document.getElementById('register-form').style.display = 'none';
        const forgotForm = document.getElementById('forgot-form');
        const resetForm = document.getElementById('reset-form');
        if (forgotForm) forgotForm.style.display = 'none';
        if (resetForm) resetForm.style.display = 'none';
        document.querySelector('.auth-container').style.animation = 'none';
        document.querySelector('.auth-container').offsetHeight;
        document.querySelector('.auth-container').style.animation = 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
    },

    resetAuthForms() {
        this._recoveryModeShown = false;
        const setVal = (id, value = '') => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        setVal('login-email', '');
        setVal('login-password', '');
        setVal('register-name', '');
        setVal('register-business', '');
        setVal('register-email', '');
        setVal('register-phone', '');
        setVal('register-password', '');
        setVal('register-confirm', '');
        setVal('forgot-email', '');
        setVal('reset-password', '');
        setVal('reset-confirm', '');
        setVal('register-business-category', 'barberia');
        setVal('register-role', 'business');

        const roleSelector = document.getElementById('role-selector-group');
        const businessGroup = document.getElementById('business-name-group');
        const categoryGroup = document.getElementById('business-category-group');
        const forgotForm = document.getElementById('forgot-form');
        const resetForm = document.getElementById('reset-form');
        const phoneInput = document.getElementById('register-phone');
        if (roleSelector) roleSelector.style.display = '';
        if (businessGroup) businessGroup.style.display = 'block';
        if (categoryGroup) categoryGroup.style.display = 'block';
        if (forgotForm) forgotForm.style.display = 'none';
        if (resetForm) resetForm.style.display = 'none';
        if (phoneInput) phoneInput.required = false;

        document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === 'business'));
        document.querySelectorAll('#register-password-hints [data-rule]').forEach(item => item.classList.remove('ok'));
        this.updatePasswordPolicyUI('business');
        this.updatePasswordHints();
    },

    showRegister(forceRole) {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
        const forgotForm = document.getElementById('forgot-form');
        const resetForm = document.getElementById('reset-form');
        if (forgotForm) forgotForm.style.display = 'none';
        if (resetForm) resetForm.style.display = 'none';
        document.querySelector('.auth-container').style.animation = 'none';
        document.querySelector('.auth-container').offsetHeight;
        document.querySelector('.auth-container').style.animation = 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';

        const roleSelector = document.getElementById('role-selector-group');
        const businessGroup = document.getElementById('business-name-group');
        const categoryGroup = document.getElementById('business-category-group');
        const phoneInput = document.getElementById('register-phone');
        const categoryInput = document.getElementById('register-business-category');
        if (categoryInput && !categoryInput.value) categoryInput.value = 'barberia';

        if (forceRole) {
            roleSelector.style.display = 'none';
            document.getElementById('register-role').value = forceRole;
            businessGroup.style.display = forceRole === 'business' ? 'block' : 'none';
            categoryGroup.style.display = forceRole === 'business' ? 'block' : 'none';
            if (phoneInput) phoneInput.required = forceRole === 'client';
            this.updatePasswordPolicyUI(forceRole);
            this.updatePasswordHints();
        } else {
            roleSelector.style.display = '';
            this.selectRole('business');
        }
    },

    showForgotPassword() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'none';
        const forgotForm = document.getElementById('forgot-form');
        const resetForm = document.getElementById('reset-form');
        if (forgotForm) forgotForm.style.display = 'block';
        if (resetForm) resetForm.style.display = 'none';
        document.querySelector('.auth-container').style.animation = 'none';
        document.querySelector('.auth-container').offsetHeight;
        document.querySelector('.auth-container').style.animation = 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
    },

    showResetPassword() {
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'none';
        const forgotForm = document.getElementById('forgot-form');
        const resetForm = document.getElementById('reset-form');
        if (forgotForm) forgotForm.style.display = 'none';
        if (resetForm) resetForm.style.display = 'block';
        document.querySelector('.auth-container').style.animation = 'none';
        document.querySelector('.auth-container').offsetHeight;
        document.querySelector('.auth-container').style.animation = 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both';
    },

    enterRecoveryMode() {
        if (this._recoveryModeShown) return;
        this._recoveryModeShown = true;
        document.getElementById('app-shell').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        this.showResetPassword();
        this._clearRecoveryUrlHash();
        App.toast.show('Ingresa tu nueva contrasena para recuperar el acceso', 'info');
    },

    _clearRecoveryUrlHash() {
        if (!window.history || typeof window.history.replaceState !== 'function') return;
        if (!window.location.hash) return;
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    },

    showClientRegister() {
        this.showRegister('client');
    },

    showBusinessRegister() {
        this.showRegister('business');
    },

    selectRole(role) {
        document.getElementById('register-role').value = role;
        document.querySelectorAll('.role-btn').forEach(b => b.classList.toggle('active', b.dataset.role === role));
        const bg = document.getElementById('business-name-group');
        const cg = document.getElementById('business-category-group');
        const phoneInput = document.getElementById('register-phone');
        bg.style.display = role === 'business' ? 'block' : 'none';
        cg.style.display = role === 'business' ? 'block' : 'none';
        if (phoneInput) phoneInput.required = role === 'client';
        this.updatePasswordPolicyUI(role);
        this.updatePasswordHints();
    },

    updatePasswordPolicyUI(role) {
        const currentRole = role || (document.getElementById('register-role') ? document.getElementById('register-role').value : 'business');
        const isBusiness = currentRole === 'business';
        const hints = document.getElementById('register-password-hints');
        const strength = document.getElementById('register-password-strength');
        const pwdInput = document.getElementById('register-password');

        if (hints) hints.style.display = isBusiness ? 'grid' : 'none';
        if (strength) {
            strength.style.display = isBusiness ? 'block' : 'none';
            if (!isBusiness) {
                strength.classList.remove('is-weak', 'is-medium', 'is-strong');
                strength.classList.add('is-empty');
                const label = strength.querySelector('.password-strength-label');
                if (label) label.textContent = 'Fortaleza: Debil';
            }
        }

        if (pwdInput) {
            pwdInput.placeholder = isBusiness
                ? 'Debe contener al menos 8 caracteres'
                : '8 caracteres';
        }
    },

    validatePasswordSecurity(password) {
        const pwd = String(password || '');
        return {
            length: pwd.length === 8,
            upper: /[A-Z]/.test(pwd),
            lower: /[a-z]/.test(pwd),
            number: /\d/.test(pwd),
            special: /[^A-Za-z0-9]/.test(pwd)
        };
    },

    isPasswordSecure(password) {
        const checks = this.validatePasswordSecurity(password);
        return Object.values(checks).every(Boolean);
    },

    getPasswordStrength(password) {
        const pwd = String(password || '');
        const checks = this.validatePasswordSecurity(pwd);
        const passed = Object.values(checks).filter(Boolean).length;

        if (!pwd.length) return { level: 'empty', label: 'Fortaleza: Debil' };
        if (passed === 5) return { level: 'strong', label: 'Fortaleza: Fuerte' };
        if (passed >= 3) return { level: 'medium', label: 'Fortaleza: Media' };
        return { level: 'weak', label: 'Fortaleza: Debil' };
    },

    updatePasswordHints() {
        const input = document.getElementById('register-password');
        const list = document.getElementById('register-password-hints');
        const strength = document.getElementById('register-password-strength');
        const role = document.getElementById('register-role') ? document.getElementById('register-role').value : 'business';

        if (!input || !list) return;
        if (role !== 'business') return;

        const pwd = input.value || '';
        const checks = this.validatePasswordSecurity(pwd);
        Object.keys(checks).forEach(rule => {
            const item = list.querySelector(`[data-rule="${rule}"]`);
            if (!item) return;
            item.classList.toggle('ok', checks[rule]);
        });

        if (strength) {
            const label = strength.querySelector('.password-strength-label');
            const state = this.getPasswordStrength(pwd);
            strength.classList.remove('is-empty', 'is-weak', 'is-medium', 'is-strong');
            strength.classList.add(`is-${state.level}`);
            if (label) label.textContent = state.label;
        }
    },

    mapAuthError(err) {
        const code = String(err && err.code ? err.code : '').toLowerCase();
        const msg = String(err && err.message ? err.message : '').toLowerCase();
        if (code.includes('invalid_login_credentials') || msg.includes('invalid login credentials')) {
            return 'Email o contrasena incorrectos';
        }
        if (msg.includes('email not confirmed')) {
            return 'Confirma tu correo antes de iniciar sesion';
        }
        if (msg.includes('user already registered')) {
            return 'Este email ya esta registrado';
        }
        if (msg.includes('password should be at least')) {
            return 'La contrasena no cumple los requisitos de Supabase';
        }
        if (msg.includes('too many requests')) {
            return 'Demasiados intentos. Espera unos minutos';
        }
        if (msg.includes('for security purposes')) {
            return 'Si el correo existe, recibira instrucciones de recuperacion';
        }
        return 'No se pudo completar la autenticacion';
    },

    async requestPasswordReset(e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value.trim().toLowerCase();
        if (!email) {
            App.toast.show('Ingresa tu correo para recuperar la contrasena', 'error');
            return false;
        }
        if (!App.backend || !App.backend.enabled) {
            App.toast.show('Recuperacion disponible solo con Supabase activo', 'warning');
            return false;
        }
        try {
            await App.backend.sendPasswordRecoveryEmail(email);
            App.toast.show('Si el correo existe, enviamos un enlace de recuperacion', 'success');
            setTimeout(() => this.showLogin(), 800);
        } catch (err) {
            console.error('Password reset email error:', err);
            App.toast.show(this.mapAuthError(err), 'error');
        }
        return false;
    },

    async completePasswordReset(e) {
        e.preventDefault();
        const password = document.getElementById('reset-password').value;
        const confirm = document.getElementById('reset-confirm').value;
        if (!password || !confirm) {
            App.toast.show('Completa ambos campos de contrasena', 'error');
            return false;
        }
        if (password !== confirm) {
            App.toast.show('Las contrasenas no coinciden', 'error');
            return false;
        }
        if (password.length < 8) {
            App.toast.show('La nueva contrasena debe tener al menos 8 caracteres', 'error');
            return false;
        }
        if (!App.backend || !App.backend.enabled) {
            App.toast.show('No se pudo completar la recuperacion', 'error');
            return false;
        }
        try {
            await App.backend.updatePassword(password);
            await App.backend.signOut();
            App.store.remove('currentUser', { skipCloud: true });
            App.currentUser = null;
            if (App.session && typeof App.session.stop === 'function') App.session.stop();
            this.resetAuthForms();
            this.showLogin();
            App.toast.show('Contrasena actualizada. Inicia sesion nuevamente', 'success');
        } catch (err) {
            console.error('Password reset complete error:', err);
            App.toast.show(this.mapAuthError(err), 'error');
        }
        return false;
    },

    async login(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;

        if (App.backend && App.backend.enabled) {
            try {
                const user = await App.backend.loginWithPassword(email, password);
                App.currentUser = user;
                App.store.set('currentUser', user, { skipCloud: true });
                App.toast.show('Bienvenido de vuelta, ' + user.name + '!', 'success');
                App.showApp();
                return false;
            } catch (err) {
                console.error('Supabase login error:', err);
                const code = String(err && err.code ? err.code : '').toLowerCase();
                const msg = String(err && err.message ? err.message : '').toLowerCase();
                
                // If invalid credentials, it could mean wrong password OR user doesn't exist
                if (code.includes('invalid_login_credentials') || msg.includes('invalid login credentials')) {
                    App.toast.show('Email o contraseña incorrectos. Si no tienes cuenta, ¡regístrate!', 'error');
                } else {
                    App.toast.show(this.mapAuthError(err), 'error');
                }
                return false;
            }
        }

        const users = App.store.getList('users');
        const userByEmail = users.find(u => u.email === email);
        
        if (!userByEmail) {
            App.toast.show('No se encontró una cuenta con ese correo. Por favor, regístrate.', 'warning');
            return false;
        }

        if (userByEmail.password !== password) {
            App.toast.show('Contraseña incorrecta', 'error');
            return false;
        }

        App.currentUser = userByEmail;
        App.store.set('currentUser', userByEmail, { skipCloud: true });
        App.toast.show('Bienvenido de vuelta, ' + userByEmail.name + '!', 'success');
        App.showApp();
        return false;
    },

    async register(e) {
        e.preventDefault();
        const name = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim().toLowerCase();
        const phoneInput = document.getElementById('register-phone');
        const rawPhone = phoneInput ? phoneInput.value.trim() : '';
        const phone = App.phone && typeof App.phone.format === 'function'
            ? App.phone.format(rawPhone)
            : rawPhone;
        if (phoneInput) phoneInput.value = phone;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const role = document.getElementById('register-role').value;
        const businessName = document.getElementById('register-business').value.trim();
        const businessCategoryInput = document.getElementById('register-business-category');
        const businessCategory = businessCategoryInput ? businessCategoryInput.value : 'barberia';

        if (password !== confirm) {
            App.toast.show('Las contrasenas no coinciden', 'error');
            return false;
        }
        if (password.length !== 8) {
            App.toast.show('La contrasena debe tener exactamente 8 caracteres', 'error');
            return false;
        }
        if (role === 'business' && !this.isPasswordSecure(password)) {
            App.toast.show('Para negocio: usa mayuscula, minuscula, numero y caracter especial en 8 caracteres', 'error');
            this.updatePasswordHints();
            return false;
        }
        if (role === 'business' && !businessName) {
            App.toast.show('Ingresa el nombre de tu negocio', 'error');
            return false;
        }
        if (role === 'client' && !phone) {
            App.toast.show('Ingresa tu telefono para continuar', 'error');
            return false;
        }
        if (phone && (!App.phone || !App.phone.isValid(phone))) {
            App.toast.show('El telefono debe usar el formato +506 XXXX-XXXX', 'error');
            return false;
        }

        let user = null;
        if (App.backend && App.backend.enabled) {
            try {
                const result = await App.backend.registerWithPassword({
                    name,
                    email,
                    phone,
                    password,
                    role,
                    businessName,
                    category: businessCategory
                });
                user = result.user;
                if (result.emailConfirmationRequired) {
                    App.toast.show('Cuenta creada. Revisa tu correo para confirmar y luego inicia sesion.', 'info');
                    this.showLogin();
                    return false;
                }
            } catch (err) {
                console.error('Supabase register error:', err);
                App.toast.show(this.mapAuthError(err), 'error');
                return false;
            }
        } else {
            const users = App.store.getList('users');
            if (users.find(u => String(u.email || '').toLowerCase() === email)) {
                App.toast.show('Este email ya esta registrado', 'error');
                return false;
            }
            user = {
                id: App.uid(),
                name,
                email,
                phone,
                password,
                role,
                businessName: role === 'business' ? businessName : '',
                category: role === 'business'
                    ? (typeof App.normalizeBusinessCategory === 'function' ? App.normalizeBusinessCategory(businessCategory) : businessCategory)
                    : '',
                createdAt: new Date().toISOString()
            };
            users.push(user);
            App.store.set('users', users, { skipCloud: true });
        }

        if (role === 'business') {
            const days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
            const schedule = days.map((d, i) => ({ day: d, open: i < 6, start: '09:00', end: '18:00' }));
            App.store.set(user.id + '_schedule', schedule);
            App.store.set(user.id + '_lunch_break', {
                enabled: false,
                start: '13:00',
                duration: 60
            });
            App.store.set(user.id + '_daily_capacity', 20);
            App.store.set(user.id + '_client_daily_limit', 1);
        }

        App.currentUser = user;
        App.store.set('currentUser', user, { skipCloud: true });
        if (App.backend && App.backend.enabled && typeof App.backend.refreshUsersCache === 'function') {
            await App.backend.refreshUsersCache();
        }
        App.toast.show('Cuenta creada exitosamente!', 'success');
        App.showApp();
        return false;
    },

    async logout(options = {}) {
        const reason = options && options.reason ? String(options.reason) : '';
        if (App.session && typeof App.session.stop === 'function') App.session.stop();
        if (App.ui && typeof App.ui.closeMobileProfile === 'function') App.ui.closeMobileProfile();
        if (App.ui && typeof App.ui.closeSidebar === 'function') App.ui.closeSidebar();
        if (App.backend && App.backend.enabled) {
            try {
                await App.backend.signOut();
            } catch (err) {
                console.error('Supabase sign out error:', err);
            }
        }
        App.store.remove('currentUser', { skipCloud: true });
        App.currentUser = null;
        document.getElementById('app-shell').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        this.resetAuthForms();
        this.showLogin();
        if (reason === 'inactivity') {
            App.toast.show('Sesion cerrada por inactividad para proteger tu cuenta', 'warning');
        } else {
            App.toast.show('Sesion cerrada', 'info');
        }
    }
};
