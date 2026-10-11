export async function initFleet({ page, request, alert }) {
    const $ = (s) => document.querySelector(s);
    const imagePath = (p) =>
        /^assets\/images\/vehicles\/[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|svg)$/.test(p || '')
            ? '../' + p
            : '../assets/images/vehicles/car.svg';
    try {
        const session = await request('session');
        if (!session.loggedIn) {
            location.replace('login.html');
            return;
        }
        $('#admin-logout').disabled = false;
        $('#admin-logout').onclick = async () => {
            try {
                await request('logout', {});
                location.replace('login.html');
            } catch (e) {
                alert(e.message);
            }
        };
        const { categories } = await request('categories/get-categories');
        const select = document.querySelector('[name="category"],[name="category_id"]');
        categories.forEach((c) => select.add(new Option(c.category_name, c.category_id)));
        if (page === 'fleet') {
            let current = 1,
                sequence = 0;
            const form = $('#fleet-filters');
            async function load() {
                const seq = ++sequence;
                $('#fleet-count').textContent = 'Loading vehicles…';
                $('#fleet-prev').disabled = true;
                $('#fleet-next').disabled = true;
                try {
                    const result = await request('vehicles/get-vehicles', undefined, {
                        ...Object.fromEntries(new FormData(form)),
                        page: current,
                        limit: 12,
                    });
                    if (seq !== sequence) return;
                    const body = $('#fleet-rows');
                    body.replaceChildren();
                    result.vehicles.forEach((v) => {
                        const row = body.insertRow();
                        const photo = document.createElement('img');
                        photo.src = imagePath(v.image);
                        photo.alt = v.vehicle_name;
                        photo.width = 85;
                        photo.loading = 'lazy';
                        row.insertCell().append(photo);
                        [
                            v.vehicle_name,
                            v.category_name,
                            v.registration_number,
                            new Intl.NumberFormat('en-NP', {
                                style: 'currency',
                                currency: 'NPR',
                            }).format(v.price_per_day),
                            v.availability_status,
                            Number(v.is_active) ? 'Listed' : 'Deactivated',
                        ].forEach((value) => (row.insertCell().textContent = value));
                        const cell = row.insertCell();
                        const edit = document.createElement('a');
                        edit.className = 'button small secondary';
                        edit.href = 'edit-vehicle.html?id=' + v.vehicle_id;
                        edit.textContent = 'Edit';
                        cell.append(edit);
                        if (Number(v.is_active)) {
                            const button = document.createElement('button');
                            button.className = 'button small secondary';
                            button.textContent = 'Deactivate';
                            button.onclick = async () => {
                                if (
                                    !confirm(
                                        'Deactivate ' +
                                            v.vehicle_name +
                                            '? Existing bookings will be preserved.',
                                    )
                                )
                                    return;
                                button.disabled = true;
                                try {
                                    await request('vehicles/deactivate-vehicle', {
                                        vehicle_id: v.vehicle_id,
                                    });
                                    await load();
                                } catch (e) {
                                    alert(e.message);
                                    button.disabled = false;
                                }
                            };
                            cell.append(' ', button);
                        }
                    });
                    if (!result.vehicles.length) {
                        const cell = body.insertRow().insertCell();
                        cell.colSpan = 8;
                        cell.textContent = 'No vehicles match your filters.';
                    }
                    current = result.pagination.page;
                    $('#fleet-count').textContent =
                        `${result.pagination.total} vehicles · Page ${current} of ${result.pagination.pages}`;
                    $('#fleet-prev').disabled = current <= 1;
                    $('#fleet-next').disabled = current >= result.pagination.pages;
                } catch (e) {
                    if (seq === sequence) {
                        $('#fleet-count').textContent =
                            'Unable to load vehicles. Apply filters to retry.';
                        alert(e.message);
                    }
                }
            }
            form.onsubmit = (e) => {
                e.preventDefault();
                current = 1;
                load();
            };
            form.onreset = () =>
                setTimeout(() => {
                    current = 1;
                    load();
                }, 0);
            $('#fleet-prev').onclick = () => {
                current--;
                load();
            };
            $('#fleet-next').onclick = () => {
                current++;
                load();
            };
            await load();
            const notice = sessionStorage.getItem('fleet_notice');
            if (notice) {
                alert(notice);
                sessionStorage.removeItem('fleet_notice');
            }
        } else {
            const form = $('#fleet-form'),
                preview = $('#fleet-preview');
            const editing = page === 'edit-vehicle';
            const id = new URLSearchParams(location.search).get('id');
            let original = '';
            let objectUrl;
            form.elements.manufacturing_year.max = new Date().getFullYear() + 1;
            if (editing) {
                if (!/^[1-9]\d*$/.test(id || ''))
                    throw new Error('Choose a vehicle from the fleet list.');
                const result = await request('vehicles/get-vehicles', undefined, { id });
                const v = result.vehicles[0];
                if (!v) throw new Error('Vehicle not found.');
                for (const [key, value] of Object.entries(v)) {
                    const field = form.elements.namedItem(key);
                    if (field && field.type !== 'file') field.value = value ?? '';
                }
                original = imagePath(v.image);
                preview.src = original;
                preview.hidden = false;
            }
            form.elements.image.onchange = () => {
                const file = form.elements.image.files[0];
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                preview.src = file ? (objectUrl = URL.createObjectURL(file)) : original;
                preview.hidden = !file && !original;
            };
            form.onsubmit = async (event) => {
                event.preventDefault();
                if (!form.reportValidity()) return;
                const button = form.querySelector('[type=submit]');
                if (button.disabled) return;
                button.disabled = true;
                try {
                    const file = form.elements.image.files[0];
                    if (
                        file &&
                        (file.size > 2 * 1024 * 1024 ||
                            !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
                    )
                        throw new Error('Use a JPEG, PNG or WebP image smaller than 2 MB.');
                    const data = new FormData(form);
                    if (editing) data.set('vehicle_id', id);
                    await request('vehicles/' + (editing ? 'update-vehicle' : 'add-vehicle'), data);
                    sessionStorage.setItem(
                        'fleet_notice',
                        editing ? 'Vehicle updated successfully.' : 'Vehicle added successfully.',
                    );
                    location.href = 'vehicles.html';
                } catch (e) {
                    alert(e.message);
                    button.disabled = false;
                }
            };
        }
        $('#fleet-content').hidden = false;
    } catch (e) {
        alert(e.message);
    } finally {
        $('#fleet-loading').hidden = true;
    }
}
