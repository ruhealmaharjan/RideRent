import { vehicleActions, initVehicleTools } from './vehicle-tools.js';
import {
    $,
    $$,
    page,
    getApi,
    api,
    escapeHTML as e,
    formatCurrency as money,
    imagePath,
    formatDate,
    getQueryParameter,
    calculateRentalDays,
    bindForm,
    showAlert,
    formData,
    statusBadge,
} from './main.js';
export function vehicleCard(v) {
    const params = new URLSearchParams({ id: v.vehicle_id });
    for (const key of ['pickup_date', 'return_date']) {
        const value = getQueryParameter(key);
        if (value) params.set(key, value);
    }
    const link = `vehicle-details.html?${params}`;
    return `<article class="vehicle-card vehicle-card-clickable"><img src="${e(imagePath(v.image))}" alt="${e(v.vehicle_name)}" loading="lazy"><div class="vehicle-card-body"><span class="badge">${e(v.category_name)}</span><h3><a class="vehicle-card-link" href="${e(link)}" aria-label="View ${e(v.vehicle_name)} details">${e(v.vehicle_name)}</a></h3><p class="brand">${e(v.brand)} · ${e(v.model)}</p><div class="specs"><span>${e(v.transmission)}</span><span>${e(v.fuel_type)}</span><span>${Number(v.seats)} seats</span></div><div class="card-bottom"><span class="price">${money(v.price_per_day)} <small>/ day</small></span></div>${vehicleActions(v)}</div></article>`;
}
export function dateControls(form, price = 0, estimate = null) {
    const pickup = $('[name=pickup_date]', form),
        returned = $('[name=return_date]', form);
    if (!pickup || !returned) return;
    pickup.removeAttribute('min');
    returned.removeAttribute('min');
    function update() {
        const a = pickup.value,
            b = returned.value;
        returned.setCustomValidity('');
        pickup.setCustomValidity('');
        if (a) {
            const next = new Date(a + 'T00:00:00Z');
            next.setUTCDate(next.getUTCDate() + 1);
            returned.min = next.toISOString().slice(0, 10);
        } else {
            returned.removeAttribute('min');
        }
        if (a && b && b <= a) returned.setCustomValidity('Return must be after pickup.');
        const days = calculateRentalDays(a, b);
        if (days > 365) returned.setCustomValidity('Rentals may not exceed 365 days.');
        if (estimate)
            estimate.textContent =
                Number.isFinite(days) && days > 0
                    ? `${days} day${days === 1 ? '' : 's'} · ${money(days * price)}`
                    : 'Select your dates';
    }
    pickup.addEventListener('input', update);
    returned.addEventListener('input', update);
    update();
}
async function listVehicles() {
    const form = $('#filter-form');
    const initial = new URLSearchParams(location.search);
    let requestId = 0;
    let searchTimer;
    let categories = [];
    const buttons = $$('[data-fleet]');
    function syncButtons() {
        const category = categories.find(
            (c) => String(c.category_id) === form.elements.category.value,
        )?.category_name;
        const active = form.elements.category.value
            ? category
            : form.elements.fuel.value === 'Electric'
              ? 'ev'
              : form.elements.fuel.value
                ? ''
                : 'all';
        buttons.forEach((button) => {
            const selected = button.dataset.fleet === active;
            button.classList.toggle('selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    }
    buttons.forEach(
        (button) =>
            (button.onclick = async () => {
                const key = button.dataset.fleet;
                const category = categories.find((c) => c.category_name === key);
                if (key !== 'all' && key !== 'ev' && !category) return;
                form.elements.category.value = category ? String(category.category_id) : '';
                form.elements.fuel.value = key === 'ev' ? 'Electric' : '';
                if (form.reportValidity()) {
                    syncButtons();
                    await load(1);
                }
            }),
    );
    for (const [key, value] of initial) {
        const control = form.elements.namedItem(key);
        if (control) control.value = value;
    }
    async function load(pageNumber = 1) {
        clearTimeout(searchTimer);
        const id = ++requestId;
        const params = { ...formData(form), page: pageNumber };
        $('#vehicle-grid').textContent = 'Loading vehicles…';
        $('#vehicle-grid').setAttribute('aria-busy', 'true');
        $('#pagination').replaceChildren();
        $('#result-count').textContent = 'Finding vehicles…';
        try {
            const data = await getApi('vehicles/get-vehicles', params);
            if (id !== requestId) return;
            const brand = form.elements.brand;
            if (brand.options.length === 1) {
                for (const value of data.brands) brand.add(new Option(value, value));
                brand.value = initial.get('brand') || '';
                if (brand.value && !params.brand) {
                    await load(pageNumber);
                    return;
                }
            }
            categories = data.categories;
            const category = form.elements.category;
            const selected = category.value;
            category.replaceChildren(new Option('All categories', ''));
            data.categories.forEach((c) =>
                category.add(new Option(c.category_name, c.category_id)),
            );
            category.value = selected;
            syncButtons();
            $('#result-count').textContent =
                `${data.pagination.total} vehicle${data.pagination.total === 1 ? '' : 's'} found`;
            $('#vehicle-grid').innerHTML = data.vehicles.length
                ? data.vehicles.map(vehicleCard).join('')
                : '<p class="empty">No vehicles found matching your search.</p>';
            $('#pagination').replaceChildren();
            for (let n = 1; n <= data.pagination.pages; n++) {
                const button = document.createElement('button');
                button.textContent = n;
                button.className = n === data.pagination.page ? 'active' : '';
                button.setAttribute('aria-label', `Page ${n}`);
                if (n === data.pagination.page) button.setAttribute('aria-current', 'page');
                button.onclick = () => load(n);
                $('#pagination').append(button);
            }
            const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== ''));
            history.replaceState(null, '', 'vehicles.html?' + query);
        } catch (error) {
            if (id !== requestId) return;
            $('#vehicle-grid').textContent = 'Vehicles could not be loaded. ';
            $('#result-count').textContent = '';
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'button small secondary';
            retry.textContent = 'Retry';
            retry.onclick = () => load(pageNumber);
            $('#vehicle-grid').append(retry);
            showAlert(error.message, 'error');
        } finally {
            if (id === requestId) $('#vehicle-grid').setAttribute('aria-busy', 'false');
        }
    }
    for (const field of ['sort', 'brand', 'fuel', 'transmission'])
        form.elements[field].addEventListener('change', () => {
            if (form.reportValidity()) load(1);
        });
    const search = form.elements.q;
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'button small secondary';
    clear.textContent = 'Clear search';
    clear.hidden = !search.value;
    search.closest('label').after(clear);
    search.addEventListener('input', () => {
        clear.hidden = !search.value;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            if (form.reportValidity()) load(1);
        }, 300);
    });
    clear.onclick = () => {
        search.value = '';
        clear.hidden = true;
        search.focus();
        load(1);
    };
    dateControls(form);
    form.onsubmit = (event) => {
        event.preventDefault();
        if (form.reportValidity()) load();
    };
    await load(Number(initial.get('page')) || 1);
}
async function reviews(id) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const status = $('#review-notice');
    status.setAttribute('aria-busy', 'true');
    try {
        const data = await getApi(
            'reviews/get-reviews',
            { vehicle_id: id },
            { signal: controller.signal },
        );
        if (!Array.isArray(data?.reviews) || !Array.isArray(data?.eligible_bookings))
            throw new Error('Invalid review response');
        $('#review-average').textContent = data.average
            ? `${data.average} / 5 · ${data.reviews.length} reviews`
            : 'No ratings yet';
        $('#reviews').innerHTML = data.reviews.length
            ? data.reviews
                  .map(
                      (r) =>
                          `<article class="review-card"><span class="stars">${'★'.repeat(Number(r.rating))}${'☆'.repeat(5 - Number(r.rating))}</span><h3>${e(r.full_name)}</h3><p>${e(r.review_text)}</p><small>${formatDate(r.created_at)}</small></article>`,
                  )
                  .join('')
            : '<p class="empty">Be the first to share your experience once your rental is Confirmed or Completed.</p>';
        const form = $('#review-form');
        form.hidden = !data.eligible_bookings.length;
        const notice = $('#review-notice');
        notice.hidden = !form.hidden;
        notice.replaceChildren();
        if (!notice.hidden) {
            notice.textContent = !data.loggedIn
                ? 'Log in with the account used for your rental to write a review.'
                : data.has_reviewed
                  ? 'Thank you! You have reviewed your rentals for this vehicle.'
                  : 'Reviews become available when the administrator marks your rental as Confirmed or Completed.';
            const link = document.createElement('a');
            link.className = 'button small secondary';
            link.href = data.loggedIn ? 'my-bookings.html' : 'login.html';
            link.textContent = data.loggedIn ? 'My bookings' : 'Log in';
            notice.append(document.createElement('br'), link);
        }
        const select = $('[name=booking_id]', form);
        select.replaceChildren();
        data.eligible_bookings.forEach((b) =>
            select.add(
                new Option(
                    `${b.booking_reference || b.booking_id} · ${formatDate(b.pickup_date)} – ${formatDate(b.return_date)}`,
                    b.booking_id,
                ),
            ),
        );
        const requested = getQueryParameter('review_booking');
        if (data.eligible_bookings.some((b) => String(b.booking_id) === requested))
            select.value = requested;
    } catch (error) {
        $('#review-form').hidden = true;
        status.hidden = false;
        status.replaceChildren();
        status.textContent = 'Reviews could not be loaded. Please try again.';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'button small secondary';
        retry.textContent = 'Retry reviews';
        retry.onclick = async () => {
            retry.disabled = true;
            await reviews(id);
        };
        status.append(document.createElement('br'), retry);
    } finally {
        clearTimeout(timeout);
        status.setAttribute('aria-busy', 'false');
    }
}
async function details() {
    const id = getQueryParameter('id');
    try {
        const { vehicle: v } = await getApi('vehicles/get-vehicle', { id });
        document.title = `${v.vehicle_name} | RideRent`;
        $('#vehicle-detail').innerHTML =
            `<section><img class="detail-image" src="${e(imagePath(v.image))}" alt="${e(v.vehicle_name)}"><p class="muted">Representative model photograph. <a href="photo-credits.html">Photo credits &amp; specifications</a></p><div class="detail-specs">${[
                ['Category', v.category_name],
                ['Model year', v.manufacturing_year],
                ['Fuel', v.fuel_type],
                ['Transmission', v.transmission],
                ['Seats', v.seats],
                ['Brand / model', v.brand + ' / ' + v.model],
            ]
                .map(([k, val]) => `<div><span>${k}</span>${e(val)}</div>`)
                .join(
                    '',
                )}</div><h2>About this vehicle</h2><p>${e(v.description)}</p></section><section><span class="eyebrow">YOUR NEXT RIDE</span><h1>${e(v.vehicle_name)}</h1>${statusBadge(v.availability_status)}${vehicleActions(v)}<form class="panel form-grid" id="vehicle-booking" action="booking.html"><p class="price">${money(v.price_per_day)} <small>/ day</small></p><input type="hidden" name="vehicle_id" value="${Number(v.vehicle_id)}"><label>Pickup date<input name="pickup_date" type="date" required></label><label>Return date<input name="return_date" type="date" required></label><div class="total-line"><span>Estimate</span><strong id="estimate">Select dates</strong></div><button type="submit" class="button" ${v.availability_status === 'Available' ? '' : 'disabled'}>Book now</button><small class="muted">Availability is checked again before confirmation.</small></form></section>`;
        const form = $('#vehicle-booking');
        for (const key of ['pickup_date', 'return_date'])
            if (getQueryParameter(key)) form.elements[key].value = getQueryParameter(key);
        dateControls(form, Number(v.price_per_day), $('#estimate'));
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const button = $('[type=submit]', form);
            if (button.disabled) return;
            button.disabled = true;
            try {
                const params = formData(form);
                const availability = await getApi('vehicles/check-availability', params);
                if (typeof availability?.available !== 'boolean')
                    throw new Error(
                        'The availability response could not be read. Refresh this page and try again.',
                    );
                if (availability.available === false) {
                    showAlert(
                        'This vehicle is already reserved for part of your selected dates. Change the dates below or find another available vehicle.',
                        'error',
                    );
                    let alternatives = $('#available-alternatives');
                    if (!alternatives) {
                        alternatives = document.createElement('a');
                        alternatives.id = 'available-alternatives';
                        alternatives.className = 'button secondary';
                        form.append(alternatives);
                    }
                    alternatives.textContent = 'Find available vehicles for these dates';
                    alternatives.href =
                        'vehicles.html?' +
                        new URLSearchParams({
                            pickup_date: params.pickup_date,
                            return_date: params.return_date,
                        });
                    return;
                }
                location.href = 'booking.html?' + new URLSearchParams(params);
            } catch (error) {
                showAlert(error.message, 'error');
            } finally {
                button.disabled = false;
            }
        });
        await reviews(id);
        bindForm($('#review-form'), async (data) => {
            const result = await api('reviews/submit-review', { method: 'POST', body: data });
            $('#review-form').reset();
            showAlert(result.message);
            await reviews(id);
        });
    } catch (error) {
        $('#vehicle-detail').textContent = 'Vehicle details are unavailable.';
        throw error;
    }
}
export async function initVehicles() {
    await initVehicleTools(vehicleCard);
    if (page === 'index') {
        try {
            const data = await getApi('vehicles/get-vehicles', { limit: 6 });
            $('#vehicle-grid').innerHTML = data.vehicles.length
                ? data.vehicles.map(vehicleCard).join('')
                : '<p class="empty">No available vehicles at the moment.</p>';
        } catch (error) {
            $('#vehicle-grid').textContent = 'Connect the database to load the fleet.';
            showAlert(error.message, 'error');
        }
    }
    if (page === 'vehicles') await listVehicles();
    if (page === 'vehicle-details') await details();
}
