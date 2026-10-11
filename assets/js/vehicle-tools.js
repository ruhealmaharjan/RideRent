import {
    api,
    getApi,
    escapeHTML as e,
    formatCurrency,
    imagePath,
    showAlert,
    page,
} from './main.js';
let favorites = new Set(),
    loggedIn = false,
    selected = [];
try {
    const saved = JSON.parse(sessionStorage.getItem('riderent_compare') || '[]');
    if (Array.isArray(saved))
        selected = [
            ...new Set(saved.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)),
        ].slice(0, 3);
} catch {}
export function vehicleActions(v) {
    const id = Number(v.vehicle_id),
        saved = favorites.has(id),
        compared = selected.includes(id);
    return `<div class="vehicle-tools"><button type="button" class="button small secondary" data-favorite="${id}" aria-pressed="${saved}" aria-label="${saved ? 'Unlike' : 'Like'} ${e(v.vehicle_name)}">${saved ? '♥' : '♡'}</button><button type="button" class="button small secondary" data-compare="${id}" aria-pressed="${compared}">${compared ? 'Selected' : 'Compare'}</button></div>`;
}
function sync() {
    document.querySelectorAll('[data-favorite]').forEach((b) => {
        const saved = favorites.has(Number(b.dataset.favorite));
        b.textContent = saved ? '♥' : '♡';
        b.setAttribute('aria-pressed', String(saved));
        b.setAttribute('aria-label', saved ? 'Unlike vehicle' : 'Like vehicle');
    });
    document.querySelectorAll('[data-compare]').forEach((b) => {
        const active = selected.includes(Number(b.dataset.compare));
        b.textContent = active ? 'Selected' : 'Compare';
        b.setAttribute('aria-pressed', String(active));
    });
    document.body.classList.toggle('has-comparison', selected.length > 0 && page !== 'compare');
    const bar = document.getElementById('compare-tray');
    if (bar) {
        bar.hidden = !selected.length || page === 'compare';
        bar.querySelector('span').textContent = `${selected.length} of 3 vehicles selected`;
        bar.querySelector('a').textContent = `Compare vehicles (${selected.length})`;
    }
}
function persist() {
    try {
        sessionStorage.setItem('riderent_compare', JSON.stringify(selected));
    } catch {}
    sync();
}
async function renderComparison() {
    const container = document.getElementById('comparison');
    if (!container) return;
    document.getElementById('compare-count').textContent =
        `${selected.length} of 3 vehicles selected`;
    document.getElementById('compare-clear').hidden = !selected.length;
    container.setAttribute('aria-busy', 'false');
    if (!selected.length) {
        container.innerHTML =
            '<div class="compare-empty"><span class="compare-symbol" aria-hidden="true">▥</span><h2>Find your perfect match</h2><p>Select Compare on any vehicle card to see up to three options side by side.</p><a class="button" href="vehicles.html">Explore vehicles</a></div>';
        return;
    }
    container.setAttribute('aria-busy', 'true');
    container.innerHTML =
        '<div class="compare-empty" role="status"><p>Preparing your comparison…</p></div>';
    const ids = [...selected];
    const results = await Promise.allSettled(
        ids.map((id) => getApi('vehicles/get-vehicle', { id })),
    );
    if (ids.join() !== selected.join()) return;
    const vehicles = results.map((result) =>
        result.status === 'fulfilled' ? result.value.vehicle : null,
    );
    const prices = vehicles.filter(Boolean).map((v) => Number(v.price_per_day));
    const lowest = Math.min(...prices);
    container.innerHTML = `${selected.length === 1 ? '<p class="compare-hint">Add another vehicle to compare your options.</p>' : ''}<div class="table-wrap comparison-table" tabindex="0" role="region" aria-label="Vehicle comparison. Scroll horizontally on small screens."><table><caption>Vehicle specifications · ${selected.length} selected</caption><thead><tr><th scope="col" class="compare-feature">At a glance<small>Find what matters to you</small></th>${vehicles.map((v, i) => `<th scope="col">${v ? `<img src="${e(imagePath(v.image))}" alt="${e(v.vehicle_name)}"><span class="compare-category">${e(v.category_name)}</span><a class="compare-name" href="vehicle-details.html?id=${ids[i]}">${e(v.vehicle_name)}</a><a class="button small secondary" href="vehicle-details.html?id=${ids[i]}">View details</a>` : '<p>Vehicle unavailable</p><small>Try again later or remove this selection.</small>'}<button class="compare-remove" type="button" data-remove-compare="${ids[i]}" aria-label="Remove ${v ? e(v.vehicle_name) : 'unavailable vehicle'} from comparison">Remove</button></th>`).join('')}</tr></thead><tbody>${[
        ['Price / day', (v) => formatCurrency(v.price_per_day)],
        ['Seats', (v) => v.seats],
        ['Fuel type', (v) => v.fuel_type],
        ['Transmission', (v) => v.transmission],
        ['Category', (v) => v.category_name],
        ['Fleet status', (v) => v.availability_status],
    ]
        .map(
            ([label, value], row) =>
                `<tr><th scope="row">${label}</th>${vehicles.map((v) => `<td class="${row === 0 ? 'compare-price' : ''}">${v ? e(value(v)) : '—'}${row === 0 && v && prices.length > 1 && Number(v.price_per_day) === lowest ? '<span class="compare-best">Lowest daily price</span>' : ''}</td>`).join('')}</tr>`,
        )
        .join(
            '',
        )}</tbody></table></div><p class="compare-scroll-note">On smaller screens, scroll across the table to see every vehicle.</p>`;
    container.setAttribute('aria-busy', 'false');
}
export async function initVehicleTools(renderCard) {
    try {
        const session = await api('auth/session');
        loggedIn = session.loggedIn;
        if (loggedIn) {
            const data = await api('favorites/index');
            favorites = new Set(data.vehicles.map((v) => Number(v.vehicle_id)));
        }
    } catch (error) {
        if (page === 'favorites') showAlert(error.message, 'error');
    }
    async function renderFavorites() {
        const grid = document.getElementById('saved-grid');
        if (!grid) return;
        grid.setAttribute('aria-busy', 'true');
        grid.innerHTML = '<div class="liked-state"><p>Loading your collection…</p></div>';
        try {
            const data = await api('favorites/index');
            favorites = new Set(data.vehicles.map((v) => Number(v.vehicle_id)));
            document.getElementById('liked-count').textContent = data.vehicles.length;
            document.getElementById('liked-description').textContent = data.vehicles.length
                ? `${data.vehicles.length} liked vehicle${data.vehicles.length === 1 ? '' : 's'} · Most recently liked first`
                : 'Your next ride could be a heart away.';
            grid.innerHTML = data.vehicles.length
                ? data.vehicles
                      .map((v) =>
                          Number(v.is_active)
                              ? renderCard(v)
                              : `<article class="vehicle-card liked-unavailable"><img src="${e(imagePath(v.image))}" alt="${e(v.vehicle_name)}"><div class="vehicle-card-body"><span class="badge">No longer listed</span><h3>${e(v.vehicle_name)}</h3><p>This vehicle is currently off the fleet. Explore other vehicles for your trip.</p><button class="button secondary" type="button" data-favorite="${Number(v.vehicle_id)}" aria-pressed="true" aria-label="Unlike vehicle">♥</button></div></article>`,
                      )
                      .join('')
                : '<div class="liked-state"><span class="liked-heart" aria-hidden="true">♡</span><h3>Make room for your next adventure</h3><p>Tap the heart on any vehicle to keep it here. Your picks will be ready whenever you return.</p><a class="button" href="vehicles.html">Find a vehicle you like</a></div>';
            sync();
        } catch (error) {
            document.getElementById('liked-count').textContent = '—';
            document.getElementById('liked-description').textContent =
                'Your collection is temporarily unavailable.';
            grid.innerHTML =
                '<div class="liked-state"><h3>We couldn’t load your vehicles</h3><p>Please try again in a moment.</p></div>';
            const retry = document.createElement('button');
            retry.className = 'button secondary';
            retry.type = 'button';
            retry.textContent = 'Try again';
            retry.onclick = renderFavorites;
            grid.firstElementChild.append(retry);
        } finally {
            grid.setAttribute('aria-busy', 'false');
        }
    }
    const tray = document.createElement('aside');
    tray.id = 'compare-tray';
    tray.className = 'compare-tray';
    tray.hidden = true;
    tray.setAttribute('aria-label', 'Vehicle comparison selection');
    tray.innerHTML =
        '<span aria-live="polite"></span><a class="button small" href="compare.html">Compare vehicles</a><button class="button small secondary" type="button" data-clear-compare>Clear</button>';
    document.body.append(tray);
    sync();
    document.addEventListener('click', async (event) => {
        const favorite = event.target.closest('[data-favorite]');
        if (favorite) {
            if (!loggedIn) {
                sessionStorage.setItem(
                    'riderent_return',
                    location.pathname.split('/').pop() + location.search,
                );
                location.href = 'login.html';
                return;
            }
            if (favorite.disabled) return;
            favorite.disabled = true;
            const id = Number(favorite.dataset.favorite);
            const action = favorites.has(id) ? 'remove' : 'add';
            try {
                await api('favorites/index', { method: 'POST', body: { vehicle_id: id, action } });
                if (action === 'add') favorites.add(id);
                else favorites.delete(id);
                sync();
                if (page === 'favorites') await renderFavorites();
            } catch (error) {
                showAlert(error.message, 'error');
            } finally {
                favorite.disabled = false;
            }
            return;
        }
        const compare = event.target.closest('[data-compare]'),
            remove = event.target.closest('[data-remove-compare]'),
            clear = event.target.closest('[data-clear-compare]');
        if (!compare && !remove && !clear) return;
        if (clear) selected = [];
        else {
            const id = Number(compare?.dataset.compare || remove.dataset.removeCompare);
            if (selected.includes(id)) selected = selected.filter((value) => value !== id);
            else if (selected.length < 3) selected.push(id);
            else {
                showAlert(
                    'Compare up to three vehicles. Remove one from your comparison first.',
                    'error',
                );
                return;
            }
        }
        persist();
        if (page === 'compare') await renderComparison();
    });
    if (page === 'favorites') await renderFavorites();
    if (page === 'compare') await renderComparison();
}
