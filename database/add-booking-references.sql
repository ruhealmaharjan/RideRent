USE riderent;

SET
    time_zone = '+05:45';

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(32) NULL;

CREATE TABLE IF NOT EXISTS booking_daily_sequences (
    booking_date DATE PRIMARY KEY,
    last_number INT UNSIGNED NOT NULL
) ENGINE = InnoDB;

CREATE TEMPORARY TABLE rr_reference_backfill AS
SELECT
    booking_id,
    DATE (created_at) AS day_key,
    ROW_NUMBER() OVER (
        PARTITION BY
            DATE (created_at)
        ORDER BY
            created_at,
            booking_id
    ) AS sequence_number
FROM
    bookings;

UPDATE bookings b
JOIN rr_reference_backfill f ON f.booking_id = b.booking_id
SET
    b.booking_reference = CONCAT(
        DATE_FORMAT(f.day_key, '%Y%m%d'),
        'A',
        LPAD(
            f.sequence_number,
            GREATEST(2, CHAR_LENGTH(f.sequence_number)),
            '0'
        )
    )
WHERE
    b.booking_reference IS NULL;

INSERT INTO
    booking_daily_sequences
SELECT
    day_key,
    MAX(sequence_number)
FROM
    rr_reference_backfill
GROUP BY
    day_key
ON DUPLICATE KEY UPDATE
    last_number = GREATEST(
        last_number,
        VALUES
            (last_number)
    );

DROP TEMPORARY TABLE rr_reference_backfill;

CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_reference ON bookings (booking_reference);
DELIMITER $$
DROP TRIGGER IF EXISTS rr_booking_reference$$
CREATE TRIGGER rr_booking_reference BEFORE
INSERT
    ON bookings FOR EACH ROW
BEGIN DECLARE sequence_number INT UNSIGNED;

INSERT INTO
    booking_daily_sequences (booking_date, last_number)
VALUES
    (DATE (NEW.created_at), 1)
ON DUPLICATE KEY UPDATE
    last_number = last_number + 1;

SELECT
    last_number INTO sequence_number
FROM
    booking_daily_sequences
WHERE
    booking_date = DATE (NEW.created_at);

SET
    NEW.booking_reference = CONCAT(
        DATE_FORMAT(NEW.created_at, '%Y%m%d'),
        'A',
        LPAD(
            sequence_number,
            GREATEST(2, CHAR_LENGTH(sequence_number)),
            '0'
        )
    );

END$$
DELIMITER ;
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
            NEW.booking_reference,
            ' received. Status: ',
            NEW.booking_status,
            '.'
        ),
        CONCAT('booking-details.html?id=', NEW.booking_id)
    ),
    (
        'admin',
        NULL,
        CONCAT(
            'New booking request #',
            NEW.booking_reference,
            '.'
        ),
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
            NEW.booking_reference,
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
            NEW.booking_reference,
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
            NEW.booking_reference,
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
            NEW.booking_reference,
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
        '-star review for booking ',
        booking_reference,
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
