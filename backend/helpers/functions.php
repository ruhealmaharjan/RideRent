<?php
declare(strict_types=1);
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/csrf.php';

// JSON-only backend helpers. Do not include frontend templates here.
ini_set('display_errors', '0');
date_default_timezone_set(getenv('APP_TIMEZONE') ?: 'Asia/Kathmandu');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
session_name(defined('RIDERENT_ADMIN') && RIDERENT_ADMIN ? 'riderent_admin' : 'riderent_customer');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);
ini_set('session.use_strict_mode', '1');
session_start();
set_exception_handler(function (Throwable $error): void {
    error_log('RideRent: ' . $error->getMessage());
    sendJson(
        false,
        'The server could not complete this request. Check the database connection and try again.',
        [],
        500,
    );
});

function query(PDO $pdo, string $sql, array $values = []): PDOStatement
{
    $statement = $pdo->prepare($sql);
    $statement->execute($values);
    return $statement;
}
function sanitizeInput(mixed $value, int $max = 255): string
{
    if (!is_string($value) && !is_numeric($value)) {
        sendJson(false, 'Invalid input type.', [], 422);
    }
    $value = trim((string) $value);
    if (strlen($value) > $max) {
        sendJson(false, 'One of the fields is too long.', [], 422);
    }
    return $value;
}
function required(array $data, string $key, int $max = 255): string
{
    $value = sanitizeInput($data[$key] ?? '', $max);
    if ($value === '') {
        sendJson(false, 'Please complete all required fields.', [], 422);
    }
    return $value;
}
function input(): array
{
    $raw = file_get_contents('php://input');
    if (str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data)) {
            sendJson(false, 'Invalid JSON request.', [], 400);
        }
        return $data;
    }
    return $_POST;
}
function requireLogin(): int
{
    if (empty($_SESSION['user_id'])) {
        sendJson(false, 'Please log in to continue.', [], 401);
    }
    return (int) $_SESSION['user_id'];
}
function idValue(mixed $value): int
{
    $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if (!$id) {
        sendJson(false, 'A valid record ID is required.', [], 422);
    }
    return $id;
}
function dates(string $pickup, string $return, bool $allowPast = true): int
{
    $a = DateTimeImmutable::createFromFormat('!Y-m-d', $pickup);
    $b = DateTimeImmutable::createFromFormat('!Y-m-d', $return);
    if (
        !$a ||
        !$b ||
        $a->format('Y-m-d') !== $pickup ||
        $b->format('Y-m-d') !== $return ||
        $b <= $a ||
        (!$allowPast && $a < new DateTimeImmutable('today'))
    ) {
        sendJson(false, 'Choose valid dates with the return date after pickup.', [], 422);
    }
    $days = (int) $a->diff($b)->days;
    if ($days > 365) {
        sendJson(false, 'Rentals may not exceed 365 days.', [], 422);
    }
    return $days;
}
function calculateRentalDays(string $pickup, string $return): int
{
    return dates($pickup, $return);
}
function calculateRentalTotal(int $days, string $price): string
{
    $cents = (int) round((float) $price * 100);
    return number_format(($days * $cents) / 100, 2, '.', '');
}
function getVehicle(PDO $pdo, int $id, bool $lock = false): array
{
    $vehicle = query(
        $pdo,
        'SELECT v.*, c.category_name FROM vehicles v JOIN vehicle_categories c ON c.category_id=v.category_id WHERE v.vehicle_id=? AND v.is_active=1' .
            ($lock ? ' FOR UPDATE' : ''),
        [$id],
    )->fetch();
    if (!$vehicle) {
        sendJson(false, 'Vehicle not found.', [], 404);
    }
    return $vehicle;
}
function isVehicleAvailable(int $id, string $pickup, string $return, PDO $pdo): bool
{
    return !query(
        $pdo,
        "SELECT booking_id FROM bookings WHERE vehicle_id=? AND booking_status IN ('Pending','Confirmed') AND pickup_date < ? AND return_date > ? LIMIT 1",
        [$id, $return, $pickup],
    )->fetch();
}
function userProfile(PDO $pdo, int $id): array
{
    $user = query(
        $pdo,
        'SELECT user_id,full_name,email,phone,address,driving_license,profile_image,created_at,(SELECT COUNT(*) FROM bookings WHERE user_id=u.user_id) AS booking_count FROM users u WHERE user_id=?',
        [$id],
    )->fetch();
    if (!$user) {
        sendJson(false, 'Account not found.', [], 401);
    }
    return $user;
}
function validateProfile(array $data): array
{
    $name = required($data, 'full_name', 100);
    $phone = required($data, 'phone', 30);
    if (!preg_match('/^[+0-9 ()-]{7,30}$/', $phone)) {
        sendJson(false, 'Enter a valid phone number.', [], 422);
    }
    return [$name, $phone, required($data, 'address', 500), required($data, 'driving_license', 80)];
}
function validatePassword(array $data, string $key = 'password'): string
{
    $password = $data[$key] ?? '';
    if (
        !is_string($password) ||
        !preg_match('//u', $password) ||
        preg_match_all('/./us', $password) < 8 ||
        !preg_match('/[A-Z]/', $password) ||
        !preg_match('/[0-9]/', $password) ||
        !preg_match('/[\p{P}\p{S}]/u', $password)
    ) {
        sendJson(
            false,
            'Password must have at least 8 characters, one uppercase letter (A-Z), one number, and one special character (such as !, @, or #).',
            [],
            422,
        );
    }
    if (strlen($password) > 72) {
        sendJson(false, 'Password must not exceed 72 bytes.', [], 422);
    }
    if ($password !== ($data['confirm_password'] ?? null)) {
        sendJson(false, 'Passwords do not match.', [], 422);
    }
    return $password;
}
function passwordInput(array $data, string $key): string
{
    $value = $data[$key] ?? null;
    if (!is_string($value) || $value === '' || strlen($value) > 72) {
        sendJson(false, 'Enter a valid password.', [], 422);
    }
    return $value; // Passwords must not be trimmed or otherwise normalized.
}
function validEmail(array $data): string
{
    $email = strtolower(required($data, 'email', 190));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sendJson(false, 'Enter a valid email address.', [], 422);
    }
    return $email;
}
function rateLimit(PDO $pdo, string $action, int $limit = 20): void
{
    $key = hash('sha256', $action . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'local'));
    query(
        $pdo,
        'INSERT INTO rate_limits (bucket,hits,expires_at) VALUES (?,1,DATE_ADD(NOW(),INTERVAL 15 MINUTE)) ON DUPLICATE KEY UPDATE hits=IF(expires_at<NOW(),1,hits+1), expires_at=IF(expires_at<NOW(),DATE_ADD(NOW(),INTERVAL 15 MINUTE),expires_at)',
        [$key],
    );
    if (
        (int) query($pdo, 'SELECT hits FROM rate_limits WHERE bucket=?', [$key])->fetchColumn() >
        $limit
    ) {
        sendJson(false, 'Too many attempts. Please try again in 15 minutes.', [], 429);
    }
}
function rememberCookie(string $value, int $expires): void
{
    setcookie('riderent_remember', $value, [
        'expires' => $expires,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
function restoreLogin(PDO $pdo): void
{
    if (
        !empty($_SESSION['user_id']) &&
        !query($pdo, 'SELECT user_id FROM users WHERE user_id=? AND deleted_at IS NULL', [
            $_SESSION['user_id'],
        ])->fetch()
    ) {
        $_SESSION = [];
        rememberCookie('', time() - 3600);
    }

    if (!empty($_SESSION['user_id']) || empty($_COOKIE['riderent_remember'])) {
        return;
    }
    $token = $_COOKIE['riderent_remember'];
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) {
        return;
    }
    $row = query(
        $pdo,
        'SELECT u.user_id,u.full_name FROM remember_tokens t JOIN users u ON u.user_id=t.user_id WHERE t.token_hash=? AND t.expires_at>NOW() AND u.deleted_at IS NULL',
        [hash('sha256', $token)],
    )->fetch();
    if ($row) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int) $row['user_id'];
        $_SESSION['user_name'] = $row['full_name'];
    } else {
        rememberCookie('', time() - 3600);
    }
}
