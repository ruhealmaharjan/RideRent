import { $, page, api, bindForm, escapeHTML as e, formatDate, showAlert } from './main.js';
export async function initProfile() {
    if (page === 'change-password')
        bindForm($('#page-form'), async (data, form) => {
            const result = await api('auth/change-password', { method: 'POST', body: data });
            form.reset();
            showAlert(result.message);
        });
    if (!['profile', 'edit-profile'].includes(page)) return;
    try {
        const { user } = await api('users/get-profile');
        if (page === 'profile') {
            const initials = user.full_name
                .trim()
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase();
            $('#profile-details').innerHTML =
                `<div class="profile-cover"><span>MADE FOR YOUR NEXT JOURNEY</span></div><div class="profile-layout"><aside class="profile-identity"><div class="profile-initials" aria-hidden="true">${e(initials)}</div><span class="eyebrow">RIDErent MEMBER</span><h2>${e(user.full_name)}</h2><p class="profile-email">${e(user.email)}</p><p class="profile-since">Member since ${formatDate(user.created_at)}</p><a class="button" href="edit-profile.html">Edit profile</a><a class="button secondary" href="my-bookings.html">My bookings</a></aside><div class="profile-main"><div class="profile-summary"><div><span class="eyebrow">YOUR JOURNEYS</span><strong>${Number(user.booking_count) || 0}</strong><span>Total bookings</span></div><div><h3>Ready for your next ride?</h3><p>Explore the fleet and find a vehicle that fits your plans.</p><a href="vehicles.html">Browse vehicles</a></div></div><section class="profile-information"><div class="section-title"><h2>Personal information</h2><a href="edit-profile.html">Edit details</a></div><dl class="profile-fields">${[
                    ['Full name', user.full_name],
                    ['Email address', user.email],
                    ['Phone number', user.phone],
                    ['Driving licence', user.driving_license],
                    ['Address', user.address],
                ]
                    .map(
                        ([label, value]) =>
                            `<div><dt>${label}</dt><dd>${e(value || 'Not provided')}</dd></div>`,
                    )
                    .join(
                        '',
                    )}</dl></section><section class="profile-security"><div><h3>Account security</h3><p>Manage the password you use to sign in.</p></div><a class="button small secondary" href="change-password.html">Change password</a></section><section class="profile-security profile-danger"><div><h3>Delete account</h3><p>Permanently remove your profile and sign-in access.</p></div><button class="button small secondary" id="show-delete-account" type="button">Delete account</button></section><form id="delete-account-form" class="panel form-grid" hidden><h3>Confirm account deletion</h3><p>Your personal profile, reviews and saved sign-in tokens will be removed. Historical booking and payment records remain under “Deleted customer”. Pending and confirmed rentals must be resolved first. This cannot be undone.</p><label>Current password<input type="password" name="current_password" autocomplete="current-password" required></label><label>Type DELETE to confirm<input name="confirmation" autocomplete="off" pattern="DELETE" required></label><div class="actions"><button class="button" type="submit">Permanently delete account</button><button class="button secondary" id="cancel-delete-account" type="button">Keep my account</button></div></form></div></div>`;
            const deletion = $('#delete-account-form');
            $('#show-delete-account').onclick = () => {
                deletion.hidden = false;
                deletion.elements.current_password.focus();
            };
            $('#cancel-delete-account').onclick = () => {
                deletion.reset();
                deletion.hidden = true;
                $('#show-delete-account').focus();
            };
            bindForm(deletion, async (data) => {
                const result = await api('users/delete-account', { method: 'POST', body: data });
                sessionStorage.clear();
                sessionStorage.setItem('riderent_notice', result.message);
                location.replace('index.html');
            });
        } else {
            const form = $('#page-form');
            for (const key of ['full_name', 'phone', 'address', 'driving_license'])
                form.elements[key].value = user[key] || '';
            bindForm(form, async (data) => {
                const result = await api('users/update-profile', { method: 'POST', body: data });
                sessionStorage.setItem('riderent_notice', result.message);
                location.href = 'profile.html';
            });
        }
    } catch (error) {
        if (page === 'profile')
            $('#profile-details').textContent =
                'Your profile could not be loaded. Refresh the page to try again.';
        showAlert(error.message, 'error');
    }
}
