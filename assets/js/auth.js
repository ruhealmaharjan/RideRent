import { api, $, page, bindForm, showAlert, getQueryParameter, escapeHTML } from './main.js';
export const checkLogin = () => api('auth/session');
export async function requireLogin() {
    const session = await checkLogin();
    if (!session.loggedIn) {
        location.href = 'login.html';
        return false;
    }
    return true;
}
export async function logout() {
    await api('auth/logout', { method: 'POST' });
    sessionStorage.removeItem('riderent_return');
    location.href = 'index.html';
}
export function initAuth() {
    const form = $('#page-form');
    if (page === 'login')
        bindForm(form, async (data) => {
            await api('auth/login', { method: 'POST', body: data });
            const next = sessionStorage.getItem('riderent_return');
            sessionStorage.removeItem('riderent_return');
            const allowed =
                /^(booking|booking-confirmation|booking-details|my-bookings|profile|edit-profile|change-password)\.html(?:\?[^#]*)?$/;
            location.href = next && allowed.test(next) ? next : 'index.html';
        });
    if (page === 'register')
        bindForm(form, async (data) => {
            const result = await api('auth/register', { method: 'POST', body: data });
            sessionStorage.setItem('riderent_notice', result.message);
            location.href = 'login.html';
        });
    if (page === 'forgot-password') {
        const token = getQueryParameter('token');
        if (token) {
            history.replaceState(null, '', 'forgot-password.html');
            $('h1').textContent = 'Choose a new password.';
            form.innerHTML =
                '<p>Use at least 8 characters, including one uppercase letter (A-Z), one number, and one special character such as !, @, or #. This reset link can be used once.</p><label>New password<span class="password-field"><input id="reset-password" type="password" name="password" minlength="8" maxlength="72" autocomplete="new-password" required><button type="button" class="password-toggle" data-password="reset-password" aria-label="Show new password">Show</button></span></label><label>Confirm new password<span class="password-field"><input id="reset-confirm" type="password" name="confirm_password" minlength="8" maxlength="72" autocomplete="new-password" required><button type="button" class="password-toggle" data-password="reset-confirm" aria-label="Show confirmation password">Show</button></span></label><button class="button" type="submit">Reset password</button><a href="forgot-password.html">Reset link expired? Request another</a>';
            bindForm(form, async (data) => {
                const result = await api('auth/reset-password', {
                    method: 'POST',
                    body: { ...data, token },
                });
                sessionStorage.setItem('riderent_notice', result.message);
                location.replace('login.html');
            });
        } else
            bindForm(form, async (data) => {
                const result = await api('auth/forgot-password', { method: 'POST', body: data });
                showAlert(result.message);
            });
    }
}
