import {
    $,
    $$,
    page,
    getApi,
    api,
    getQueryParameter,
    escapeHTML as e,
    formatCurrency as money,
    formatDate,
    imagePath,
    statusBadge,
    bindForm,
    showAlert,
} from './main.js';
function bookingProgress(status, paymentStatus) {
    const steps = ['Pending', 'Confirmed', 'Completed'];
    const descriptions = [
        'Awaiting administrator approval.',
        'Your booking is approved.',
        'Your rental is complete.',
    ];
    if (status === 'Cancelled')
        return '<section class="booking-progress cancelled" aria-label="Booking progress"><h3>Booking cancelled</h3><p>This booking is closed and will not proceed to pickup. Check payment records separately for payment or refund status.</p></section>';
    const displayStatus = status;
    const current = steps.indexOf(displayStatus);
    if (current < 0)
        return '<section class="booking-progress"><h3>Booking progress</h3><p>Status unavailable. Please refresh this page.</p></section>';
    return `<section class="booking-progress" aria-label="Booking progress: ${displayStatus}"><div class="progress-heading"><h3>Booking progress</h3><span>Step ${current + 1} of 3</span></div><ol>${steps.map((step, index) => `<li class="${index < current ? 'passed' : index === current ? ((status === 'Confirmed' && paymentStatus === 'Paid') || status === 'Completed' ? 'passed current' : 'current') : 'upcoming'}" ${index === current ? 'aria-current="step"' : ''}><span class="progress-dot" aria-hidden="true">${index < current || (index === current && ((status === 'Confirmed' && paymentStatus === 'Paid') || status === 'Completed')) ? '✓' : index + 1}</span><span>${step}</span></li>`).join('')}</ol><p>${status === 'Confirmed' && paymentStatus === 'Paid' ? 'Payment received. Your booking is confirmed.' : descriptions[current]}</p></section>`;
}
function reviewAction(b) {
    if (!['Confirmed', 'Completed'].includes(b.booking_status)) return '';
    return `<a class="button small secondary" href="vehicle-details.html?id=${Number(b.vehicle_id)}&review_booking=${Number(b.booking_id)}#vehicle-reviews">${Number(b.reviewed) ? 'View reviews' : 'Write a review'}</a>`;
}
function summary(b) {
    return `<div class="summary-vehicle"><img src="${e(imagePath(b.image))}" alt="${e(b.vehicle_name)}"><div><h2>${e(b.vehicle_name)}</h2><p>${e(b.brand || '')} ${e(b.model || '')}</p></div></div><dl><dt>Pickup</dt><dd>${formatDate(b.pickup_date)}</dd><dt>Return</dt><dd>${formatDate(b.return_date)}</dd><dt>Rental days</dt><dd>${Number(b.total_days)}</dd><dt>Daily rate</dt><dd>${money(b.price_per_day)}</dd></dl><p class="total-line"><span>Total</span><strong>${money(b.total_amount)}</strong></p>`;
}
async function cancel(id) {
    if (!confirm('Cancel this booking? The rental record will be kept.')) return false;
    const result = await api('bookings/cancel-booking', {
        method: 'POST',
        body: { booking_id: id },
    });
    showAlert(result.message);
    return true;
}
function bookingRecovery(params, message) {
    $('#confirm-booking').hidden = true;
    const box = $('#booking-summary');
    box.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Choose another date or vehicle';
    const explanation = document.createElement('p');
    explanation.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const edit = document.createElement('a');
    edit.className = 'button';
    edit.textContent = 'Change dates';
    edit.href =
        'vehicle-details.html?' +
        new URLSearchParams({
            id: params.vehicle_id || '',
            pickup_date: params.pickup_date || '',
            return_date: params.return_date || '',
        });
    const browse = document.createElement('a');
    browse.className = 'button secondary';
    browse.textContent = 'Find available vehicles';
    browse.href =
        'vehicles.html?' +
        new URLSearchParams({
            pickup_date: params.pickup_date || '',
            return_date: params.return_date || '',
        });
    actions.append(edit, browse);
    box.append(heading, explanation, actions);
}
async function bookingPage() {
    const params = {
        vehicle_id: getQueryParameter('vehicle_id'),
        pickup_date: getQueryParameter('pickup_date'),
        return_date: getQueryParameter('return_date'),
    };
    try {
        const [{ vehicle }, availability] = await Promise.all([
            getApi('vehicles/get-vehicle', { id: params.vehicle_id }),
            getApi('vehicles/check-availability', params),
        ]);
        $('#booking-summary').innerHTML = summary({ ...vehicle, ...params, ...availability });
        if (typeof availability?.available !== 'boolean')
            throw new Error(
                'The availability response could not be read. Refresh this page and try again.',
            );
        if (availability.available === false) {
            bookingRecovery(
                params,
                vehicle.availability_status === 'Available'
                    ? 'This vehicle already has a reservation overlapping your selected dates. Choose different dates or view other available vehicles.'
                    : 'This vehicle is currently unavailable for rental. Choose another vehicle.',
            );
            return;
        }
        $('#confirm-booking button').disabled = false;
        bindForm($('#confirm-booking'), async () => {
            try {
                const result = await api('bookings/create-booking', {
                    method: 'POST',
                    body: params,
                });
                location.href = `booking-confirmation.html?id=${result.booking_id}`;
            } catch (error) {
                if (error.status === 409) {
                    bookingRecovery(params, error.message);
                    return;
                }
                throw error;
            }
        });
    } catch (error) {
        $('#booking-summary').textContent = error.message;
        throw error;
    }
}
async function detailPage() {
    const id = getQueryParameter('id');
    try {
        const { booking: b } = await getApi('bookings/get-booking', { id });
        $('#booking-detail').innerHTML =
            `<p class="eyebrow">BOOKING ${e(b.booking_reference || String(b.booking_id))}</p>${bookingProgress(b.booking_status, b.payment_status)}${summary(b)}<dl><dt>Booking status</dt><dd>${statusBadge(b.booking_status)}</dd><dt>Payment status</dt><dd>${statusBadge(b.payment_status)}</dd><dt>Customer</dt><dd>${e(b.full_name)}</dd><dt>Email</dt><dd>${e(b.email)}</dd><dt>Phone</dt><dd>${e(b.phone)}</dd><dt>Address</dt><dd>${e(b.address)}</dd><dt>Created</dt><dd>${formatDate(b.created_at)}</dd></dl><h3>Payment records</h3><div class="table-wrap"><table><thead><tr><th>Method</th><th>Amount</th><th>Status</th><th>Reference</th><th>Date</th></tr></thead><tbody>${b.payments.map((p) => `<tr><td>${e(p.payment_method)}</td><td>${money(p.amount)}</td><td>${statusBadge(p.payment_status)}</td><td>${e(p.transaction_reference || '—')}</td><td>${formatDate(p.payment_date)}</td></tr>`).join('')}</tbody></table></div>${['Pending', 'Confirmed'].includes(b.booking_status) ? '<button class="button secondary" id="cancel-booking" type="button">Cancel booking</button>' : ''}${reviewAction(b)}`;
        if ($('#cancel-booking'))
            $('#cancel-booking').onclick = async (event) => {
                event.target.disabled = true;
                try {
                    if (await cancel(id)) await detailPage();
                } catch (error) {
                    showAlert(error.message, 'error');
                } finally {
                    event.target.disabled = false;
                }
            };
    } catch (error) {
        $('#booking-detail').textContent = 'Booking not found or unavailable.';
        throw error;
    }
}
async function list(status = '') {
    const { bookings } = await getApi('bookings/get-bookings', { status });
    $('#bookings-list').innerHTML = bookings.length
        ? bookings
              .map(
                  (b) =>
                      `<article class="booking-card"><img src="${e(imagePath(b.image))}" alt="${e(b.vehicle_name)}"><div class="booking-card-content"><span class="eyebrow">BOOKING ${e(b.booking_reference || String(b.booking_id))}</span><h3>${e(b.vehicle_name)}</h3><p>${formatDate(b.pickup_date)} to ${formatDate(b.return_date)} · ${money(b.total_amount)}</p>${statusBadge(b.booking_status)} ${statusBadge(b.payment_status)}<div class="actions">${reviewAction(b)}<a class="button small" href="booking-details.html?id=${Number(b.booking_id)}">View details</a>${['Pending', 'Confirmed'].includes(b.booking_status) ? `<button class="button small secondary" data-cancel="${Number(b.booking_id)}">Cancel booking</button>` : ''}</div></div></article>`,
              )
              .join('')
        : '<div class="empty"><h3>No bookings here yet.</h3><p>Find a vehicle and start planning your next journey.</p><a class="button" href="vehicles.html">Browse vehicles</a></div>';
    $$('[data-cancel]').forEach(
        (button) =>
            (button.onclick = async () => {
                button.disabled = true;
                try {
                    if (await cancel(button.dataset.cancel)) await list(status);
                } catch (error) {
                    showAlert(error.message, 'error');
                } finally {
                    button.disabled = false;
                }
            }),
    );
}
export async function initBooking() {
    if (page === 'booking') await bookingPage();
    if (['booking-confirmation', 'booking-details'].includes(page)) await detailPage();
    if (page === 'my-bookings') {
        await list();
        $$('[data-status]').forEach(
            (button) =>
                (button.onclick = async () => {
                    try {
                        await list(button.dataset.status);
                        $$('[data-status]').forEach((b) =>
                            b.classList.toggle('active', b === button),
                        );
                    } catch (error) {
                        showAlert(error.message, 'error');
                    }
                }),
        );
    }
}
