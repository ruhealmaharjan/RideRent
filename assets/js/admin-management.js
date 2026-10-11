export async function initManagement({ page, request, alert }) {
    const root = document.querySelector('#manage-content');
    const el = (tag, text, cls) => {
        const n = document.createElement(tag);
        if (text !== undefined) n.textContent = text;
        if (cls) n.className = cls;
        return n;
    };
    const money = (v) =>
        new Intl.NumberFormat('en-NP', { style: 'currency', currency: 'NPR' }).format(
            Number(v || 0),
        );
    const link = (text, href) => {
        const n = el('a', text, 'button small secondary');
        n.href = href;
        return n;
    };
    const button = (text, action) => {
        const n = el('button', text, 'button small secondary');
        n.type = 'button';
        n.onclick = async () => {
            n.disabled = true;
            try {
                await action();
            } catch (e) {
                alert(e.message);
            } finally {
                n.disabled = false;
            }
        };
        return n;
    };
    const input = (form, label, name, options = {}) => {
        const wrap = el('label', label);
        const n = el(options.choices ? 'select' : options.multiline ? 'textarea' : 'input');
        n.name = name;
        if (options.choices)
            options.choices.forEach((v) => n.add(new Option(v[1] ?? v, v[0] ?? v)));
        else if (!options.multiline) n.type = options.type || 'text';
        if (options.required) n.required = true;
        if (options.max) n.maxLength = options.max;
        wrap.append(n);
        form.append(wrap);
        return n;
    };
    function table(title, rows, columns) {
        const section = el('section', undefined, 'section');
        section.append(el('h2', title));
        const wrap = el('div', undefined, 'panel table-wrap'),
            t = el('table'),
            head = t.createTHead().insertRow(),
            body = t.createTBody();
        columns.forEach(([label]) => {
            const th = el('th', label);
            th.scope = 'col';
            head.append(th);
        });
        rows.forEach((row) => {
            const tr = body.insertRow();
            columns.forEach(([, value]) => {
                const td = tr.insertCell(),
                    v = value(row);
                if (v instanceof Node) td.append(v);
                else td.textContent = v ?? '—';
            });
        });
        if (!rows.length) {
            const td = body.insertRow().insertCell();
            td.colSpan = columns.length;
            td.textContent = 'No records found.';
        }
        wrap.append(t);
        section.append(wrap);
        root.append(section);
        return section;
    }
    function details(title, record, fields) {
        const box = el('section', undefined, 'panel');
        box.append(el('h2', title));
        const dl = el('dl');
        fields.forEach(([label, key]) =>
            dl.append(
                el('dt', label),
                el('dd', typeof key === 'function' ? key(record) : (record[key] ?? '—')),
            ),
        );
        box.append(dl);
        root.append(box);
        return box;
    }
    function form() {
        const f = el('form', undefined, 'panel form-grid two');
        root.append(f);
        return f;
    }
    function submit(f, text, fn) {
        const b = el('button', text, 'button');
        b.type = 'submit';
        f.append(b);
        f.onsubmit = async (e) => {
            e.preventDefault();
            if (!f.reportValidity() || b.disabled) return;
            b.disabled = true;
            try {
                await fn(Object.fromEntries(new FormData(f)));
            } catch (error) {
                alert(error.message);
            } finally {
                b.disabled = false;
            }
        };
    }
    const id = new URLSearchParams(location.search).get('id');
    async function load() {
        root.replaceChildren();
        if (page === 'profile') {
            const s = await request('session');
            details('Your administrator account', s.admin, [
                ['Name', 'name'],
                ['Email', 'email'],
                ['Role', () => 'Administrator'],
            ]);
            return;
        }
        if (page === 'categories') {
            const { categories } = await request('categories/get-categories');
            let edit = null;
            const f = form(),
                name = input(f, 'Category name', 'category_name', { required: true, max: 60 }),
                desc = input(f, 'Description', 'description', {
                    required: true,
                    max: 500,
                    multiline: true,
                });
            const heading = el('h2', 'Add category');
            f.prepend(heading);
            submit(f, 'Save category', async (data) => {
                await request('categories/' + (edit ? 'update-category' : 'add-category'), {
                    ...data,
                    ...(edit ? { category_id: edit } : {}),
                });
                await load();
                alert('Category saved.');
            });
            f.append(
                button('Clear form', () => {
                    edit = null;
                    f.reset();
                    heading.textContent = 'Add category';
                }),
            );
            table('Categories', categories, [
                ['Name', (c) => c.category_name],
                ['Description', (c) => c.description],
                ['Vehicles', (c) => c.vehicle_count],
                [
                    'Actions',
                    (c) => {
                        const box = el('div', undefined, 'actions');
                        box.append(
                            button('Edit', () => {
                                edit = c.category_id;
                                name.value = c.category_name;
                                desc.value = c.description;
                                heading.textContent = 'Edit category';
                                name.focus();
                            }),
                            button('Delete', async () => {
                                if (
                                    !confirm(
                                        'Delete ' +
                                            c.category_name +
                                            '? Categories assigned to vehicles cannot be deleted.',
                                    )
                                )
                                    return;
                                await request('categories/delete-category', {
                                    category_id: c.category_id,
                                });
                                await load();
                                alert('Category deleted.');
                            }),
                        );
                        return box;
                    },
                ],
            ]);
            return;
        }
        if (page === 'customer-details') {
            const d = await request('customers/get-customer', undefined, { id });
            root.append(link('Back to customers', 'customers.html'));
            details('Customer information', d.customer, [
                ['Name', 'full_name'],
                ['Email', 'email'],
                ['Phone', 'phone'],
                ['Address', 'address'],
                ['Driving licence', 'driving_license'],
                ['Registered', 'created_at'],
                ['Bookings', 'booking_count'],
                ['Paid total', (c) => money(c.total_spent)],
            ]);
            table('Booking history', d.bookings, [
                [
                    'Booking',
                    (b) =>
                        link(
                            b.booking_reference || b.booking_id,
                            'booking-details.html?id=' + b.booking_id,
                        ),
                ],
                ['Vehicle', (b) => b.vehicle_name],
                ['Pickup', (b) => b.pickup_date],
                ['Return', (b) => b.return_date],
                ['Status', (b) => b.booking_status],
                ['Total', (b) => money(b.total_amount)],
            ]);
            return;
        }
        if (page === 'booking-details') {
            const { booking: b } = await request('bookings/get-booking', undefined, { id });
            root.append(link('Back to bookings', 'bookings.html'));
            details('Booking ' + (b.booking_reference || b.booking_id), b, [
                ['Vehicle', 'vehicle_name'],
                ['Registration', 'registration_number'],
                ['Customer', 'full_name'],
                ['Email', 'email'],
                ['Phone', 'phone'],
                ['Pickup', 'pickup_date'],
                ['Return', 'return_date'],
                ['Days', 'total_days'],
                ['Total', (b) => money(b.total_amount)],
                ['Status', 'booking_status'],
                ['Payment', 'payment_status'],
            ]);
            const choices =
                {
                    Pending: ['Confirmed', 'Cancelled'],
                    Confirmed: ['Completed', 'Cancelled'],
                    Completed: [],
                    Cancelled: [],
                }[b.booking_status] || [];
            if (choices.length) {
                const f = form();
                input(f, 'Change booking status', 'booking_status', {
                    choices: choices.map((x) => [x, x]),
                });
                submit(f, 'Update status', async (data) => {
                    if (!confirm('Change this booking to ' + data.booking_status + '?')) return;
                    await request('bookings/update-status', { booking_id: b.booking_id, ...data });
                    await load();
                    alert('Booking updated.');
                });
            }
            table('Payments', b.payments, [
                ['Method', (p) => p.payment_method],
                ['Amount', (p) => money(p.amount)],
                ['Status', (p) => p.payment_status],
                ['Reference', (p) => p.transaction_reference],
                ['Date', (p) => p.payment_date],
            ]);
            root.append(link('Manage payments', 'payments.html?booking_id=' + b.booking_id));
            return;
        }
        if (page === 'reports') {
            const f = form();
            input(f, 'From date', 'from_date', { type: 'date' });
            input(f, 'To date', 'to_date', { type: 'date' });
            const results = el('div');
            root.append(results);
            async function report(params) {
                const filtered = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
                if (filtered.from_date && filtered.to_date && filtered.from_date > filtered.to_date)
                    throw new Error('From date must not be after To date.');
                const d = await request('reports/get-reports', undefined, filtered);
                results.replaceChildren();
                const before = root.children.length;
                details('Report summary', d.statistics, [
                    ['Total bookings', 'total_bookings'],
                    ['Completed', 'completed_bookings'],
                    ['Cancelled', 'cancelled_bookings'],
                    ['Revenue', (s) => money(s.revenue)],
                ]);
                table('Monthly revenue', d.revenue_by_month, [
                    ['Month', (r) => r.month],
                    ['Revenue', (r) => money(r.revenue)],
                ]);
                table('Most rented vehicles', d.most_rented_vehicles, [
                    ['Vehicle', (v) => v.vehicle_name],
                    ['Bookings', (v) => v.rentals],
                ]);
                table('Popular categories', d.popular_categories, [
                    ['Category', (c) => c.category_name],
                    ['Bookings', (c) => c.rentals],
                ]);
                table('Top customers', d.top_customers, [
                    ['Customer', (c) => c.full_name],
                    ['Bookings', (c) => c.bookings],
                ]);
                while (root.children.length > before) results.append(root.children[before]);
            }
            submit(f, 'Generate report', report);
            root.append(
                el(
                    'p',
                    'Booking statistics use booking creation dates; revenue uses payment dates.',
                    'muted',
                ),
            );
            await report({});
            return;
        }
        // Searchable, paginated customer and payment tables.
        const f = form();
        let current = 1,
            version = 0;
        if (page === 'customers') input(f, 'Search customers', 'q', { max: 100 });
        else {
            input(f, 'Payment status', 'status', {
                choices: [
                    ['', 'All statuses'],
                    ...['Pending', 'Paid', 'Failed', 'Refunded'].map((x) => [x, x]),
                ],
            });
            const bid = input(f, 'Booking internal ID (optional)', 'booking_id', {
                type: 'number',
            });
            bid.min = 1;
            bid.value = new URLSearchParams(location.search).get('booking_id') || '';
            root.append(
                el(
                    'p',
                    'Records only: updating a payment does not charge or refund money.',
                    'muted',
                ),
            );
        }
        let section;
        const paging = el('div', undefined, 'actions'),
            status = el('span');
        let prev, next;
        async function results() {
            const seq = ++version;
            prev.disabled = true;
            next.disabled = true;
            status.textContent = 'Loading…';
            try {
                const endpoint =
                    page === 'customers' ? 'customers/get-customers' : 'payments/get-payments';
                const d = await request(endpoint, undefined, {
                    ...Object.fromEntries(new FormData(f)),
                    page: current,
                    limit: 15,
                });
                if (seq !== version) return;
                if (section) section.remove();
                section =
                    page === 'customers'
                        ? table('Customers', d.customers, [
                              [
                                  'Name',
                                  (c) => link(c.full_name, 'customer-details.html?id=' + c.user_id),
                              ],
                              ['Email', (c) => c.email],
                              ['Phone', (c) => c.phone],
                              ['Licence', (c) => c.driving_license],
                              ['Joined', (c) => c.created_at],
                              ['Bookings', (c) => c.booking_count],
                          ])
                        : table('Payments', d.payments, [
                              ['Payment', (p) => p.payment_id],
                              [
                                  'Booking',
                                  (p) =>
                                      link(
                                          '#' + p.booking_id,
                                          'booking-details.html?id=' + p.booking_id,
                                      ),
                              ],
                              ['Customer', (p) => p.full_name],
                              ['Amount', (p) => money(p.amount)],
                              ['Method', (p) => p.payment_method],
                              ['Reference', (p) => p.transaction_reference],
                              ['Status', (p) => p.payment_status],
                              ['Date', (p) => p.payment_date],
                              [
                                  'Update',
                                  (p) => {
                                      const box = el('div', undefined, 'actions');
                                      const choices =
                                          {
                                              Pending: ['Paid', 'Failed'],
                                              Failed: ['Pending', 'Paid'],
                                              Paid: ['Refunded'],
                                              Refunded: [],
                                          }[p.payment_status] || [];
                                      choices.forEach((value) =>
                                          box.append(
                                              button(value, async () => {
                                                  if (
                                                      !confirm(
                                                          'Record payment #' +
                                                              p.payment_id +
                                                              ' as ' +
                                                              value +
                                                              '? This records a status only.',
                                                      )
                                                  )
                                                      return;
                                                  await request('payments/update-payment', {
                                                      payment_id: p.payment_id,
                                                      payment_status: value,
                                                  });
                                                  await results();
                                                  alert('Payment record updated.');
                                              }),
                                          ),
                                      );
                                      return box;
                                  },
                              ],
                          ]);
                root.append(paging);
                current = d.pagination.page;
                status.textContent = `${d.pagination.total} records · Page ${current} of ${d.pagination.pages}`;
                prev.disabled = current <= 1;
                next.disabled = current >= d.pagination.pages;
            } catch (e) {
                if (seq === version)
                    status.textContent = 'Could not load records. Apply filters to retry.';
                throw e;
            }
        }
        prev = button('Previous', async () => {
            current--;
            await results();
        });
        next = button('Next', async () => {
            current++;
            await results();
        });
        paging.append(prev, status, next);
        root.append(paging);
        submit(f, 'Apply filters', async () => {
            current = 1;
            await results();
        });
        await results();
    }
    try {
        const session = await request('session');
        if (!session.loggedIn) {
            location.replace('login.html');
            return;
        }
        const logout = document.querySelector('#admin-logout');
        logout.disabled = false;
        logout.onclick = async () => {
            try {
                await request('logout', {});
                location.replace('login.html');
            } catch (e) {
                alert(e.message);
            }
        };
        await load();
        root.hidden = false;
    } catch (e) {
        alert(e.message);
        root.hidden = false;
        root.append(
            button('Retry', async () => {
                await load();
            }),
        );
    } finally {
        document.querySelector('#manage-loading').hidden = true;
    }
}
