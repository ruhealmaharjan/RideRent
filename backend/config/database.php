<?php
declare(strict_types=1);
// Environment overrides are optional; the defaults work with XAMPP.
try {
    $pdo = new PDO(
        'mysql:host=' .
            (getenv('DB_HOST') ?: 'localhost') .
            ';port=' .
            (getenv('DB_PORT') ?: '3306') .
            ';dbname=' .
            (getenv('DB_NAME') ?: 'riderent') .
            ';charset=utf8mb4',
        getenv('DB_USER') ?: 'root',
        getenv('DB_PASSWORD') ?: '',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ],
    );
    $pdo->exec("SET time_zone = '+05:45'");
} catch (PDOException $e) {
    error_log('RideRent database: ' . $e->getMessage());
    http_response_code(503);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'message' => 'Database unavailable. Start MySQL and import database/riderent.sql.',
        'data' => new stdClass(),
    ]);
    exit();
}
