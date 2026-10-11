<?php
declare(strict_types=1);

function sendJson(bool $success, string $message = '', array $data = [], int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(
        ['success' => $success, 'message' => $message, 'data' => $data ?: new stdClass()],
        JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE,
    );
    exit();
}
