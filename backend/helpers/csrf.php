<?php
declare(strict_types=1);

function csrfToken(): string
{
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}
function requirePost(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        header('Allow: POST');
        sendJson(false, 'Use POST for this request.', [], 405);
    }
    if (!hash_equals(csrfToken(), $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        sendJson(false, 'Your session expired. Reload the page and try again.', [], 403);
    }
}
