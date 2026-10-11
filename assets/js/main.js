import { initNotifications } from './notifications.js';
import { initAuth, checkLogin, logout } from './auth.js';
import { initVehicles } from './vehicles.js';
import { initBooking } from './booking.js';
import { initProfile } from './profile.js';

export const page = document.body.dataset.page;
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const escapeHTML = (value) =>
    String(value ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
export const formatCurrency = (value) =>
    new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency: 'NPR',
        maximumFractionDigits: 2,
    }).format(Number(value));
export function formatDate(value) {
    if (!value) return '—';
    const date = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(date.getTime())
        ? '—'
        : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const getQueryParameter = (name) => new URLSearchParams(location.search).get(name);
export const calculateRentalDays = (pickup, returned) =>
    Math.round((Date.parse(returned) - Date.parse(pickup)) / 86400000);
export function today() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kathmandu',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}
export function imagePath(path) {
    return /^assets\/images\/vehicles\/[a-zA-Z0-9_.-]+\.(svg|png|jpe?g|webp)$/.test(path || '')
        ? path
        : 'assets/images/vehicles/car.svg';
}
export function showAlert(message, type = 'success') {
    const box = $('#alert');
    box.replaceChildren();
    box.className = 'alert ' + type;
    const text = document.createElement('span');
    text.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dismiss message');
    close.onclick = hideAlert;
    box.append(text, close);
    box.hidden = false;
    box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
export function hideAlert() {
    $('#alert').hidden = true;
}
let csrf = '';
export async function api(path, options = {}) {
    const headers = { Accept: 'application/json', ...options.headers };
    if (options.method && options.method !== 'GET') {
        if (!csrf) {
            const session = await api('auth/session');
            csrf = session.csrfToken;
        }
        headers['X-CSRF-Token'] = csrf;
        if (!(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body || {});
        }
    }
    let response;
    try {
        response = await fetch(`backend/${path}.php`, {
            credentials: 'same-origin',
            ...options,
            headers,
        });
    } catch {
        throw new Error(
            'Cannot reach the server. Open RideRent through XAMPP and check that Apache is running.',
        );
    }
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error(
            'The server did not return JSON. Use the XAMPP URL and check the PHP configuration.',
        );
    }
    if (!response.ok || !result.success) {
        const error = new Error(result.message || 'Request failed.');
        error.status = response.status;
        throw error;
    }
    if (result.data?.csrfToken) csrf = result.data.csrfToken;
    return { ...result.data, message: result.message };
}
export async function getApi(path, params = {}, options = {}) {
    const url = new URL(`backend/${path}.php`, location.href);
    for (const [key, value] of Object.entries(params))
        if (value !== '' && value != null) url.searchParams.set(key, value);
    let response;
    try {
        response = await fetch(url, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
            signal: options.signal,
            cache: 'no-store',
        });
    } catch {
        throw new Error('Cannot reach the rental server. Check Apache and your connection.');
    }
    let result;
    try {
        result = await response.json();
    } catch {
        throw new Error('Start Apache and open RideRent using its localhost URL.');
    }
    if (!response.ok || !result.success) {
        const error = new Error(result.message || 'Request failed.');
        error.status = response.status;
        throw error;
    }
    return result.data;
}
export function formData(form) {
    return Object.fromEntries(new FormData(form));
}
export function bindForm(form, handler) {
    if (!form) return;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideAlert();
        const data = formData(form);
        const password = data.new_password ?? data.password;
        if (
            data.confirm_password !== undefined &&
            (Array.from(password || '').length < 8 ||
                !/[A-Z]/.test(password) ||
                !/[0-9]/.test(password) ||
                !/[\p{P}\p{S}]/u.test(password))
        ) {
            showAlert(
                'Password must have at least 8 characters, one uppercase letter (A-Z), one number, and one special character (such as !, @, or #).',
                'error',
            );
            return;
        }
        if (data.confirm_password !== undefined && new TextEncoder().encode(password).length > 72) {
            showAlert('Password must not exceed 72 bytes.', 'error');
            return;
        }
        if (data.confirm_password !== undefined && password !== data.confirm_password) {
            showAlert('Passwords do not match.', 'error');
            return;
        }
        if (!form.reportValidity()) return;
        const button = $('[type=submit]', form);
        if (button.disabled) return;
        button.disabled = true;
        try {
            await handler(data, form);
        } catch (error) {
            showAlert(error.message, 'error');
        } finally {
            button.disabled = false;
        }
    });
}
export function statusBadge(value) {
    const known = [
        'Pending',
        'Confirmed',
        'Completed',
        'Cancelled',
        'Paid',
        'Failed',
        'Refunded',
        'Available',
        'Maintenance',
        'Unavailable',
    ];
    const status = known.includes(value) ? value : 'Unknown';
    return `<span class="badge ${status.toLowerCase()}">${escapeHTML(status)}</span>`;
}

