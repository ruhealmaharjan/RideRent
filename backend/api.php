<?php
declare(strict_types=1);
require_once __DIR__ . '/helpers/functions.php';
require_once __DIR__ . '/config/database.php';
restoreLogin($pdo);
$route = $route ?? '';
$postRoutes = [
    'auth/register',
    'auth/login',
    'auth/logout',
    'auth/change-password',
    'auth/forgot-password',
    'auth/reset-password',
    'bookings/create-booking',
    'bookings/cancel-booking',
    'users/update-profile',
    'users/delete-account',
    'users/upload-profile-image',
    'contact/submit-message',
    'reviews/submit-review',
];
if (in_array($route, $postRoutes, true)) {
    requirePost();
    $data = input();
} elseif ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    sendJson(false, 'Use GET for this request.', [], 405);
}

switch ($route) {
    case 'vehicles/get-categories':
        sendJson(true, '', [
            'categories' => query(
                $pdo,
                'SELECT category_id,category_name,description FROM vehicle_categories ORDER BY category_name',
            )->fetchAll(),
        ]);
    case 'users/delete-account':
        $uid = requireLogin();
        rateLimit($pdo, 'delete-account');
        if (($data['confirmation'] ?? '') !== 'DELETE') {
            sendJson(false, 'Type DELETE to confirm account deletion.', [], 422);
        }
        $password = passwordInput($data, 'current_password');
        $pdo->beginTransaction();
        $user = query(
            $pdo,
            'SELECT password,profile_image FROM users WHERE user_id=? AND deleted_at IS NULL FOR UPDATE',
            [$uid],
        )->fetch();
        if (!$user || !password_verify($password, $user['password'])) {
            $pdo->rollBack();
            sendJson(false, 'Current password is incorrect.', [], 422);
        }
        if (
            query(
                $pdo,
                "SELECT booking_id FROM bookings WHERE user_id=? AND booking_status IN ('Pending','Confirmed') LIMIT 1",
                [$uid],
            )->fetch()
        ) {
            $pdo->rollBack();
            sendJson(
                false,
                'Resolve your pending or confirmed rentals before deleting your account.',
                [],
                409,
            );
        }
        query(
            $pdo,
            "UPDATE users SET full_name='Deleted customer',email=?,phone='',address='',driving_license='',profile_image=NULL,password=?,deleted_at=NOW() WHERE user_id=?",
            [
                'deleted-' . $uid . '-' . bin2hex(random_bytes(8)) . '@removed.invalid',
                password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
                $uid,
            ],
        );
        query($pdo, 'DELETE FROM remember_tokens WHERE user_id=?', [$uid]);
        query($pdo, 'DELETE FROM password_resets WHERE user_id=?', [$uid]);
        query($pdo, 'DELETE FROM favorites WHERE user_id=?', [$uid]);
        query(
            $pdo,
            'DELETE r FROM reviews r JOIN bookings b ON b.booking_id=r.booking_id WHERE b.user_id=?',
            [$uid],
        );
        query($pdo, "DELETE FROM notification_reads WHERE reader_role='customer' AND reader_id=?", [
            $uid,
        ]);
        query($pdo, "DELETE FROM notifications WHERE audience='customer' AND user_id=?", [$uid]);
        $pdo->commit();
        require_once __DIR__ . '/helpers/uploads.php';
        removeUploadedImage($user['profile_image'] ?: null);
        rememberCookie('', time() - 3600);
        $_SESSION = [];
        session_destroy();
        sendJson(true, 'Your account and profile details have been removed.');
    case 'users/upload-profile-image':
        $uid = requireLogin();
        require_once __DIR__ . '/helpers/uploads.php';
        $path = saveImage('image', 'profiles');
        try {
            $pdo->beginTransaction();
            $old = query($pdo, 'SELECT profile_image FROM users WHERE user_id=? FOR UPDATE', [
                $uid,
            ])->fetchColumn();
            query($pdo, 'UPDATE users SET profile_image=? WHERE user_id=?', [$path, $uid]);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            removeUploadedImage($path);
            throw $error;
        }
        removeUploadedImage($old ?: null);
        sendJson(true, 'Profile image updated.', ['profile_image' => $path]);
    case 'auth/session':
        sendJson(true, '', [
            'loggedIn' => !empty($_SESSION['user_id']),
            'user' => empty($_SESSION['user_id'])
                ? null
                : ['id' => (int) $_SESSION['user_id'], 'name' => $_SESSION['user_name']],
            'csrfToken' => csrfToken(),
        ]);
    case 'auth/register':
        rateLimit($pdo, 'register');
        [$name, $phone, $address, $license] = validateProfile($data);
        $email = validEmail($data);
        $password = validatePassword($data);
        try {
            query(
                $pdo,
                'INSERT INTO users (full_name,email,phone,address,driving_license,password) VALUES (?,?,?,?,?,?)',
                [
                    $name,
                    $email,
                    $phone,
                    $address,
                    $license,
                    password_hash($password, PASSWORD_DEFAULT),
                ],
            );
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                sendJson(false, 'Email already exists.', [], 409);
            }
            throw $e;
        }
        sendJson(true, 'Registration successful. You can now log in.', [], 201);
    case 'auth/login':
        rateLimit($pdo, 'login');
        $email = validEmail($data);
        $password = passwordInput($data, 'password');
        $user = query(
            $pdo,
            'SELECT user_id,full_name,password FROM users WHERE email=? AND deleted_at IS NULL',
            [$email],
        )->fetch();
        if (!$user || !password_verify($password, $user['password'])) {
            sendJson(false, 'Invalid email or password.', [], 401);
        }
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $user['user_id'];
        $_SESSION['user_name'] = $user['full_name'];
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
        if (!empty($_COOKIE['riderent_remember'])) {
            query($pdo, 'DELETE FROM remember_tokens WHERE token_hash=?', [
                hash('sha256', $_COOKIE['riderent_remember']),
            ]);
            rememberCookie('', time() - 3600);
        }
        if (!empty($data['remember'])) {
            $token = bin2hex(random_bytes(32));
            query(
                $pdo,
                'INSERT INTO remember_tokens (user_id,token_hash,expires_at) VALUES (?,?,DATE_ADD(NOW(),INTERVAL 30 DAY))',
                [$user['user_id'], hash('sha256', $token)],
            );
            rememberCookie($token, time() + 2592000);
        }
        sendJson(true, 'Login successful.', ['csrfToken' => csrfToken()]);
    case 'auth/logout':
        if (!empty($_COOKIE['riderent_remember'])) {
            query($pdo, 'DELETE FROM remember_tokens WHERE token_hash=?', [
                hash('sha256', $_COOKIE['riderent_remember']),
            ]);
        }
        rememberCookie('', time() - 3600);
        $_SESSION = [];
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_destroy();
        sendJson(true, 'Logged out.');
    case 'auth/change-password':
        $uid = requireLogin();
        $password = validatePassword($data, 'new_password');
        $hash = query($pdo, 'SELECT password FROM users WHERE user_id=?', [$uid])->fetchColumn();
        if (!password_verify(passwordInput($data, 'current_password'), $hash)) {
            sendJson(false, 'Current password is incorrect.', [], 422);
        }
        $pdo->beginTransaction();
        query($pdo, 'UPDATE users SET password=? WHERE user_id=?', [
            password_hash($password, PASSWORD_DEFAULT),
            $uid,
        ]);
        query($pdo, 'DELETE FROM remember_tokens WHERE user_id=?', [$uid]);
        query($pdo, 'DELETE FROM password_resets WHERE user_id=?', [$uid]);
        $pdo->commit();
        session_regenerate_id(true);
        sendJson(true, 'Password updated successfully.');
    case 'auth/forgot-password':
        rateLimit($pdo, 'reset', 5);
        validEmail($data);
        sendJson(
            true,
            'Contact the RideRent administrator to verify your identity and receive a password-reset link. No email service is required.',
        );
    case 'auth/reset-password':
        rateLimit($pdo, 'reset-submit');
        $password = validatePassword($data);
        $token = required($data, 'token', 64);
        $pdo->beginTransaction();
        $reset = query(
            $pdo,
            'SELECT * FROM password_resets WHERE token_hash=? AND expires_at>NOW() FOR UPDATE',
            [hash('sha256', $token)],
        )->fetch();
        if (!$reset) {
            $pdo->rollBack();
            sendJson(false, 'This reset link is invalid or expired.', [], 422);
        }
        query($pdo, 'UPDATE users SET password=? WHERE user_id=?', [
            password_hash($password, PASSWORD_DEFAULT),
            $reset['user_id'],
        ]);
        query($pdo, 'DELETE FROM password_resets WHERE user_id=?', [$reset['user_id']]);
        query($pdo, 'DELETE FROM remember_tokens WHERE user_id=?', [$reset['user_id']]);
        $pdo->commit();
        sendJson(true, 'Password reset. Log in with your new password.');
    case 'vehicles/get-vehicles':
    case 'vehicles/search-vehicles':
        $where = ['v.is_active=1', "v.availability_status='Available'"];
        $params = [];
        foreach (
            [
                'category' => 'v.category_id',
                'brand' => 'v.brand',
                'fuel' => 'v.fuel_type',
                'transmission' => 'v.transmission',
            ]
            as $key => $column
        ) {
            if (($_GET[$key] ?? '') !== '') {
                $where[] = "$column=?";
                $params[] = sanitizeInput($_GET[$key]);
            }
        }
        foreach (['min_price' => '>=', 'max_price' => '<='] as $key => $operator) {
            if (($_GET[$key] ?? '') !== '') {
                if (!is_numeric($_GET[$key]) || (float) $_GET[$key] < 0) {
                    sendJson(false, 'Enter a valid price.', [], 422);
                }
                $where[] = "v.price_per_day $operator ?";
                $params[] = $_GET[$key];
            }
        }
        if (!empty($_GET['q'])) {
            $where[] =
                '(v.vehicle_name LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR c.category_name LIKE ?)';
            $q = '%' . sanitizeInput($_GET['q'], 100) . '%';
            array_push($params, $q, $q, $q, $q);
        }
        if (!empty($_GET['pickup_date']) || !empty($_GET['return_date'])) {
            $pickup = sanitizeInput($_GET['pickup_date'] ?? '');
            $return = sanitizeInput($_GET['return_date'] ?? '');
            dates($pickup, $return);
            $where[] =
                "NOT EXISTS (SELECT 1 FROM bookings b WHERE b.vehicle_id=v.vehicle_id AND b.booking_status IN ('Pending','Confirmed') AND b.pickup_date<? AND b.return_date>?)";
            array_push($params, $return, $pickup);
        }
        $clause = implode(' AND ', $where);
        $count = (int) query(
            $pdo,
            "SELECT COUNT(*) FROM vehicles v JOIN vehicle_categories c ON c.category_id=v.category_id WHERE $clause",
            $params,
        )->fetchColumn();
        $limit = max(1, min(24, (int) ($_GET['limit'] ?? 9)));
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $pages = max(1, (int) ceil($count / $limit));
        $page = min($page, $pages);
        $offset = ($page - 1) * $limit;
        $sort =
            [
                'price_asc' => 'v.price_per_day ASC',
                'price_desc' => 'v.price_per_day DESC',
                'name_asc' => 'v.vehicle_name ASC',
                'newest' => 'v.created_at DESC',
            ]['' . ($_GET['sort'] ?? 'newest')] ?? 'v.created_at DESC';
        $vehicles = query(
            $pdo,
            "SELECT v.*,c.category_name FROM vehicles v JOIN vehicle_categories c ON c.category_id=v.category_id WHERE $clause ORDER BY $sort,v.vehicle_id ASC LIMIT $limit OFFSET $offset",
            $params,
        )->fetchAll();
        sendJson(true, '', [
            'vehicles' => $vehicles,
            'pagination' => [
                'page' => $page,
                'pages' => $pages,
                'total' => $count,
                'limit' => $limit,
            ],
            'categories' => query(
                $pdo,
                'SELECT * FROM vehicle_categories ORDER BY category_id',
            )->fetchAll(),
            'brands' => query(
                $pdo,
                'SELECT DISTINCT brand FROM vehicles WHERE is_active=1 ORDER BY brand',
            )->fetchAll(PDO::FETCH_COLUMN),
        ]);
    case 'vehicles/get-vehicle':
        sendJson(true, '', ['vehicle' => getVehicle($pdo, idValue($_GET['id'] ?? null))]);
    case 'vehicles/check-availability':
        $vehicle = getVehicle($pdo, idValue($_GET['vehicle_id'] ?? null));
        $pickup = sanitizeInput($_GET['pickup_date'] ?? '');
        $return = sanitizeInput($_GET['return_date'] ?? '');
        $days = dates($pickup, $return);
        $available =
            $vehicle['availability_status'] === 'Available' &&
            isVehicleAvailable((int) $vehicle['vehicle_id'], $pickup, $return, $pdo);
        sendJson(
            true,
            $available ? 'Vehicle available.' : 'Vehicle unavailable for selected dates.',
            [
                'available' => $available,
                'total_days' => $days,
                'total_amount' => calculateRentalTotal($days, $vehicle['price_per_day']),
            ],
        );
    case 'bookings/create-booking':
        $uid = requireLogin();
        $id = idValue($data['vehicle_id'] ?? null);
        $pickup = required($data, 'pickup_date', 10);
        $return = required($data, 'return_date', 10);
        $days = dates($pickup, $return);
        // Serialize all booking creation for this vehicle, including concurrent requests.
        $pdo->beginTransaction();
        if (
            !query(
                $pdo,
                'SELECT user_id FROM users WHERE user_id=? AND deleted_at IS NULL FOR UPDATE',
                [$uid],
            )->fetch()
        ) {
            $pdo->rollBack();
            sendJson(false, 'Please log in to continue.', [], 401);
        }
        $vehicle = getVehicle($pdo, $id, true);
        if (
            $vehicle['availability_status'] !== 'Available' ||
            !isVehicleAvailable($id, $pickup, $return, $pdo)
        ) {
            $pdo->rollBack();
            sendJson(
                false,
                'This vehicle is unavailable for the selected dates. Please choose another date.',
                [],
                409,
            );
        }
        $total = calculateRentalTotal($days, $vehicle['price_per_day']);
        query(
            $pdo,
            'INSERT INTO bookings (user_id,vehicle_id,pickup_date,return_date,total_days,price_per_day,total_amount) VALUES (?,?,?,?,?,?,?)',
            [$uid, $id, $pickup, $return, $days, $vehicle['price_per_day'], $total],
        );
        $bookingId = (int) $pdo->lastInsertId();
        query($pdo, 'INSERT INTO payments (booking_id,amount,payment_method) VALUES (?,?,?)', [
            $bookingId,
            $total,
            'Cash',
        ]);
        $pdo->commit();
        sendJson(true, 'Booking created successfully.', ['booking_id' => $bookingId], 201);
    case 'bookings/get-bookings':
    case 'bookings/get-booking':
        $uid = requireLogin();
        $where = 'b.user_id=?';
        $values = [$uid];
        if ($route === 'bookings/get-booking') {
            $where .= ' AND b.booking_id=?';
            $values[] = idValue($_GET['id'] ?? null);
        } elseif (!empty($_GET['status'])) {
            if (
                !in_array($_GET['status'], ['Pending', 'Confirmed', 'Completed', 'Cancelled'], true)
            ) {
                sendJson(false, 'Invalid booking status.', [], 422);
            }
            $where .= ' AND b.booking_status=?';
            $values[] = $_GET['status'];
        }
        $rows = query(
            $pdo,
            "SELECT b.*,v.vehicle_name,v.brand,v.model,v.image,u.full_name,u.email,u.phone,u.address,EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id=b.booking_id) AS reviewed FROM bookings b JOIN vehicles v ON v.vehicle_id=b.vehicle_id JOIN users u ON u.user_id=b.user_id WHERE $where ORDER BY b.created_at DESC,b.booking_id DESC",
            $values,
        )->fetchAll();
        if ($route === 'bookings/get-booking') {
            if (!$rows) {
                sendJson(false, 'Booking not found.', [], 404);
            }
            $booking = $rows[0];
            $booking['payments'] = query(
                $pdo,
                'SELECT payment_id,amount,payment_method,transaction_reference,payment_status,payment_date FROM payments WHERE booking_id=?',
                [$booking['booking_id']],
            )->fetchAll();
            sendJson(true, '', ['booking' => $booking]);
        }
        sendJson(true, '', ['bookings' => $rows]);
    case 'bookings/cancel-booking':
        $uid = requireLogin();
        $id = idValue($data['booking_id'] ?? null);
        $statement = query(
            $pdo,
            "UPDATE bookings SET booking_status='Cancelled' WHERE booking_id=? AND user_id=? AND booking_status IN ('Pending','Confirmed')",
            [$id, $uid],
        );
        if (!$statement->rowCount()) {
            sendJson(false, 'Booking not found or no longer eligible for cancellation.', [], 409);
        }
        sendJson(
            true,
            'Booking cancelled successfully. Contact the rental desk about any paid amount.',
        );
    case 'users/get-profile':
        sendJson(true, '', ['user' => userProfile($pdo, requireLogin())]);
    case 'users/update-profile':
        $uid = requireLogin();
        [$name, $phone, $address, $license] = validateProfile($data);
        query(
            $pdo,
            'UPDATE users SET full_name=?,phone=?,address=?,driving_license=? WHERE user_id=?',
            [$name, $phone, $address, $license, $uid],
        );
        $_SESSION['user_name'] = $name;
        sendJson(true, 'Profile updated successfully.');
    case 'contact/submit-message':
        rateLimit($pdo, 'contact', 10);
        $name = required($data, 'full_name', 100);
        $email = validEmail($data);
        $phone = required($data, 'phone', 30);
        if (!preg_match('/^[+0-9 ()-]{7,30}$/', $phone)) {
            sendJson(false, 'Enter a valid phone number.', [], 422);
        }
        query(
            $pdo,
            'INSERT INTO contact_messages (name,email,phone,subject,message) VALUES (?,?,?,?,?)',
            [
                $name,
                $email,
                $phone,
                required($data, 'subject', 150),
                required($data, 'message', 5000),
            ],
        );
        sendJson(true, 'Message received. Thank you for contacting RideRent.', [], 201);
    case 'reviews/get-reviews':
        $id = idValue($_GET['vehicle_id'] ?? null);
        getVehicle($pdo, $id);
        $reviews = query(
            $pdo,
            'SELECT r.rating,r.review_text,r.created_at,u.full_name FROM reviews r JOIN bookings b ON b.booking_id=r.booking_id JOIN users u ON u.user_id=b.user_id WHERE b.vehicle_id=? ORDER BY r.created_at DESC',
            [$id],
        )->fetchAll();
        $eligible = empty($_SESSION['user_id'])
            ? []
            : query(
                $pdo,
                "SELECT b.booking_id,b.booking_reference,b.pickup_date,b.return_date FROM bookings b WHERE b.user_id=? AND b.vehicle_id=? AND b.booking_status IN ('Confirmed','Completed') AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id=b.booking_id)",
                [$_SESSION['user_id'], $id],
            )->fetchAll();
        sendJson(true, '', [
            'reviews' => $reviews,
            'average' => count($reviews)
                ? round(array_sum(array_column($reviews, 'rating')) / count($reviews), 1)
                : null,
            'eligible_bookings' => $eligible,
            'loggedIn' => !empty($_SESSION['user_id']),
            'has_reviewed' =>
                !empty($_SESSION['user_id']) &&
                (bool) query(
                    $pdo,
                    'SELECT 1 FROM reviews r JOIN bookings b ON b.booking_id=r.booking_id WHERE b.user_id=? AND b.vehicle_id=? LIMIT 1',
                    [$_SESSION['user_id'], $id],
                )->fetchColumn(),
        ]);
    case 'reviews/submit-review':
        $uid = requireLogin();
        $id = idValue($data['booking_id'] ?? null);
        $rating = filter_var($data['rating'] ?? null, FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 5],
        ]);
        if (!$rating) {
            sendJson(false, 'Choose a rating from 1 to 5.', [], 422);
        }
        $text = required($data, 'review_text', 2000);
        if (
            !query(
                $pdo,
                "SELECT booking_id FROM bookings WHERE booking_id=? AND user_id=? AND booking_status IN ('Confirmed','Completed')",
                [$id, $uid],
            )->fetch()
        ) {
            sendJson(false, 'Only your confirmed or completed rentals can be reviewed.', [], 403);
        }
        try {
            query($pdo, 'INSERT INTO reviews (booking_id,rating,review_text) VALUES (?,?,?)', [
                $id,
                $rating,
                $text,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                sendJson(false, 'This booking already has a review.', [], 409);
            }
            throw $e;
        }
        sendJson(true, 'Thank you for your review.', [], 201);
    case 'public/stats':
        sendJson(true, '', [
            'vehicles' => (int) query(
                $pdo,
                'SELECT COUNT(*) FROM vehicles WHERE is_active=1',
            )->fetchColumn(),
            'customers' => (int) query(
                $pdo,
                'SELECT COUNT(*) FROM users WHERE deleted_at IS NULL',
            )->fetchColumn(),
            'rentals' => (int) query(
                $pdo,
                "SELECT COUNT(*) FROM bookings WHERE booking_status='Completed'",
            )->fetchColumn(),
        ]);
    default:
        sendJson(false, 'Endpoint not found.', [], 404);
}
