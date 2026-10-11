USE riderent;

CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    audience ENUM('customer', 'admin') NOT NULL,
    user_id INT UNSIGNED NULL,
    message VARCHAR(255) NOT NULL,
    destination VARCHAR(160) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notification_inbox (audience, user_id, notification_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id BIGINT UNSIGNED NOT NULL,
    reader_role ENUM('customer', 'admin') NOT NULL,
    reader_id INT UNSIGNED NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, reader_role, reader_id),
    FOREIGN KEY (notification_id) REFERENCES notifications (notification_id) ON DELETE CASCADE
) ENGINE = InnoDB;
DELIMITER $$
DROP TRIGGER IF EXISTS rr_notify_booking_created$$
CREATE TRIGGER rr_notify_booking_created AFTER
INSERT
    ON bookings FOR EACH ROW
BEGIN
INSERT INTO
    notifications (audience, user_id, message, destination)
VALUES
    (
        'customer',
        NEW.user_id,
        CONCAT(
            'Booking #',
            NEW.booking_id,
            ' received. Status: ',
            NEW.booking_status,
            '.'
        ),
        CONCAT('booking-details.html?id=', NEW.booking_id)
    ),
    (
        'admin',
        NULL,
        CONCAT('New booking request #', NEW.booking_id, '.'),
        CONCAT('bookings.html?id=', NEW.booking_id)
    );

END$$
DROP TRIGGER IF EXISTS rr_notify_booking_updated$$
CREATE TRIGGER rr_notify_booking_updated AFTER
UPDATE ON bookings FOR EACH ROW
BEGIN IF OLD.booking_status <> NEW.booking_status THEN
INSERT INTO
    notifications (audience, user_id, message, destination)
VALUES
    (
        'customer',
        NEW.user_id,
        CONCAT(
            'Booking #',
            NEW.booking_id,
            ' is now ',
            NEW.booking_status,
            '.'
        ),
        CONCAT('booking-details.html?id=', NEW.booking_id)
    ),
    (
        'admin',
        NULL,
        CONCAT(
            'Booking #',
            NEW.booking_id,
            ' changed to ',
            NEW.booking_status,
            '.'
        ),
        CONCAT('bookings.html?id=', NEW.booking_id)
    );

END IF;

IF OLD.payment_status <> NEW.payment_status THEN
INSERT INTO
    notifications (audience, user_id, message, destination)
VALUES
    (
        'customer',
        NEW.user_id,
        CONCAT(
            'Payment for booking #',
            NEW.booking_id,
            ': ',
            NEW.payment_status,
            '.'
        ),
        CONCAT('booking-details.html?id=', NEW.booking_id)
    ),
    (
        'admin',
        NULL,
        CONCAT(
            'Payment for booking #',
            NEW.booking_id,
            ': ',
            NEW.payment_status,
            '.'
        ),
        CONCAT('bookings.html?id=', NEW.booking_id)
    );

END IF;

END$$
DROP TRIGGER IF EXISTS rr_notify_message$$
CREATE TRIGGER rr_notify_message AFTER
INSERT
    ON contact_messages FOR EACH ROW
BEGIN
INSERT INTO
    notifications (audience, message, destination)
VALUES
    (
        'admin',
        CONCAT('New rental desk message #', NEW.message_id, '.'),
        'messages.html'
    );

END$$
DROP TRIGGER IF EXISTS rr_notify_customer$$
CREATE TRIGGER rr_notify_customer AFTER
INSERT
    ON users FOR EACH ROW
BEGIN
INSERT INTO
    notifications (audience, message, destination)
VALUES
    (
        'admin',
        'A new customer has registered.',
        'dashboard.html'
    );

END$$
DROP TRIGGER IF EXISTS rr_notify_review$$
CREATE TRIGGER rr_notify_review AFTER
INSERT
    ON reviews FOR EACH ROW
BEGIN
INSERT INTO
    notifications (audience, message, destination)
SELECT
    'admin',
    CONCAT(
        'New ',
        NEW.rating,
        '-star review for booking #',
        NEW.booking_id,
        '.'
    ),
    CONCAT(
        '../vehicle-details.html?id=',
        vehicle_id,
        '#reviews'
    )
FROM
    bookings
WHERE
    booking_id = NEW.booking_id;

END$$
DELIMITER ;
