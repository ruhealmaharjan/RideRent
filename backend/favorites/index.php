<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/helpers/functions.php';
require_once dirname(__DIR__) . '/config/database.php';
restoreLogin($pdo);
$uid = requireLogin();
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $vehicles = query(
        $pdo,
        'SELECT v.*,c.category_name FROM favorites f JOIN vehicles v ON v.vehicle_id=f.vehicle_id JOIN vehicle_categories c ON c.category_id=v.category_id WHERE f.user_id=? ORDER BY f.created_at DESC,f.vehicle_id DESC',
        [$uid],
    )->fetchAll();
    sendJson(true, '', ['vehicles' => $vehicles]);
}
requirePost();
$data = input();
$id = idValue($data['vehicle_id'] ?? null);
$action = $data['action'] ?? '';
if (!in_array($action, ['add', 'remove'], true)) {
    sendJson(false, 'Choose add or remove.', [], 422);
}
$pdo->beginTransaction();
if (
    !query($pdo, 'SELECT user_id FROM users WHERE user_id=? AND deleted_at IS NULL FOR UPDATE', [
        $uid,
    ])->fetch()
) {
    $pdo->rollBack();
    sendJson(false, 'Please log in again.', [], 401);
}
if ($action === 'add') {
    if (
        !query($pdo, 'SELECT vehicle_id FROM vehicles WHERE vehicle_id=? AND is_active=1', [
            $id,
        ])->fetch()
    ) {
        $pdo->rollBack();
        sendJson(false, 'This vehicle is no longer listed.', [], 404);
    }
    query($pdo, 'INSERT IGNORE INTO favorites(user_id,vehicle_id) VALUES (?,?)', [$uid, $id]);
} else {
    query($pdo, 'DELETE FROM favorites WHERE user_id=? AND vehicle_id=?', [$uid, $id]);
}
$pdo->commit();
sendJson(true, $action === 'add' ? 'Vehicle liked.' : 'Vehicle unliked.');
