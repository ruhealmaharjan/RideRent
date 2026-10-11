<?php
declare(strict_types=1);

/** Validate and re-encode images, removing embedded metadata and executable payloads. */
function saveImage(string $field, string $folder, bool $required = true): ?string
{
    $file = $_FILES[$field] ?? null;
    if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        if ($required) {
            sendJson(false, 'Choose an image to upload.', [], 422);
        }
        return null;
    }
    if (
        !is_array($file) ||
        is_array($file['error'] ?? null) ||
        ($file['error'] ?? -1) !== UPLOAD_ERR_OK
    ) {
        sendJson(false, 'Upload failed. The image must be smaller than 2 MB.', [], 422);
    }
    if (!is_uploaded_file($file['tmp_name']) || filesize($file['tmp_name']) > 2 * 1024 * 1024) {
        sendJson(false, 'Image must be smaller than 2 MB.', [], 422);
    }
    $info = @getimagesize($file['tmp_name']);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extensions = [
        'image/jpeg' => ['jpg', 'jpeg'],
        'image/png' => ['png'],
        'image/webp' => ['webp'],
    ];
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (
        !$info ||
        !isset($extensions[$mime]) ||
        !in_array($extension, $extensions[$mime], true) ||
        $info['mime'] !== $mime ||
        $info[0] > 4000 ||
        $info[1] > 4000 ||
        $info[0] * $info[1] > 12000000
    ) {
        sendJson(
            false,
            'Use a valid JPEG, PNG, or WebP image up to 4000 pixels per side and 12 megapixels.',
            [],
            422,
        );
    }
    if (!function_exists('imagecreatefromstring')) {
        sendJson(false, 'Enable the PHP GD extension to upload images.', [], 503);
    }
    $image = @imagecreatefromstring(file_get_contents($file['tmp_name']));
    if (!$image) {
        sendJson(false, 'The image could not be decoded.', [], 422);
    }
    if (!in_array($folder, ['profiles', 'vehicles'], true)) {
        throw new RuntimeException('Invalid image destination.');
    }
    $relative = 'assets/images/' . $folder . '/' . bin2hex(random_bytes(16)) . '.png';
    $destination = dirname(__DIR__, 2) . '/' . $relative;
    if (!is_dir(dirname($destination)) && !mkdir(dirname($destination), 0755, true)) {
        throw new RuntimeException('Image directory unavailable.');
    }
    imagesavealpha($image, true);
    $saved = imagepng($image, $destination, 6);
    imagedestroy($image);
    if (!$saved) {
        throw new RuntimeException('Unable to save image.');
    }
    return $relative;
}

function removeUploadedImage(?string $relative): void
{
    // Only files created by this uploader may be removed; never remove seeded assets.
    if (
        $relative &&
        preg_match('~^assets/images/(profiles|vehicles)/[a-f0-9]{32}\.png$~D', $relative)
    ) {
        $path = dirname(__DIR__, 2) . '/' . $relative;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
