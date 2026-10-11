'use strict';
(() => {
    const page = document.body.dataset.adminPage;
    if (!page) return;
    const find = (selector) => document.querySelector(selector);
    const navigation = find('.admin-navigation');
    if (navigation) {
        navigation.id = 'admin-navigation';
        const header = find('.admin-header');
        header.classList.add('admin-header-organized');
        const actions = document.createElement('div');
        actions.className = 'admin-header-notifications';
        const logout = find('#admin-logout');
        if (logout) actions.append(logout);
        header.append(actions);
        navigation.replaceChildren();
        const current = location.pathname.split('/').pop();
        const parent =
            {
                'booking-details.html': 'bookings.html',
                'add-vehicle.html': 'vehicles.html',
                'edit-vehicle.html': 'vehicles.html',
                'customer-details.html': 'customers.html',
            }[current] || current;
        function navLink(href, label) {
            const link = document.createElement('a');
            link.href = href;
            link.className = 'admin-section-link';
            link.textContent = label;
            if (href === current) link.setAttribute('aria-current', 'page');
            if (href === parent) link.classList.add('selected');
            return link;
        }
        [
            ['dashboard.html', 'Overview'],
            ['bookings.html', 'Bookings'],
            ['vehicles.html', 'Vehicles'],
            ['customers.html', 'Customers'],
            ['payments.html', 'Payments'],
        ].forEach(([href, label]) => navigation.append(navLink(href, label)));
        const more = document.createElement('details');
        more.className = 'admin-more';
        const summary = document.createElement('summary');
        summary.textContent = 'More';
        const dropdown = document.createElement('div');
        dropdown.className = 'admin-more-links';
        [
            ['profile.html', 'My profile'],
            ['categories.html', 'Vehicle categories'],
            ['reports.html', 'Reports'],
            ['messages.html', 'Rental desk messages'],
            ['reset-user-password.html', 'Reset user password'],
        ].forEach(([href, label]) => {
            dropdown.append(navLink(href, label));
            if (href === current) summary.classList.add('selected');
        });
        more.append(summary, dropdown);
        navigation.append(more);
        document.addEventListener('click', (event) => {
            if (!more.contains(event.target)) more.open = false;
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && more.open) {
                more.open = false;
                summary.focus();
                event.stopImmediatePropagation();
            }
        });
        const menu = document.createElement('button');
        menu.type = 'button';
        menu.className = 'admin-menu-toggle';
        menu.textContent = 'Menu';
        menu.setAttribute('aria-controls', 'admin-navigation');
        menu.setAttribute('aria-expanded', 'false');
        navigation.before(menu);
        menu.onclick = () => {
            const open = navigation.classList.toggle('is-open');
            menu.setAttribute('aria-expanded', String(open));
        };
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
                navigation.classList.remove('is-open');
                menu.setAttribute('aria-expanded', 'false');
                menu.focus();
            }
        });
    }
    let csrf = '';
    function alert(message) {
        const box = find('#admin-alert');
        box.textContent = message;
        box.hidden = false;
        box.focus();
    }
    async function request(endpoint, data, params) {
        const options = { credentials: 'same-origin', headers: { Accept: 'application/json' } };
        if (data !== undefined) {
            options.method = 'POST';
            options.headers['X-CSRF-Token'] = csrf;
            if (data instanceof FormData) {
                options.body = data;
            } else {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(data);
            }
        }
        let response;
        try {
            response = await fetch(
                '../backend/admin/' +
                    endpoint +
                    '.php' +
                    (params ? '?' + new URLSearchParams(params) : ''),
                options,
            );
        } catch {
            throw new Error('Unable to reach RideRent. Check that Apache and MySQL are running.');
        }
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error(
                'The server returned an invalid response. Open this page through XAMPP and check PHP configuration.',
            );
        }
        if (!response.ok || !result.success) {
            const error = new Error(result.message || 'Request failed.');
            error.status = response.status;
            throw error;
        }
        if (result.data.csrfToken) csrf = result.data.csrfToken;
        return result.data;
    }
    if (page !== 'login')
        request('session')
            .then(async (session) => {
                if (session.loggedIn) {
                    const { initNotifications } = await import('./notifications.js');
                    const header = find('.admin-header');
                    if (header) {
                        let notifications = header.querySelector('.admin-header-notifications');
                        if (!notifications) {
                            notifications = document.createElement('div');
                            notifications.className = 'admin-header-notifications';
                            header.append(notifications);
                        }
                        header.classList.add('has-notifications');
                        initNotifications({ host: notifications, admin: true });
                    }
                }
            })
            .catch(() => {});
    const money = (value) =>
        new Intl.NumberFormat('en-NP', {
            style: 'currency',
            currency: 'NPR',
            maximumFractionDigits: 2,
        }).format(Number(value));
    function date(value) {
        return new Date(String(value).replace(' ', 'T')).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    }
    function rows(target, data, columns) {
        const body = find(target);
        body.replaceChildren();
        if (!data.length) {
            const row = body.insertRow();
            const cell = row.insertCell();
            cell.colSpan = columns.length;
            cell.textContent = 'No records yet.';
            return;
        }
        data.forEach((item) => {
            const row = body.insertRow();
            columns.forEach((get) => {
                row.insertCell().textContent = String(get(item) ?? '—');
            });
        });
    }
    if (page.startsWith('manage-')) {
        import('./admin-management.js')
            .then((m) => m.initManagement({ page: page.slice(7), request, alert }))
            .catch((e) => alert(e.message));
        return;
    }
    if (['fleet', 'add-vehicle', 'edit-vehicle'].includes(page)) {
        import('./admin-vehicles.js')
            .then((m) => m.initFleet({ page, request, alert }))
            .catch((error) => alert(error.message));
        return;
    }
    if (page === 'login') {
        const form = find('#admin-login');
        const submit = form.querySelector('[type=submit]');
        find('#toggle-password').onclick = () => {
            const input = find('#password');
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            const button = find('#toggle-password');
            button.textContent = show ? 'Hide' : 'Show';
            button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
            button.setAttribute('aria-pressed', String(show));
        };
        let submitting = false;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (submitting || !form.reportValidity()) return;
            submitting = true;
            submit.disabled = true;
            submit.textContent = 'Signing in…';
            find('#admin-alert').hidden = true;
            try {
                await request('session');
                await request('login', {
                    email: form.elements.email.value,
                    password: form.elements.password.value,
                });
                location.replace('dashboard.html');
            } catch (error) {
                alert(error.message);
            } finally {
                submitting = false;
                submit.disabled = false;
                submit.textContent = 'Sign in';
            }
        });
        request('session')
            .then((session) => {
                if (session.loggedIn && !submitting) location.replace('dashboard.html');
            })
            .catch((error) => alert(error.message));
    } else if (page === 'messages') {
        let messagePage = 1;
        async function loadMessages() {
            const result = await request('messages/get-messages', undefined, {
                page: messagePage,
                limit: 10,
            });
            const list = find('#message-list');
            list.replaceChildren();
            if (!result.messages.length)
                list.textContent =
                    'No messages yet. Messages submitted from the Contact page will appear here.';
            result.messages.forEach((message) => {
                const card = document.createElement('article');
                card.className = 'panel';
                const heading = document.createElement('h2');
                heading.textContent = message.subject;
                const sender = document.createElement('p');
                sender.textContent = message.name + ' | ' + message.email + ' | ' + message.phone;
                const content = document.createElement('p');
                content.textContent = message.message;
                content.style.whiteSpace = 'pre-wrap';
                const status = document.createElement('p');
                status.textContent =
                    (Number(message.is_read) ? 'Read' : 'Unread') +
                    ' | ' +
                    date(message.created_at);
                card.append(heading, sender, content, status);
                if (!Number(message.is_read)) {
                    const button = document.createElement('button');
                    button.className = 'button small secondary';
                    button.textContent = 'Mark read';
                    button.onclick = async () => {
                        button.disabled = true;
                        try {
                            await request('messages/mark-read', { message_id: message.message_id });
                            await loadMessages();
                        } catch (error) {
                            alert(error.message);
                            button.disabled = false;
                        }
                    };
                    card.append(button);
                }
                list.append(card);
            });
            messagePage = result.pagination.page;
            find('#messages-page').textContent =
                'Page ' + messagePage + ' of ' + result.pagination.pages;
            find('#messages-prev').disabled = messagePage <= 1;
            find('#messages-next').disabled = messagePage >= result.pagination.pages;
        }
        (async () => {
            try {
                const session = await request('session');
                if (!session.loggedIn) {
                    location.replace('login.html');
                    return;
                }
                find('#admin-welcome').textContent = 'Messages from the customer Contact form.';
                const logout = find('#admin-logout');
                logout.disabled = false;
                logout.onclick = async () => {
                    try {
                        await request('logout', {});
                        location.replace('login.html');
                    } catch (error) {
                        alert(error.message);
                    }
                };
                find('#messages-prev').onclick = async () => {
                    messagePage--;
                    try {
                        await loadMessages();
                    } catch (error) {
                        alert(error.message);
                    }
                };
                find('#messages-next').onclick = async () => {
                    messagePage++;
                    try {
                        await loadMessages();
                    } catch (error) {
                        alert(error.message);
                    }
                };
                await loadMessages();
                find('#admin-loading').hidden = true;
                find('#dashboard-content').hidden = false;
            } catch (error) {
                find('#admin-loading').hidden = true;
                if (error.status === 401) location.replace('login.html');
                else alert(error.message);
            }
        })();
    } else if (page === 'dashboard' || page === 'bookings' || page === 'reset-password') {
        const logout = find('#admin-logout');
        logout.onclick = async () => {
            logout.disabled = true;
            try {
                await request('logout', {});
                location.replace('login.html');
            } catch (error) {
                if (error.status === 401) location.replace('login.html');
                else {
                    alert(error.message);
                    logout.disabled = false;
                }
            }
        };
        let currentPage = 1;
        if (page === 'bookings') {
            const target = new URLSearchParams(location.search).get('id');
            if (/^\d+$/.test(target || '')) find('#booking-search').value = target;
        }
        let loadingSequence = 0;
        async function getBookings() {
            const query = new URLSearchParams({
                page: String(currentPage),
                limit: '20',
                status: find('#booking-status').value,
                q: find('#booking-search').value.trim(),
            });
            const response = await fetch('../backend/admin/bookings/get-bookings.php?' + query, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                const error = new Error(result.message || 'Unable to load bookings.');
                error.status = response.status;
                throw error;
            }
            return result.data;
        }
        function bookingRows(bookings) {
            rows('#recent-bookings', bookings, [
                (b) => b.booking_reference || String(b.booking_id),
                (b) => b.full_name,
                (b) => b.vehicle_name,
                (b) => date(b.pickup_date),
                (b) => date(b.return_date),
                (b) => money(b.total_amount),
                (b) => b.booking_status,
                (b) => b.payment_status,
            ]);
            if (!bookings.length) {
                find('#recent-bookings td').colSpan = 9;
                return;
            }
            bookings.forEach((booking, index) => {
                const first = find('#recent-bookings').rows[index].cells[0];
                const link = document.createElement('a');
                link.href = 'booking-details.html?id=' + booking.booking_id;
                link.textContent = first.textContent;
                first.replaceChildren(link);
                const cell = find('#recent-bookings').rows[index].insertCell();
                const actions =
                    booking.booking_status === 'Pending'
                        ? [
                              ['Approve', 'Confirmed'],
                              ['Cancel', 'Cancelled'],
                          ]
                        : booking.booking_status === 'Confirmed'
                          ? [
                                ['Complete', 'Completed'],
                                ['Cancel', 'Cancelled'],
                            ]
                          : [];
                const canPay =
                    booking.booking_status !== 'Cancelled' &&
                    ['Pending', 'Failed'].includes(booking.payment_status);
                if (!actions.length && !canPay) {
                    cell.textContent =
                        booking.payment_status === 'Paid' ? 'Payment received' : '—';
                    return;
                }
                const box = document.createElement('div');
                box.className = 'booking-actions';
                cell.append(box);
                actions.forEach(([label, status]) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.textContent = label;
                    button.className =
                        'button small' + (status === 'Cancelled' ? ' secondary' : '');
                    button.setAttribute(
                        'aria-label',
                        label + ' booking ' + (booking.booking_reference || booking.booking_id),
                    );
                    button.onclick = async () => {
                        if (
                            !confirm(
                                `${label} booking #${booking.booking_reference || booking.booking_id} for ${booking.vehicle_name}?`,
                            )
                        )
                            return;
                        box.querySelectorAll('button').forEach((b) => (b.disabled = true));
                        try {
                            await request('bookings/update-status', {
                                booking_id: booking.booking_id,
                                booking_status: status,
                            });
                            if (page !== 'reset-password') await load();
                            alert(
                                `Booking #${booking.booking_reference || booking.booking_id} ${status === 'Confirmed' ? 'approved' : 'cancelled'} successfully.`,
                            );
                        } catch (error) {
                            if (error.status === 401) {
                                location.replace('login.html');
                                return;
                            }
                            alert(error.message);
                            box.querySelectorAll('button').forEach((b) => (b.disabled = false));
                        }
                    };
                    box.append(button);
                });
                if (canPay) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'button small';
                    button.textContent = 'Payment done';
                    button.setAttribute(
                        'aria-label',
                        'Payment done for booking ' + booking.booking_reference,
                    );
                    button.onclick = async () => {
                        if (
                            !confirm(
                                `Confirm that payment has been received for booking #${booking.booking_reference || booking.booking_id}? This records a payment; it does not charge the customer.`,
                            )
                        )
                            return;
                        box.querySelectorAll('button').forEach((b) => (b.disabled = true));
                        try {
                            const details = await request('bookings/get-booking', undefined, {
                                id: booking.booking_id,
                            });
                            const record = details.booking;
                            const cents = (amount) => Math.round(Number(amount) * 100);
                            const paid = record.payments
                                .filter((p) => p.payment_status === 'Paid')
                                .reduce((sum, p) => sum + cents(p.amount), 0);
                            const outstanding = cents(record.total_amount) - paid;
                            if (outstanding > 0) {
                                const payment = record.payments.find(
                                    (p) =>
                                        ['Pending', 'Failed'].includes(p.payment_status) &&
                                        cents(p.amount) === outstanding,
                                );
                                if (!payment)
                                    throw new Error(
                                        'No single unpaid payment record matches the outstanding balance. Review the payment records before marking this booking paid.',
                                    );
                                await request('payments/update-payment', {
                                    payment_id: payment.payment_id,
                                    payment_status: 'Paid',
                                });
                            }
                            if (page !== 'reset-password') await load();
                            alert(
                                `Payment recorded for booking #${booking.booking_reference || booking.booking_id}. Recorded revenue is up to date.`,
                            );
                        } catch (error) {
                            if (error.status === 401) {
                                location.replace('login.html');
                                return;
                            }
                            alert(error.message);
                            box.querySelectorAll('button').forEach((b) => (b.disabled = false));
                        }
                    };
                    box.append(button);
                }
            });
        }
        async function load() {
            const sequence = ++loadingSequence;
            if (page === 'bookings') {
                const result = await getBookings();
                if (sequence !== loadingSequence) return;
                bookingRows(result.bookings);
                currentPage = result.pagination.page;
                find('#booking-count').textContent =
                    `${result.pagination.total} bookings Â· Page ${currentPage} of ${result.pagination.pages}`;
                find('#previous-page').disabled = currentPage <= 1;
                find('#next-page').disabled = currentPage >= result.pagination.pages;
                return;
            }
            const dashboard = await request('dashboard');
            if (sequence !== loadingSequence) return;
            const labels = {
                total_vehicles: 'Total vehicles',
                available_vehicles: 'Available fleet',
                customers: 'Customers',
                total_bookings: 'Total bookings',
                pending_bookings: 'Pending bookings',
                confirmed_bookings: 'Confirmed bookings',
                completed_rentals: 'Completed rentals',
                revenue: 'Recorded revenue',
            };
            const container = find('#admin-stats');
            container.replaceChildren();
            Object.entries(labels).forEach(([key, label]) => {
                const card = document.createElement('article');
                card.className = 'admin-stat';
                card.dataset.metric = key;
                const title = document.createElement('span');
                title.textContent = label;
                const value = document.createElement('strong');
                value.textContent =
                    key === 'revenue'
                        ? money(dashboard.statistics[key])
                        : String(dashboard.statistics[key]);
                card.append(title, value);
                container.append(card);
            });
            bookingRows(dashboard.recent_bookings);
            const updated = find('#dashboard-updated');
            if (updated)
                updated.textContent =
                    'Updated ' +
                    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(
                        new Date(),
                    );
            find('#recent-bookings')
                .querySelectorAll('tr')
                .forEach((row) => {
                    if (row.cells.length < 8) return;
                    for (const index of [6, 7]) {
                        const cell = row.cells[index];
                        const status = cell.textContent;
                        const badge = document.createElement('span');
                        badge.className = 'dashboard-status';
                        badge.dataset.status = status.toLowerCase();
                        badge.textContent = status;
                        cell.replaceChildren(badge);
                    }
                });
            rows('#recent-users', dashboard.recent_users, [
                (u) => u.full_name,
                (u) => u.email,
                (u) => date(u.created_at),
            ]);
        }
        async function refresh() {
            try {
                await load();
            } catch (error) {
                if (error.status === 401) location.replace('login.html');
                else alert(error.message);
            }
        }
        (async () => {
            try {
                const session = await request('session');
                if (!session.loggedIn) {
                    location.replace('login.html');
                    return;
                }
                logout.disabled = false;
                const refreshButton = find('#refresh-dashboard');
                if (refreshButton)
                    refreshButton.onclick = async () => {
                        refreshButton.disabled = true;
                        refreshButton.textContent = 'Refreshing…';
                        try {
                            await refresh();
                        } finally {
                            refreshButton.disabled = false;
                            refreshButton.textContent = 'Refresh data';
                        }
                    };
                if (page === 'reset-password') {
                    const resetForm = find('#customer-reset-form');
                    if (resetForm) {
                        resetForm.onsubmit = async (event) => {
                            event.preventDefault();
                            if (!resetForm.reportValidity()) return;
                            const button = resetForm.querySelector('[type=submit]');
                            button.disabled = true;
                            find('#reset-link-result').hidden = true;
                            find('#customer-reset-link').value = '';
                            try {
                                const result = await request('customers/create-reset-link', {
                                    email: find('#reset-customer-email').value,
                                    identity_verified: find('#reset-identity-verified').checked,
                                });
                                find('#customer-reset-link').value = new URL(
                                    '../' + result.reset_path,
                                    location.href,
                                ).href;
                                find('#reset-link-description').textContent =
                                    'Reset link for ' +
                                    result.customer.full_name +
                                    ' (' +
                                    result.customer.email +
                                    '). Valid for 30 minutes; any older reset link is invalid.';
                                find('#reset-copy-status').textContent = '';
                                find('#reset-link-result').hidden = false;
                                find('#reset-identity-verified').checked = false;
                            } catch (error) {
                                if (error.status === 401) location.replace('login.html');
                                else alert(error.message);
                            } finally {
                                button.disabled = false;
                            }
                        };
                        find('#copy-reset-link').onclick = async () => {
                            const input = find('#customer-reset-link');
                            try {
                                await navigator.clipboard.writeText(input.value);
                                find('#reset-copy-status').textContent =
                                    'Link copied. Share it privately with the customer.';
                            } catch {
                                input.focus();
                                input.select();
                                find('#reset-copy-status').textContent =
                                    'Press Ctrl+C to copy the selected link.';
                            }
                        };
                    }
                }
                find('#admin-welcome').textContent = 'Signed in as ' + session.admin.name + '.';
                if (page === 'bookings') {
                    find('#booking-filters').onsubmit = (event) => {
                        event.preventDefault();
                        currentPage = 1;
                        refresh();
                    };
                    find('#previous-page').onclick = () => {
                        currentPage = Math.max(1, currentPage - 1);
                        refresh();
                    };
                    find('#next-page').onclick = () => {
                        currentPage++;
                        refresh();
                    };
                }
                if (page !== 'reset-password') await load();
                find('#admin-loading').hidden = true;
                find('#dashboard-content').hidden = false;
            } catch (error) {
                find('#admin-loading').hidden = true;
                if (error.status === 401) location.replace('login.html');
                else alert(error.message);
            }
        })();
    }
})();