function navigation() {
    const links = [
        ['index', 'Home'],
        ['vehicles', 'Vehicles'],
        ['compare', 'Compare'],
        ['about', 'About'],
        ['faq', 'FAQ'],
        ['contact', 'Contact'],
    ];
    $('#site-header').innerHTML =
        `<nav class="site-nav" aria-label="Main navigation"><a class="logo" href="index.html">Ride<span>Rent</span></a><button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links nav-account">Menu</button><div id="nav-links" class="nav-links">${links.map(([href, title]) => `<a href="${href}.html" ${page === href ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</div><div id="nav-account" class="nav-account"><a href="login.html">Log in</a><a class="button" href="register.html">Get started</a></div></nav>`;
    $('#site-footer').innerHTML =
        `<div class="footer-inner"><div><a class="logo" href="index.html">Ride<span>Rent</span></a><p>The right ride for wherever life takes you.<br>Explore. Book. Enjoy the journey.</p></div><div><h3>Explore</h3><a href="vehicles.html">Our vehicles</a><a href="about.html">About RideRent</a><a href="faq.html">Questions & answers</a><a href="contact.html">Contact us</a></div><div><h3>Your journey</h3><a href="my-bookings.html">My bookings</a><a href="profile.html">My account</a><a href="terms.html">Rental terms</a><a href="privacy.html">Privacy</a><a href="photo-credits.html">Photo credits &amp; fleet sources</a></div><div><h3><a href="contact.html">Rental desk · demo</a></h3><p>Kathmandu, Nepal<br>hello@riderent.example<br>Sun–Fri · 9:00–18:00</p><p>Social channels coming soon</p></div></div><div class="footer-bottom">© ${new Date().getFullYear()} RideRent. BCA semester project.</div>`;
    $('.nav-toggle').onclick = () => {
        const open = $('.site-nav').classList.toggle('open');
        $('.nav-toggle').setAttribute('aria-expanded', String(open));
    };
}
export function setAccount(session) {
    if (!session.loggedIn) return;
    $('#nav-account').innerHTML =
        '<a href="my-bookings.html">My bookings</a><a class="button small secondary nav-like" href="favorites.html" aria-label="View liked vehicles"><span aria-hidden="true">♡</span></a><a href="profile.html">Profile</a><button class="button small" id="logout" type="button">Log out</button>';
    initNotifications({ host: $('#nav-account') });
    document.querySelectorAll('#nav-account a').forEach((link) => {
        if (link.getAttribute('href') === page + '.html') link.setAttribute('aria-current', 'page');
    });
    $('#logout').onclick = () => logout().catch((error) => showAlert(error.message, 'error'));
}
function interactions() {
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && $('.site-nav')?.classList.contains('open')) {
            $('.site-nav').classList.remove('open');
            $('.nav-toggle').setAttribute('aria-expanded', 'false');
            $('.nav-toggle').focus();
        }
    });
    document.addEventListener('click', (event) => {
        const toggle = event.target.closest('[data-password]');
        if (toggle) {
            const input = document.getElementById(toggle.dataset.password);
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            toggle.textContent = show ? 'Hide' : 'Show';
            toggle.setAttribute('aria-pressed', String(show));
            toggle.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`);
        }
        const question = event.target.closest('.faq-question');
        if (question) {
            const open = question.getAttribute('aria-expanded') === 'true';
            question.setAttribute('aria-expanded', String(!open));
            document.getElementById(question.getAttribute('aria-controls')).hidden = open;
            $('span', question).textContent = open ? '+' : '−';
        }
    });
}
async function init() {
    navigation();
    interactions();
    const notice = sessionStorage.getItem('riderent_notice');
    if (notice) {
        showAlert(notice);
        sessionStorage.removeItem('riderent_notice');
    }
    const protectedPages = [
        'booking',
        'booking-confirmation',
        'my-bookings',
        'booking-details',
        'profile',
        'edit-profile',
        'change-password',
        'favorites',
    ];
    try {
        const session = await checkLogin();
        setAccount(session);
        if (protectedPages.includes(page) && !session.loggedIn) {
            sessionStorage.setItem(
                'riderent_return',
                location.pathname.split('/').pop() + location.search,
            );
            location.href = 'login.html';
            return;
        }
        if (page === 'register' && session.loggedIn) {
            location.href = 'index.html';
            return;
        }
    } catch (error) {
        if (protectedPages.includes(page)) {
            showAlert(error.message, 'error');
            return;
        }
    }
    initAuth();
    await initProfile();
    try {
        await initVehicles();
        await initBooking();
    } catch (error) {
        showAlert(error.message, 'error');
    }
    if (page === 'contact')
        bindForm($('#page-form'), async (data, form) => {
            const result = await api('contact/submit-message', { method: 'POST', body: data });
            form.reset();
            showAlert(result.message);
        });
    if (page === 'about') {
        try {
            const stats = await api('public/stats');
            $('#stats').innerHTML = [
                ['vehicles', 'Vehicles'],
                ['compare', 'Compare'],
                ['customers', 'Registered customers'],
                ['rentals', 'Completed rentals'],
            ]
                .map(
                    ([key, label]) =>
                        `<div class="stat"><strong>${Number(stats[key])}</strong><span>${label}</span></div>`,
                )
                .join('');
        } catch (error) {
            $('#stats').textContent = 'Statistics are unavailable until the database is connected.';
        }
    }
}
init();
