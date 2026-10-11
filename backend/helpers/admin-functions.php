<?php
declare(strict_types=1);

function requireAdmin(PDO $pdo): int
{
    $id = (int) ($_SESSION['admin_id'] ?? 0);
    if (!$id || !query($pdo, 'SELECT admin_id FROM admins WHERE admin_id=?', [$id])->fetch()) {
        sendJson(false, 'Administrator login required.', [], 401);
    }
    return $id;
}
function enumInput(array $data, string $key, array $choices, ?string $default = null): string
{
    $value = $data[$key] ?? $default;
    if (!is_string($value) || !in_array($value, $choices, true)) {
        sendJson(false, 'Invalid ' . $key . '.', [], 422);
    }
    return $value;
}
function integerInput(mixed $value, int $min, int $max): int
{
    $result = filter_var($value, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => $min, 'max_range' => $max],
    ]);
    if ($result === false) {
        sendJson(
            false,
            'Enter a valid whole number between ' . $min . ' and ' . $max . '.',
            [],
            422,
        );
    }
    return $result;
}
function moneyInput(mixed $value): string
{
    if (
        (!is_string($value) && !is_numeric($value)) ||
        !preg_match('/^\d{1,8}(\.\d{1,2})?$/D', (string) $value) ||
        (float) $value <= 0
    ) {
        sendJson(false, 'Enter a positive amount with at most two decimal places.', [], 422);
    }
    return number_format((float) $value, 2, '.', '');
}
function pagination(int $total): array
{
    $limit = integerInput($_GET['limit'] ?? 20, 1, 100);
    $page = integerInput($_GET['page'] ?? 1, 1, 1000000);
    $pages = max(1, (int) ceil($total / $limit));
    $page = min($page, $pages);
    return [
        'page' => $page,
        'pages' => $pages,
        'limit' => $limit,
        'total' => $total,
        'offset' => ($page - 1) * $limit,
    ];
}
function adminBooking(PDO $pdo, int $id): array
{
    $booking = query(
        $pdo,
        'SELECT b.*,v.vehicle_name,v.registration_number,v.image,u.full_name,u.email,u.phone,u.address,u.driving_license FROM bookings b JOIN vehicles v ON v.vehicle_id=b.vehicle_id JOIN users u ON u.user_id=b.user_id WHERE b.booking_id=?',
        [$id],
    )->fetch();
    if (!$booking) {
        sendJson(false, 'Booking not found.', [], 404);
    }
    $booking['payments'] = query(
        $pdo,
        'SELECT * FROM payments WHERE booking_id=? ORDER BY payment_id',
        [$id],
    )->fetchAll();
    return $booking;
}
function validateVehicle(PDO $pdo, array $data): array
{
    $category = idValue($data['category_id'] ?? null);
    if (
        !query($pdo, 'SELECT category_id FROM vehicle_categories WHERE category_id=?', [
            $category,
        ])->fetch()
    ) {
        sendJson(false, 'Category not found.', [], 422);
    }
    return [
        'category_id' => $category,
        'vehicle_name' => required($data, 'vehicle_name', 120),
        'brand' => required($data, 'brand', 80),
        'model' => required($data, 'model', 80),
        'registration_number' => required($data, 'registration_number', 50),
        'manufacturing_year' => integerInput(
            $data['manufacturing_year'] ?? null,
            1980,
            (int) date('Y') + 1,
        ),
        'fuel_type' => enumInput($data, 'fuel_type', ['Petrol', 'Diesel', 'Electric', 'Hybrid']),
        'transmission' => enumInput($data, 'transmission', ['Manual', 'Automatic']),
        'seats' => integerInput($data['seats'] ?? null, 1, 50),
        'price_per_day' => moneyInput($data['price_per_day'] ?? null),
        'description' => required($data, 'description', 10000),
        'availability_status' => enumInput(
            $data,
            'availability_status',
            ['Available', 'Maintenance', 'Unavailable'],
            'Available',
        ),
    ];
}
function reportDates(): array
{
    $from = sanitizeInput($_GET['from_date'] ?? '2000-01-01', 10);
    $to = sanitizeInput($_GET['to_date'] ?? date('Y-m-d'), 10);
    foreach ([$from, $to] as $value) {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value) {
            sendJson(false, 'Invalid report date.', [], 422);
        }
    }
    if ($from > $to) {
        sendJson(false, 'From date must not be after To date.', [], 422);
    }
    return [
        $from . ' 00:00:00',
        (new DateTimeImmutable($to))->modify('+1 day')->format('Y-m-d') . ' 00:00:00',
    ];
}
