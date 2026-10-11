export function initNotifications({ host, admin = false }) {
    if (!host || host.querySelector('.notification-center')) return;
    const root = document.createElement('div');
    root.className = 'notification-center';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'notification-toggle';
    toggle.setAttribute('aria-label', 'Notifications');
    toggle.title = 'Notifications';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'notification-panel');
    const bell = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    bell.setAttribute('viewBox', '0 0 24 24');
    bell.setAttribute('aria-hidden', 'true');
    bell.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4');
    bell.append(path);
    const badge = document.createElement('span');
    badge.className = 'notification-count';
    badge.hidden = true;
    badge.setAttribute('aria-hidden', 'true');
    toggle.append(bell, badge);
    const panel = document.createElement('section');
    panel.id = 'notification-panel';
    panel.className = 'notification-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Notifications');
    const heading = document.createElement('h2');
    heading.textContent = 'Notifications';
    const note = document.createElement('p');
    note.className = 'notification-note';
    note.textContent = 'Latest 50 updates · refreshes every 30 seconds';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const actions = document.createElement('div');
    actions.className = 'actions';
    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'button small secondary';
    refresh.textContent = 'Refresh';
    const readAll = document.createElement('button');
    readAll.type = 'button';
    readAll.className = 'button small secondary';
    readAll.textContent = 'Mark all as read';
    readAll.disabled = true;
    const list = document.createElement('div');
    list.className = 'notification-list';
    actions.append(refresh, readAll);
    panel.append(heading, note, actions, status, list);
    root.append(toggle, panel);
    host.prepend(root);
    const endpoint = admin
        ? '../backend/admin/notifications/inbox.php'
        : 'backend/notifications/inbox.php';
    let csrf = '',
        latest = 0,
        busy = false;
    async function request(data) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(endpoint, {
                credentials: 'same-origin',
                cache: 'no-store',
                signal: controller.signal,
                method: data ? 'POST' : 'GET',
                headers: data
                    ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }
                    : { Accept: 'application/json' },
                ...(data ? { body: JSON.stringify(data) } : {}),
            });
            const result = await response.json();
            if (!response.ok || !result.success)
                throw new Error(result.message || 'Unable to load notifications.');
            return result.data;
        } finally {
            clearTimeout(timeout);
        }
    }
    function destination(path) {
        // Only known local pages are permitted; never navigate to arbitrary API-provided URLs.
        const allowed = admin
            ? /^(bookings\.html\?id=\d+|messages\.html|dashboard\.html|\.\.\/vehicle-details\.html\?id=\d+#reviews)$/
            : /^booking-details\.html\?id=\d+$/;
        return allowed.test(path) ? path : null;
    }
    async function load() {
        if (busy) return;
        busy = true;
        refresh.disabled = true;
        try {
            const data = await request();
            csrf = data.csrfToken;
            latest = Number(data.notifications[0]?.notification_id || 0);
            const unread = Math.max(0, Number(data.unread) || 0);
            badge.textContent = unread > 99 ? '99+' : String(unread);
            badge.hidden = unread === 0;
            toggle.setAttribute('aria-label', `Notifications, ${unread} unread`);
            toggle.title = unread ? `${unread} unread notifications` : 'Notifications';
            readAll.disabled = !data.unread;
            status.textContent = data.notifications.length
                ? ''
                : 'You’re all caught up. New updates will appear here.';
            list.replaceChildren();
            for (const item of data.notifications) {
                const article = document.createElement('article');
                article.className = 'notification-item' + (Number(item.is_read) ? '' : ' unread');
                const label = document.createElement('p');
                label.textContent = (Number(item.is_read) ? '' : 'New · ') + item.message;
                const time = document.createElement('small');
                time.textContent = item.created_at;
                article.append(label, time);
                const href = destination(item.destination);
                if (href) {
                    const link = document.createElement('a');
                    link.href = href;
                    link.textContent = 'View update';
                    link.onclick = async (event) => {
                        event.preventDefault();
                        try {
                            await request({ notification_id: item.notification_id });
                            location.assign(href);
                        } catch (error) {
                            status.textContent = error.message;
                        }
                    };
                    article.append(link);
                }
                if (!Number(item.is_read)) {
                    const mark = document.createElement('button');
                    mark.type = 'button';
                    mark.className = 'notification-mark';
                    mark.textContent = 'Mark read';
                    mark.onclick = async () => {
                        mark.disabled = true;
                        try {
                            await request({ notification_id: item.notification_id });
                            await load();
                        } catch (error) {
                            status.textContent = error.message;
                            mark.disabled = false;
                        }
                    };
                    article.append(mark);
                }
                list.append(article);
            }
        } catch (error) {
            status.textContent = 'Notifications unavailable. Select Refresh to retry.';
        } finally {
            busy = false;
            refresh.disabled = false;
        }
    }
    function close() {
        panel.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }
    toggle.onclick = () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) load();
    };
    document.addEventListener('click', (event) => {
        if (!root.contains(event.target)) close();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden) {
            close();
            toggle.focus();
        }
    });
    refresh.onclick = load;
    readAll.onclick = async () => {
        readAll.disabled = true;
        try {
            await request({ action: 'all', through_id: latest });
            await load();
        } catch (error) {
            status.textContent = error.message;
            readAll.disabled = false;
        }
    };
    load();
    setInterval(() => {
        if (!document.hidden) load();
    }, 30000);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) load();
    });
}
