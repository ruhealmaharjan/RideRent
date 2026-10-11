<?php
declare(strict_types=1);
require_once __DIR__ . '/helpers/functions.php';
require_once __DIR__ . '/helpers/admin-functions.php';
require_once __DIR__ . '/config/database.php';
$admin = defined('RIDERENT_ADMIN') && RIDERENT_ADMIN;
if (!$admin) {
    restoreLogin($pdo);
}
$id = $admin ? requireAdmin($pdo) : requireLogin();
$role = $admin ? 'admin' : 'customer';
$scope = $admin ? "n.audience='admin'" : "n.audience='customer' AND n.user_id=" . (int) $id;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    requirePost();
    $data = input();
    // Mark only notifications visible to this account; a bounded watermark leaves newer arrivals unread.
    if (($data['action'] ?? '') === 'all') {
        $through = idValue($data['through_id'] ?? null);
        query(
            $pdo,
            "INSERT IGNORE INTO notification_reads(notification_id,reader_role,reader_id) SELECT n.notification_id,?,? FROM notifications n WHERE $scope AND n.notification_id<=?",
            [$role, $id, $through],
        );
    } else {
        $notification = idValue($data['notification_id'] ?? null);
        if (
            !query(
                $pdo,
                "SELECT notification_id FROM notifications n WHERE $scope AND notification_id=?",
                [$notification],
            )->fetch()
        ) {
            sendJson(false, 'Notification not found.', [], 404);
        }
        query(
            $pdo,
            'INSERT IGNORE INTO notification_reads(notification_id,reader_role,reader_id) VALUES (?,?,?)',
            [$notification, $role, $id],
        );
    }
    sendJson(true, 'Notifications marked as read.');
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET, POST');
    sendJson(false, 'Use GET or POST.', [], 405);
}
$unread = (int) query(
    $pdo,
    "SELECT COUNT(*) FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.notification_id AND r.reader_role=? AND r.reader_id=? WHERE $scope AND r.notification_id IS NULL",
    [$role, $id],
)->fetchColumn();
$rows = query(
    $pdo,
    "SELECT n.notification_id,n.message,n.destination,n.created_at,(r.notification_id IS NOT NULL) AS is_read FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.notification_id AND r.reader_role=? AND r.reader_id=? WHERE $scope ORDER BY n.notification_id DESC LIMIT 50",
    [$role, $id],
)->fetchAll();
sendJson(true, '', ['notifications' => $rows, 'unread' => $unread, 'csrfToken' => csrfToken()]);
