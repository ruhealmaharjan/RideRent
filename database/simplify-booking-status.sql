USE riderent;

UPDATE bookings
SET
    booking_status = 'Confirmed'
WHERE
    booking_status = 'Active';

ALTER TABLE bookings
MODIFY booking_status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending';
