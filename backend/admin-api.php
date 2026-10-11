<?php
declare(strict_types=1);
define('RIDERENT_ADMIN', true);
require_once __DIR__ . '/helpers/functions.php';
require_once __DIR__ . '/helpers/admin-functions.php';
require_once __DIR__ . '/config/database.php';
$route = $route ?? '';
$writes = [
    'login',
    'logout',
    'customers/create-reset-link',
    'vehicles/add-vehicle',
    'vehicles/update-vehicle',
    'vehicles/deactivate-vehicle',
    'categories/add-category',
    'categories/update-category',
    'categories/delete-category',
    'bookings/update-status',
    'payments/update-payment',
    'messages/mark-read',
    'messages/delete-message',
];
if (!in_array($route, ['login', 'session'], true)) {
    requireAdmin($pdo);
}
if (in_array($route, $writes, true)) {
    requirePost();
    $data = input();
} elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendJson(false, 'Use GET for this request.', [], 405);
}

switch ($route) {
    case 'customers/create-reset-link':
        rateLimit($pdo, 'admin-reset-link', 20);
        $email = validEmail($data);
        if (($data['identity_verified'] ?? false) !== true) {
            sendJson(
                false,
                'Verify the customer identity before generating a reset link.',
                [],
                422,
            );
        }
        $pdo->beginTransaction();
        $customer = query(
            $pdo,
            'SELECT user_id,full_name,email FROM users WHERE email=? AND deleted_at IS NULL FOR UPDATE',
            [$email],
        )->fetch();
        if (!$customer) {
            $pdo->rollBack();
            sendJson(false, 'No customer found with that email.', [], 404);
        }
        $token = bin2hex(random_bytes(32));
        query($pdo, 'DELETE FROM password_resets WHERE user_id=?', [$customer['user_id']]);
        query(
            $pdo,
            'INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 30 MINUTE))',
            [$customer['user_id'], hash('sha256', $token)],
        );
        $pdo->commit();
        // Return a relative path; the frontend resolves it against the current application URL.
        sendJson(true, 'Reset link generated. Share it privately with the verified customer.', [
            'reset_path' => 'forgot-password.html?token=' . $token,
            'expires_in_minutes' => 30,
            'customer' => $customer,
        ]);
    case 'session':
        $admin = empty($_SESSION['admin_id'])
            ? false
            : query(
                $pdo,
                'SELECT admin_id AS id,full_name AS name,email FROM admins WHERE admin_id=?',
                [$_SESSION['admin_id']],
            )->fetch();
        sendJson(true, '', [
            'loggedIn' => (bool) $admin,
            'admin' => $admin ?: null,
            'csrfToken' => csrfToken(),
        ]);
    case 'login':
        rateLimit($pdo, 'admin-login');
        $email = validEmail($data);
        $password = passwordInput($data, 'password');
        $admin = query($pdo, 'SELECT * FROM admins WHERE email=?', [$email])->fetch();
        if (!$admin || !password_verify($password, $admin['password'])) {
            sendJson(false, 'Invalid administrator email or password.', [], 401);
        }
        session_regenerate_id(true);
        $_SESSION = ['admin_id' => (int) $admin['admin_id'], 'csrf' => bin2hex(random_bytes(32))];
        sendJson(true, 'Administrator login successful.', [
            'csrfToken' => csrfToken(),
            'admin' => ['id' => (int) $admin['admin_id'], 'name' => $admin['full_name']],
        ]);
    case 'logout':
        $_SESSION = [];
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'samesite' => 'Lax',
        ]);
        session_destroy();
        sendJson(true, 'Administrator logged out.');
    case 'dashboard':
        $stats = [];
        foreach (
            [
                'total_vehicles' => 'SELECT COUNT(*) FROM vehicles WHERE is_active=1',
                'available_vehicles' =>
                    "SELECT COUNT(*) FROM vehicles WHERE is_active=1 AND availability_status='Available'",
                'customers' => 'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL',
                'total_bookings' => 'SELECT COUNT(*) FROM bookings',
                'pending_bookings' =>
                    "SELECT COUNT(*) FROM bookings WHERE booking_status='Pending'",
                'confirmed_bookings' =>
                    "SELECT COUNT(*) FROM bookings WHERE booking_status='Confirmed'",
                'completed_rentals' =>
                    "SELECT COUNT(*) FROM bookings WHERE booking_status='Completed'",
            ]
            as $key => $sql
        ) {
            $stats[$key] = (int) query($pdo, $sql)->fetchColumn();
        }
        $stats['revenue'] = query(
            $pdo,
            "SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status='Paid'",
        )->fetchColumn();
        sendJson(true, '', [
            'statistics' => $stats,
            'recent_bookings' => query(
                $pdo,
                'SELECT b.*,u.full_name,v.vehicle_name FROM bookings b JOIN users u ON u.user_id=b.user_id JOIN vehicles v ON v.vehicle_id=b.vehicle_id ORDER BY b.created_at DESC,b.booking_id DESC LIMIT 8',
            )->fetchAll(),
            'recent_users' => query(
                $pdo,
                'SELECT user_id,full_name,email,created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC,user_id DESC LIMIT 8',
            )->fetchAll(),
            'booking_summary' => query(
                $pdo,
                'SELECT booking_status,COUNT(*) AS total FROM bookings GROUP BY booking_status',
            )->fetchAll(),
            'availability_summary' => query(
                $pdo,
                'SELECT availability_status,COUNT(*) AS total FROM vehicles WHERE is_active=1 GROUP BY availability_status',
            )->fetchAll(),
        ]);
    case 'vehicles/get-vehicles':
        $where = ['1=1'];
        $args = [];
        if (!empty($_GET['id'])) {
            $where[] = 'v.vehicle_id=?';
            $args[] = idValue($_GET['id']);
        }
        if (!empty($_GET['q'])) {
            $where[] = '(v.vehicle_name LIKE ? OR v.registration_number LIKE ? OR v.brand LIKE ?)';
            $q = '%' . sanitizeInput($_GET['q'], 100) . '%';
            array_push($args, $q, $q, $q);
        }
        if (!empty($_GET['category'])) {
            $where[] = 'v.category_id=?';
            $args[] = idValue($_GET['category']);
        }
        if (isset($_GET['is_active']) && $_GET['is_active'] !== '') {
            $where[] = 'v.is_active=?';
            $args[] = integerInput($_GET['is_active'], 0, 1);
        }
        if (!empty($_GET['status'])) {
            $where[] = 'v.availability_status=?';
            $args[] = enumInput($_GET, 'status', ['Available', 'Maintenance', 'Unavailable']);
        }
        $condition = implode(' AND ', $where);
        $paging = pagination(
            (int) query(
                $pdo,
                "SELECT COUNT(*) FROM vehicles v WHERE $condition",
                $args,
            )->fetchColumn(),
        );
        $rows = query(
            $pdo,
            "SELECT v.*,c.category_name FROM vehicles v JOIN vehicle_categories c ON c.category_id=v.category_id WHERE $condition ORDER BY v.vehicle_id DESC LIMIT {$paging['limit']} OFFSET {$paging['offset']}",
            $args,
        )->fetchAll();
        sendJson(true, '', ['vehicles' => $rows, 'pagination' => $paging]);
    case 'vehicles/add-vehicle':
    case 'vehicles/update-vehicle':
        $id = $route === 'vehicles/update-vehicle' ? idValue($data['vehicle_id'] ?? null) : null;
        if (
            $id &&
            !query($pdo, 'SELECT vehicle_id FROM vehicles WHERE vehicle_id=?', [$id])->fetch()
        ) {
            sendJson(false, 'Vehicle not found.', [], 404);
        }
        $values = validateVehicle($pdo, $data);
        $active = isset($data['is_active']) ? integerInput($data['is_active'], 0, 1) : null;
        if (
            query(
                $pdo,
                'SELECT vehicle_id FROM vehicles WHERE registration_number=? AND vehicle_id<>?',
                [$values['registration_number'], $id ?? 0],
            )->fetch()
        ) {
            sendJson(false, 'Registration number already exists.', [], 409);
        }
        require_once __DIR__ . '/helpers/uploads.php';
        $image = saveImage('image', 'vehicles', $id === null);
        $old = null;
        try {
            $pdo->beginTransaction();
            if ($id) {
                $existing = query($pdo, 'SELECT * FROM vehicles WHERE vehicle_id=? FOR UPDATE', [
                    $id,
                ])->fetch();
                if (!$existing) {
                    throw new RuntimeException('Vehicle removed during edit.');
                }
                $old = $existing['image'];
                $values['image'] = $image ?? $old;
                $values['is_active'] = $active ?? (int) $existing['is_active'];
                $sets = implode(',', array_map(fn($key) => $key . '=?', array_keys($values)));
                query($pdo, "UPDATE vehicles SET $sets WHERE vehicle_id=?", [
                    ...array_values($values),
                    $id,
                ]);
            } else {
                $values['image'] = $image;
                $columns = implode(',', array_keys($values));
                $marks = implode(',', array_fill(0, count($values), '?'));
                query(
                    $pdo,
                    "INSERT INTO vehicles ($columns) VALUES ($marks)",
                    array_values($values),
                );
                $id = (int) $pdo->lastInsertId();
            }
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            removeUploadedImage($image);
            if ($error instanceof PDOException && $error->getCode() === '23000') {
                sendJson(
                    false,
                    'Registration already exists or category is no longer available.',
                    [],
                    409,
                );
            }
            throw $error;
        }
        if ($image) {
            removeUploadedImage($old);
        }
        sendJson(
            true,
            'Vehicle saved.',
            ['vehicle_id' => $id],
            $route === 'vehicles/add-vehicle' ? 201 : 200,
        );
    case 'vehicles/deactivate-vehicle':
        $id = idValue($data['vehicle_id'] ?? null);
        if (!query($pdo, 'SELECT vehicle_id FROM vehicles WHERE vehicle_id=?', [$id])->fetch()) {
            sendJson(false, 'Vehicle not found.', [], 404);
        }
        query($pdo, 'UPDATE vehicles SET is_active=0 WHERE vehicle_id=?', [$id]);
        sendJson(true, 'Vehicle deactivated. Existing rental history is preserved.');
    case 'categories/get-categories':
        sendJson(true, '', [
            'categories' => query(
                $pdo,
                'SELECT c.*,(SELECT COUNT(*) FROM vehicles v WHERE v.category_id=c.category_id) AS vehicle_count FROM vehicle_categories c ORDER BY category_name',
            )->fetchAll(),
        ]);
    case 'categories/add-category':
    case 'categories/update-category':
        $id =
            $route === 'categories/update-category' ? idValue($data['category_id'] ?? null) : null;
        $name = required($data, 'category_name', 60);
        $description = required($data, 'description', 500);
        if (
            $id &&
            !query($pdo, 'SELECT category_id FROM vehicle_categories WHERE category_id=?', [
                $id,
            ])->fetch()
        ) {
            sendJson(false, 'Category not found.', [], 404);
        }
        try {
            if ($id) {
                query(
                    $pdo,
                    'UPDATE vehicle_categories SET category_name=?,description=? WHERE category_id=?',
                    [$name, $description, $id],
                );
            } else {
                query(
                    $pdo,
                    'INSERT INTO vehicle_categories(category_name,description) VALUES (?,?)',
                    [$name, $description],
                );
                $id = (int) $pdo->lastInsertId();
            }
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                sendJson(false, 'Category name already exists.', [], 409);
            }
            throw $error;
        }
        sendJson(
            true,
            'Category saved.',
            ['category_id' => $id],
            $route === 'categories/add-category' ? 201 : 200,
        );
    case 'categories/delete-category':
        $id = idValue($data['category_id'] ?? null);
        try {
            $statement = query($pdo, 'DELETE FROM vehicle_categories WHERE category_id=?', [$id]);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') {
                sendJson(
                    false,
                    'Cannot delete a category assigned to vehicles, including inactive vehicles.',
                    [],
                    409,
                );
            }
            throw $error;
        }
        if (!$statement->rowCount()) {
            sendJson(false, 'Category not found.', [], 404);
        }
        sendJson(true, 'Category deleted.');
    case 'bookings/get-bookings':
        $where = ['1=1'];
        $args = [];
        if (!empty($_GET['status'])) {
            $where[] = 'b.booking_status=?';
            $args[] = enumInput($_GET, 'status', [
                'Pending',
                'Confirmed',
                'Completed',
                'Cancelled',
            ]);
        }
        if (!empty($_GET['q'])) {
            $where[] =
                '(CAST(b.booking_id AS CHAR) LIKE ? OR b.booking_reference LIKE ? OR u.full_name LIKE ? OR v.vehicle_name LIKE ?)';
            $q = '%' . sanitizeInput($_GET['q'], 100) . '%';
            array_push($args, $q, $q, $q, $q);
        }
        $from =
            'FROM bookings b JOIN users u ON u.user_id=b.user_id JOIN vehicles v ON v.vehicle_id=b.vehicle_id WHERE ' .
            implode(' AND ', $where);
        $paging = pagination((int) query($pdo, 'SELECT COUNT(*) ' . $from, $args)->fetchColumn());
        sendJson(true, '', [
            'bookings' => query(
                $pdo,
                "SELECT b.*,u.full_name,u.email,v.vehicle_name $from ORDER BY b.booking_id DESC LIMIT {$paging['limit']} OFFSET {$paging['offset']}",
                $args,
            )->fetchAll(),
            'pagination' => $paging,
        ]);
    case 'bookings/get-booking':
        sendJson(true, '', ['booking' => adminBooking($pdo, idValue($_GET['id'] ?? null))]);
    case 'bookings/update-status':
        $id = idValue($data['booking_id'] ?? null);
        $next = enumInput($data, 'booking_status', [
            'Pending',
            'Confirmed',
            'Completed',
            'Cancelled',
        ]);
        $vehicleId = query($pdo, 'SELECT vehicle_id FROM bookings WHERE booking_id=?', [
            $id,
        ])->fetchColumn();
        if (!$vehicleId) {
            sendJson(false, 'Booking not found.', [], 404);
        }
        // Same lock order as customer booking creation: vehicle, then booking.
        $pdo->beginTransaction();
        $vehicle = query($pdo, 'SELECT * FROM vehicles WHERE vehicle_id=? FOR UPDATE', [
            $vehicleId,
        ])->fetch();
        $booking = query($pdo, 'SELECT * FROM bookings WHERE booking_id=? FOR UPDATE', [
            $id,
        ])->fetch();
        $flow = [
            'Pending' => ['Confirmed', 'Cancelled'],
            'Confirmed' => ['Completed', 'Cancelled'],
            'Completed' => [],
            'Cancelled' => [],
        ];
        if (
            $next !== $booking['booking_status'] &&
            !in_array($next, $flow[$booking['booking_status']], true)
        ) {
            $pdo->rollBack();
            sendJson(false, 'That booking status transition is not allowed.', [], 409);
        }
        if ($next !== $booking['booking_status'] && in_array($next, ['Confirmed'], true)) {
            if (!$vehicle['is_active'] || $vehicle['availability_status'] !== 'Available') {
                $pdo->rollBack();
                sendJson(false, 'Vehicle is inactive or unavailable.', [], 409);
            }
            $overlap = query(
                $pdo,
                "SELECT booking_id FROM bookings WHERE vehicle_id=? AND booking_id<>? AND booking_status IN ('Pending','Confirmed') AND pickup_date<? AND return_date>? LIMIT 1",
                [$vehicleId, $id, $booking['return_date'], $booking['pickup_date']],
            )->fetch();
            if ($overlap) {
                $pdo->rollBack();
                sendJson(false, 'Another booking overlaps these dates.', [], 409);
            }
        }
        query($pdo, 'UPDATE bookings SET booking_status=? WHERE booking_id=?', [$next, $id]);
        $pdo->commit();
        sendJson(true, 'Booking status updated.');
    case 'customers/get-customers':
        $args = [];
        $where = '1=1';
        if (!empty($_GET['q'])) {
            $where = '(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
            $q = '%' . sanitizeInput($_GET['q'], 100) . '%';
            $args = [$q, $q, $q];
        }
        $paging = pagination(
            (int) query($pdo, "SELECT COUNT(*) FROM users u WHERE $where", $args)->fetchColumn(),
        );
        sendJson(true, '', [
            'customers' => query(
                $pdo,
                "SELECT u.user_id,u.full_name,u.email,u.phone,u.driving_license,u.created_at,(SELECT COUNT(*) FROM bookings b WHERE b.user_id=u.user_id) AS booking_count FROM users u WHERE $where ORDER BY u.user_id DESC LIMIT {$paging['limit']} OFFSET {$paging['offset']}",
                $args,
            )->fetchAll(),
            'pagination' => $paging,
        ]);
    case 'customers/get-customer':
        $id = idValue($_GET['id'] ?? null);
        $customer = query(
            $pdo,
            'SELECT user_id,full_name,email,phone,address,driving_license,profile_image,created_at FROM users WHERE user_id=?',
            [$id],
        )->fetch();
        if (!$customer) {
            sendJson(false, 'Customer not found.', [], 404);
        }
        $customer['booking_count'] = (int) query(
            $pdo,
            'SELECT COUNT(*) FROM bookings WHERE user_id=?',
            [$id],
        )->fetchColumn();
        $customer['total_spent'] = query(
            $pdo,
            "SELECT COALESCE(SUM(p.amount),0) FROM payments p JOIN bookings b ON b.booking_id=p.booking_id WHERE b.user_id=? AND p.payment_status='Paid'",
            [$id],
        )->fetchColumn();
        sendJson(true, '', [
            'customer' => $customer,
            'bookings' => query(
                $pdo,
                'SELECT b.*,v.vehicle_name FROM bookings b JOIN vehicles v ON v.vehicle_id=b.vehicle_id WHERE b.user_id=? ORDER BY b.booking_id DESC',
                [$id],
            )->fetchAll(),
        ]);
    case 'payments/get-payments':
        $where = ['1=1'];
        $args = [];
        if (!empty($_GET['status'])) {
            $where[] = 'p.payment_status=?';
            $args[] = enumInput($_GET, 'status', ['Pending', 'Paid', 'Failed', 'Refunded']);
        }
        if (!empty($_GET['booking_id'])) {
            $where[] = 'p.booking_id=?';
            $args[] = idValue($_GET['booking_id']);
        }
        $from =
            'FROM payments p JOIN bookings b ON b.booking_id=p.booking_id JOIN users u ON u.user_id=b.user_id WHERE ' .
            implode(' AND ', $where);
        $paging = pagination((int) query($pdo, 'SELECT COUNT(*) ' . $from, $args)->fetchColumn());
        sendJson(true, '', [
            'payments' => query(
                $pdo,
                "SELECT p.*,u.full_name,u.email $from ORDER BY p.payment_id DESC LIMIT {$paging['limit']} OFFSET {$paging['offset']}",
                $args,
            )->fetchAll(),
            'pagination' => $paging,
        ]);
    case 'payments/update-payment':
        $id = idValue($data['payment_id'] ?? null);
        $next = enumInput($data, 'payment_status', ['Pending', 'Paid', 'Failed', 'Refunded']);
        $bookingId = query($pdo, 'SELECT booking_id FROM payments WHERE payment_id=?', [
            $id,
        ])->fetchColumn();
        if (!$bookingId) {
            sendJson(false, 'Payment not found.', [], 404);
        }
        $vehicleId = query($pdo, 'SELECT vehicle_id FROM bookings WHERE booking_id=?', [
            $bookingId,
        ])->fetchColumn();
        $pdo->beginTransaction();
        $vehicle = query($pdo, 'SELECT * FROM vehicles WHERE vehicle_id=? FOR UPDATE', [
            $vehicleId,
        ])->fetch();
        $booking = query($pdo, 'SELECT * FROM bookings WHERE booking_id=? FOR UPDATE', [
            $bookingId,
        ])->fetch();
        $payment = query($pdo, 'SELECT * FROM payments WHERE payment_id=? FOR UPDATE', [
            $id,
        ])->fetch();
        $flow = [
            'Pending' => ['Paid', 'Failed'],
            'Failed' => ['Pending', 'Paid'],
            'Paid' => ['Refunded'],
            'Refunded' => [],
        ];
        if (
            $next !== $payment['payment_status'] &&
            !in_array($next, $flow[$payment['payment_status']], true)
        ) {
            $pdo->rollBack();
            sendJson(false, 'That payment status transition is not allowed.', [], 409);
        }
        if ($next === 'Paid' && $payment['payment_status'] !== 'Paid') {
            $paid = query(
                $pdo,
                "SELECT COALESCE(SUM(amount),0) FROM payments WHERE booking_id=? AND payment_id<>? AND payment_status='Paid'",
                [$bookingId, $id],
            )->fetchColumn();
            if (
                round(((float) $paid + (float) $payment['amount']) * 100) >
                round((float) $booking['total_amount'] * 100)
            ) {
                $pdo->rollBack();
                sendJson(false, 'Payment would exceed the booking total.', [], 409);
            }
            if ($booking['booking_status'] === 'Cancelled') {
                $pdo->rollBack();
                sendJson(false, 'Cannot collect a new payment for a cancelled booking.', [], 409);
            }
        }
        $method = isset($data['payment_method'])
            ? enumInput($data, 'payment_method', ['Cash', 'Card', 'Bank Transfer', 'Online'])
            : $payment['payment_method'];
        $reference = isset($data['transaction_reference'])
            ? sanitizeInput($data['transaction_reference'], 150)
            : $payment['transaction_reference'];
        query(
            $pdo,
            "UPDATE payments SET payment_status=?,payment_method=?,transaction_reference=?,payment_date=CASE WHEN ?='Paid' THEN COALESCE(payment_date,NOW()) ELSE payment_date END WHERE payment_id=?",
            [$next, $method, $reference, $next, $id],
        );
        $totals = query(
            $pdo,
            "SELECT COALESCE(SUM(CASE WHEN payment_status='Paid' THEN amount ELSE 0 END),0) AS paid,SUM(payment_status='Refunded') AS refunded,SUM(payment_status='Pending') AS pending,SUM(payment_status='Failed') AS failed FROM payments WHERE booking_id=?",
            [$bookingId],
        )->fetch();
        $status =
            (float) $totals['paid'] >= (float) $booking['total_amount']
                ? 'Paid'
                : ((float) $totals['paid'] > 0
                    ? 'Pending'
                    : ($totals['pending']
                        ? 'Pending'
                        : ($totals['refunded']
                            ? 'Refunded'
                            : ($totals['failed']
                                ? 'Failed'
                                : 'Pending'))));
        $bookingStatus = $booking['booking_status'];
        if ($status === 'Paid' && $bookingStatus === 'Pending') {
            if (
                !$vehicle ||
                !$vehicle['is_active'] ||
                $vehicle['availability_status'] !== 'Available'
            ) {
                $pdo->rollBack();
                sendJson(false, 'Vehicle unavailable. Payment was not recorded.', [], 409);
            }
            $overlap = query(
                $pdo,
                "SELECT booking_id FROM bookings WHERE vehicle_id=? AND booking_id<>? AND booking_status IN ('Pending','Confirmed') AND pickup_date<? AND return_date>? LIMIT 1",
                [$vehicleId, $bookingId, $booking['return_date'], $booking['pickup_date']],
            )->fetch();
            if ($overlap) {
                $pdo->rollBack();
                sendJson(
                    false,
                    'Dates conflict with another booking. Payment was not recorded.',
                    [],
                    409,
                );
            }
            $bookingStatus = 'Confirmed';
        }
        query($pdo, 'UPDATE bookings SET payment_status=?,booking_status=? WHERE booking_id=?', [
            $status,
            $bookingStatus,
            $bookingId,
        ]);
        $pdo->commit();
        sendJson(true, 'Payment record updated.', ['booking_payment_status' => $status]);
    case 'messages/get-messages':
        $where = '1=1';
        $args = [];
        if (isset($_GET['is_read']) && $_GET['is_read'] !== '') {
            $where = 'is_read=?';
            $args[] = integerInput($_GET['is_read'], 0, 1);
        }
        $paging = pagination(
            (int) query(
                $pdo,
                "SELECT COUNT(*) FROM contact_messages WHERE $where",
                $args,
            )->fetchColumn(),
        );
        sendJson(true, '', [
            'messages' => query(
                $pdo,
                "SELECT * FROM contact_messages WHERE $where ORDER BY message_id DESC LIMIT {$paging['limit']} OFFSET {$paging['offset']}",
                $args,
            )->fetchAll(),
            'pagination' => $paging,
        ]);
    case 'messages/mark-read':
    case 'messages/delete-message':
        $id = idValue($data['message_id'] ?? null);
        if (
            !query($pdo, 'SELECT message_id FROM contact_messages WHERE message_id=?', [
                $id,
            ])->fetch()
        ) {
            sendJson(false, 'Message not found.', [], 404);
        }
        query(
            $pdo,
            $route === 'messages/mark-read'
                ? 'UPDATE contact_messages SET is_read=1 WHERE message_id=?'
                : 'DELETE FROM contact_messages WHERE message_id=?',
            [$id],
        );
        sendJson(
            true,
            $route === 'messages/mark-read' ? 'Message marked as read.' : 'Message deleted.',
        );
    case 'reports/get-reports':
        [$from, $to] = reportDates();
        $range = [$from, $to];
        $stats = query(
            $pdo,
            "SELECT COUNT(*) AS total_bookings,COALESCE(SUM(booking_status='Completed'),0) AS completed_bookings,COALESCE(SUM(booking_status='Cancelled'),0) AS cancelled_bookings FROM bookings WHERE created_at>=? AND created_at<?",
            $range,
        )->fetch();
        $stats['revenue'] = query(
            $pdo,
            "SELECT COALESCE(SUM(amount),0) FROM payments WHERE payment_status='Paid' AND payment_date>=? AND payment_date<?",
            $range,
        )->fetchColumn();
        $months = query(
            $pdo,
            "SELECT DATE_FORMAT(payment_date,'%Y-%m') AS month,SUM(amount) AS revenue FROM payments WHERE payment_status='Paid' AND payment_date>=? AND payment_date<? GROUP BY DATE_FORMAT(payment_date,'%Y-%m') ORDER BY month",
            $range,
        )->fetchAll();
        $vehicles = query(
            $pdo,
            "SELECT v.vehicle_id,v.vehicle_name,COUNT(*) AS rentals FROM bookings b JOIN vehicles v ON v.vehicle_id=b.vehicle_id WHERE b.created_at>=? AND b.created_at<? AND b.booking_status<>'Cancelled' GROUP BY v.vehicle_id,v.vehicle_name ORDER BY rentals DESC,v.vehicle_id LIMIT 10",
            $range,
        )->fetchAll();
        $categories = query(
            $pdo,
            "SELECT c.category_id,c.category_name,COUNT(*) AS rentals FROM bookings b JOIN vehicles v ON v.vehicle_id=b.vehicle_id JOIN vehicle_categories c ON c.category_id=v.category_id WHERE b.created_at>=? AND b.created_at<? AND b.booking_status<>'Cancelled' GROUP BY c.category_id,c.category_name ORDER BY rentals DESC,c.category_id LIMIT 10",
            $range,
        )->fetchAll();
        $customers = query(
            $pdo,
            'SELECT u.user_id,u.full_name,COUNT(*) AS bookings FROM bookings b JOIN users u ON u.user_id=b.user_id WHERE b.created_at>=? AND b.created_at<? GROUP BY u.user_id,u.full_name ORDER BY bookings DESC,u.user_id LIMIT 10',
            $range,
        )->fetchAll();
        sendJson(true, '', [
            'statistics' => $stats,
            'revenue_by_month' => $months,
            'most_rented_vehicles' => $vehicles,
            'popular_categories' => $categories,
            'top_customers' => $customers,
        ]);
    default:
        sendJson(false, 'Endpoint not found.', [], 404);
}
