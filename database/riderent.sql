-- Import once into a new database. MySQL 8+ / MariaDB 10.4+.
CREATE DATABASE IF NOT EXISTS riderent CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE riderent;

CREATE TABLE users (
    deleted_at DATETIME NULL,
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    phone VARCHAR(30) NOT NULL,
    address VARCHAR(500) NOT NULL,
    password VARCHAR(255) NOT NULL,
    driving_license VARCHAR(80) NOT NULL,
    profile_image VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE admins (
    admin_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB;

CREATE TABLE vehicle_categories (
    category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(500) NOT NULL
) ENGINE = InnoDB;

CREATE TABLE vehicles (
    vehicle_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_id INT UNSIGNED NOT NULL,
    vehicle_name VARCHAR(120) NOT NULL,
    brand VARCHAR(80) NOT NULL,
    model VARCHAR(80) NOT NULL,
    registration_number VARCHAR(50) NOT NULL UNIQUE,
    manufacturing_year SMALLINT UNSIGNED NOT NULL,
    fuel_type ENUM('Petrol', 'Diesel', 'Electric', 'Hybrid') NOT NULL,
    transmission ENUM('Manual', 'Automatic') NOT NULL,
    seats TINYINT UNSIGNED NOT NULL,
    price_per_day DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    image VARCHAR(255) NOT NULL DEFAULT 'assets/images/vehicles/car.svg',
    availability_status ENUM('Available', 'Maintenance', 'Unavailable') NOT NULL DEFAULT 'Available',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES vehicle_categories (category_id) ON DELETE RESTRICT,
    INDEX idx_vehicle_filter (
        is_active,
        availability_status,
        category_id,
        price_per_day
    ),
    INDEX idx_brand (brand),
    CHECK (price_per_day > 0),
    CHECK (seats BETWEEN 1 AND 50)
) ENGINE = InnoDB;

CREATE TABLE bookings (
    booking_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    vehicle_id INT UNSIGNED NOT NULL,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    total_days SMALLINT UNSIGNED NOT NULL,
    price_per_day DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    booking_status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
    payment_status ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE RESTRICT,
    INDEX idx_overlap (
        vehicle_id,
        booking_status,
        pickup_date,
        return_date
    ),
    INDEX idx_user_bookings (user_id, booking_status, created_at),
    CHECK (return_date > pickup_date),
    CHECK (
        total_days = DATEDIFF(return_date, pickup_date)
        AND total_days BETWEEN 1 AND 365
    ),
    CHECK (
        price_per_day > 0
        AND total_amount = price_per_day * total_days
    )
) ENGINE = InnoDB;

CREATE TABLE payments (
    payment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method ENUM('Cash', 'Card', 'Bank Transfer', 'Online') NOT NULL DEFAULT 'Cash',
    transaction_reference VARCHAR(150),
    payment_status ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
    payment_date DATETIME,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE RESTRICT,
    INDEX idx_payment_status (payment_status, payment_date),
    CHECK (amount > 0)
) ENGINE = InnoDB;

CREATE TABLE contact_messages (
    message_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    subject VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_messages (is_read, created_at)
) ENGINE = InnoDB;

CREATE TABLE reviews (
    review_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL UNIQUE,
    rating TINYINT UNSIGNED NOT NULL,
    review_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings (booking_id) ON DELETE RESTRICT,
    CHECK (rating BETWEEN 1 AND 5)
) ENGINE = InnoDB;

-- Review user and vehicle are derived through bookings, preventing inconsistent IDs.
CREATE TABLE remember_tokens (
    token_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    INDEX idx_remember_expiry (expires_at)
) ENGINE = InnoDB;

CREATE TABLE password_resets (
    reset_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    INDEX idx_reset_expiry (expires_at)
) ENGINE = InnoDB;

CREATE TABLE rate_limits (
    bucket CHAR(64) PRIMARY KEY,
    hits INT UNSIGNED NOT NULL DEFAULT 1,
    expires_at DATETIME NOT NULL,
    INDEX idx_rate_expiry (expires_at)
) ENGINE = InnoDB;

-- Every demo account uses: password
INSERT INTO
    admins (full_name, email, password)
VALUES
    (
        'RideRent Administrator',
        'admin@riderent.example',
        '$2y$10$eYEkYtZzkEDf6LziQLgAhO4eMYWXuv9t8GbbFZqQ3yuLeTTp1VT8m'
    );

INSERT INTO
    users (
        full_name,
        email,
        phone,
        address,
        password,
        driving_license
    )
VALUES
    (
        'Aarav Sharma',
        'aarav@example.com',
        '9800000001',
        'Kathmandu, Nepal',
        '$2y$10$eYEkYtZzkEDf6LziQLgAhO4eMYWXuv9t8GbbFZqQ3yuLeTTp1VT8m',
        'DEMO-LIC-001'
    ),
    (
        'Maya Thapa',
        'maya@example.com',
        '9800000002',
        'Pokhara, Nepal',
        '$2y$10$eYEkYtZzkEDf6LziQLgAhO4eMYWXuv9t8GbbFZqQ3yuLeTTp1VT8m',
        'DEMO-LIC-002'
    ),
    (
        'Rohan Karki',
        'rohan@example.com',
        '9800000003',
        'Lalitpur, Nepal',
        '$2y$10$eYEkYtZzkEDf6LziQLgAhO4eMYWXuv9t8GbbFZqQ3yuLeTTp1VT8m',
        'DEMO-LIC-003'
    );

INSERT INTO
    vehicle_categories (category_name, description)
VALUES
    ('Cars', 'Everyday comfort.'),
    ('SUVs', 'Room to explore.'),
    ('Bikes', 'Two-wheel freedom.'),
    ('Scooters', 'Easy city mobility.'),
    ('Vans', 'Bring everyone along.');

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
VALUES
    (
        1,
        'Toyota Corolla',
        'Toyota',
        'Corolla',
        'DEMO-CAR-001',
        2023,
        'Petrol',
        'Automatic',
        5,
        4500,
        'A comfortable sedan for everyday travel. Demonstration specifications and daily rate.',
        'assets/images/vehicles/car.svg'
    ),
    (
        2,
        'Hyundai Creta',
        'Hyundai',
        'Creta',
        'DEMO-SUV-001',
        2024,
        'Petrol',
        'Automatic',
        5,
        6500,
        'A versatile SUV with space for weekend bags. Demonstration specifications and daily rate.',
        'assets/images/vehicles/suv.svg'
    ),
    (
        3,
        'Royal Enfield Classic',
        'Royal Enfield',
        'Classic 350',
        'DEMO-BIKE-001',
        2023,
        'Petrol',
        'Manual',
        2,
        2200,
        'A classic motorcycle for a relaxed ride. A suitable licence is required. Demonstration specifications.',
        'assets/images/vehicles/bike.svg'
    ),
    (
        4,
        'Honda Dio',
        'Honda',
        'Dio',
        'DEMO-SCOOT-001',
        2024,
        'Petrol',
        'Automatic',
        2,
        1200,
        'A compact scooter for city trips. Demonstration specifications and daily rate.',
        'assets/images/vehicles/scooter.svg'
    ),
    (
        5,
        'Toyota Hiace',
        'Toyota',
        'Hiace',
        'DEMO-VAN-001',
        2022,
        'Diesel',
        'Manual',
        14,
        9500,
        'A roomy van for group travel. Confirm appropriate licensing with the rental desk. Demonstration specifications.',
        'assets/images/vehicles/van.svg'
    ),
    (
        1,
        'Suzuki Swift',
        'Suzuki',
        'Swift',
        'DEMO-CAR-002',
        2024,
        'Petrol',
        'Manual',
        5,
        3500,
        'A compact hatchback for everyday travel. Demonstration specifications and daily rate.',
        'assets/images/vehicles/car.svg'
    ),
    (
        2,
        'Kia Seltos',
        'Kia',
        'Seltos',
        'DEMO-SUV-002',
        2023,
        'Diesel',
        'Automatic',
        5,
        7000,
        'An SUV for journeys with family or friends. Demonstration specifications and daily rate.',
        'assets/images/vehicles/suv.svg'
    ),
    (
        3,
        'Yamaha FZ',
        'Yamaha',
        'FZ',
        'DEMO-BIKE-002',
        2024,
        'Petrol',
        'Manual',
        2,
        1800,
        'A practical motorcycle for city roads. Demonstration specifications and daily rate.',
        'assets/images/vehicles/bike.svg'
    ),
    (
        4,
        'TVS Ntorq',
        'TVS',
        'Ntorq',
        'DEMO-SCOOT-002',
        2023,
        'Petrol',
        'Automatic',
        2,
        1400,
        'A scooter for daily errands. Demonstration specifications and daily rate.',
        'assets/images/vehicles/scooter.svg'
    ),
    (
        5,
        'Suzuki Eeco',
        'Suzuki',
        'Eeco',
        'DEMO-VAN-002',
        2023,
        'Petrol',
        'Manual',
        7,
        5000,
        'A people carrier for small groups. Demonstration specifications and daily rate.',
        'assets/images/vehicles/van.svg'
    );

INSERT INTO
    bookings (
        user_id,
        vehicle_id,
        pickup_date,
        return_date,
        total_days,
        price_per_day,
        total_amount,
        booking_status,
        payment_status
    )
VALUES
    (
        1,
        1,
        '2026-01-10',
        '2026-01-13',
        3,
        4500,
        13500,
        'Completed',
        'Paid'
    ),
    (
        2,
        2,
        '2026-02-10',
        '2026-02-12',
        2,
        6500,
        13000,
        'Completed',
        'Paid'
    ),
    (
        3,
        3,
        '2026-03-10',
        '2026-03-11',
        1,
        2200,
        2200,
        'Cancelled',
        'Pending'
    ),
    (
        1,
        6,
        DATE_ADD(CURDATE(), INTERVAL 10 DAY),
        DATE_ADD(CURDATE(), INTERVAL 12 DAY),
        2,
        3500,
        7000,
        'Confirmed',
        'Pending'
    ),
    (
        2,
        7,
        DATE_ADD(CURDATE(), INTERVAL 14 DAY),
        DATE_ADD(CURDATE(), INTERVAL 17 DAY),
        3,
        7000,
        21000,
        'Pending',
        'Pending'
    );

INSERT INTO
    payments (
        booking_id,
        amount,
        payment_method,
        payment_status,
        transaction_reference,
        payment_date
    )
VALUES
    (
        1,
        13500,
        'Cash',
        'Paid',
        'DEMO-001',
        '2026-01-10 09:00:00'
    ),
    (
        2,
        13000,
        'Bank Transfer',
        'Paid',
        'DEMO-002',
        '2026-02-10 09:00:00'
    ),
    (3, 2200, 'Cash', 'Pending', NULL, NULL),
    (4, 7000, 'Cash', 'Pending', NULL, NULL),
    (5, 21000, 'Cash', 'Pending', NULL, NULL);

INSERT INTO
    reviews (booking_id, rating, review_text)
VALUES
    (
        2,
        5,
        'Comfortable for our family trip. This is a demonstration review.'
    );

-- BEGIN NEPAL FLEET
-- Additive fleet update. Safe to rerun; preserves bookings and existing custom images.
USE riderent;

START TRANSACTION;

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-corolla.jpg'
WHERE
    registration_number = 'DEMO-CAR-001'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-creta.jpg'
WHERE
    registration_number = 'DEMO-SUV-001'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-classic.jpg'
WHERE
    registration_number = 'DEMO-BIKE-001'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-dio.jpg'
WHERE
    registration_number = 'DEMO-SCOOT-001'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-hiace.jpg'
WHERE
    registration_number = 'DEMO-VAN-001'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-swift.jpg'
WHERE
    registration_number = 'DEMO-CAR-002'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-seltos.jpg'
WHERE
    registration_number = 'DEMO-SUV-002'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-fz.jpg'
WHERE
    registration_number = 'DEMO-BIKE-002'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-ntorq.jpg'
WHERE
    registration_number = 'DEMO-SCOOT-002'
    AND image LIKE 'assets/images/vehicles/%.svg';

UPDATE vehicles
SET
    image = 'assets/images/vehicles/nepal-eeco.jpg'
WHERE
    registration_number = 'DEMO-VAN-002'
    AND image LIKE 'assets/images/vehicles/%.svg';

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Suzuki Brezza',
    'Suzuki',
    'Brezza 1.5 MT',
    'DEMO-NP-BREZZA',
    2023,
    'Petrol',
    'Manual',
    5,
    6000,
    '1,462 cc petrol compact SUV. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://www.suzuki.com.np/new-brezza',
    'assets/images/vehicles/nepal-brezza.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-BREZZA'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Suzuki Baleno',
    'Suzuki',
    'Baleno 1.2 MT',
    'DEMO-NP-BALENO',
    2023,
    'Petrol',
    'Manual',
    5,
    4000,
    '1,197 cc petrol hatchback with a manual gearbox. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://www.suzuki.com.np/baleno1',
    'assets/images/vehicles/nepal-baleno.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'Cars'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-BALENO'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Suzuki Fronx',
    'Suzuki',
    'Fronx 1.2 MT',
    'DEMO-NP-FRONX',
    2024,
    'Petrol',
    'Manual',
    5,
    5500,
    '1,197 cc petrol crossover; this listing represents the naturally aspirated manual variant. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://suzuki.com.np/fronx',
    'assets/images/vehicles/nepal-fronx.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-FRONX'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Suzuki Jimny 5-door',
    'Suzuki',
    'Jimny 1.5 4WD MT',
    'DEMO-NP-JIMNY',
    2024,
    'Petrol',
    'Manual',
    4,
    8500,
    '1,462 cc petrol engine, five-speed manual and ALLGRIP PRO four-wheel drive. Four seats including driver. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://www.suzuki.com.np/uploads/product/file/aad46b89863521fa1e9cad25867dc66c.pdf',
    'assets/images/vehicles/nepal-jimny.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-JIMNY'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Suzuki Grand Vitara',
    'Suzuki',
    'Grand Vitara Smart Hybrid MT',
    'DEMO-NP-GRAND-VITARA',
    2023,
    'Hybrid',
    'Manual',
    5,
    7500,
    '1,462 cc petrol mild-hybrid SUV with five-speed manual transmission. Mild-hybrid assistance is not an electric-only driving mode. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://suzuki.com.np/grand-vitara',
    'assets/images/vehicles/nepal-grand-vitara.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-GRAND-VITARA'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Tata Punch',
    'Tata',
    'Punch 1.2 MT',
    'DEMO-NP-PUNCH',
    2023,
    'Petrol',
    'Manual',
    5,
    4500,
    '1.2-litre petrol compact SUV with a manual gearbox. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://cars.tatamotors.com.np/ice/punch.php',
    'assets/images/vehicles/nepal-punch.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-PUNCH'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Tata Nexon EV',
    'Tata',
    'Nexon EV 30.2 kWh',
    'DEMO-NP-NEXON-EV',
    2022,
    'Electric',
    'Automatic',
    5,
    6500,
    '30.2 kWh battery, electric front-wheel drive and single-speed automatic reduction gear. Earlier-generation Nexon EV; not the newer 45 kWh model. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://static-assets.tatamotors.com/Production/www-tatamotors-com-NEW/wp-content/uploads/2024/09/Tata-Nexon-EV-Specification-Sheet.pdf',
    'assets/images/vehicles/nepal-nexon-ev.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-NEXON-EV'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Tata Tiago EV',
    'Tata',
    'Tiago EV Long Range',
    'DEMO-NP-TIAGO-EV',
    2023,
    'Electric',
    'Automatic',
    5,
    4000,
    '24 kWh battery in the Long Range variant, front-wheel drive and single-speed automatic reduction gear. Charging time and range depend on conditions. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://cars.tatamotors.com.np/images/tiago-ev-brochure_updated_2025.pdf',
    'assets/images/vehicles/nepal-tiago-ev.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'Cars'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-TIAGO-EV'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Bajaj Pulsar NS200',
    'Bajaj',
    'Pulsar NS200',
    'DEMO-NP-NS200',
    2024,
    'Petrol',
    'Manual',
    2,
    2000,
    '199.5 cc liquid-cooled single-cylinder petrol motorcycle with a manual gearbox and 12-litre fuel tank. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://www.bajajauto.com/en-np/bikes/pulsar-ns200-fi-dual-abs',
    'assets/images/vehicles/nepal-ns200.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'Bikes'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-NS200'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Honda Shine 125',
    'Honda',
    'Shine BS6',
    'DEMO-NP-SHINE',
    2024,
    'Petrol',
    'Manual',
    2,
    1500,
    '123.94 cc petrol commuter motorcycle with a five-speed manual gearbox. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://honda.com.np/motorcycle/honda-shine-bs6/',
    'assets/images/vehicles/nepal-shine.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'Bikes'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-SHINE'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Suzuki Access 125',
    'Suzuki',
    'Access 125 FI',
    'DEMO-NP-ACCESS',
    2023,
    'Petrol',
    'Automatic',
    2,
    1300,
    '125-class fuel-injected petrol scooter with a CVT automatic transmission. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://suzukimotorcycle.com.np/product/access-125-fi/',
    'assets/images/vehicles/nepal-access.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'Scooters'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-ACCESS'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Mahindra Scorpio-N',
    'Mahindra',
    'Scorpio-N Diesel MT',
    'DEMO-NP-SCORPIO',
    2024,
    'Diesel',
    'Manual',
    7,
    9000,
    '2.2-litre mHawk diesel SUV with manual transmission and seven-seat configuration. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://www.agnimahindra.com/assets/brochure/scorpio_n.pdf',
    'assets/images/vehicles/nepal-scorpio.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'SUVs'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-SCORPIO'
    );

INSERT INTO
    vehicles (
        category_id,
        vehicle_name,
        brand,
        model,
        registration_number,
        manufacturing_year,
        fuel_type,
        transmission,
        seats,
        price_per_day,
        description,
        image
    )
SELECT
    category_id,
    'Force Traveller',
    'Force',
    'Traveller 3050 12+D',
    'DEMO-NP-TRAVELLER',
    2023,
    'Diesel',
    'Manual',
    13,
    11000,
    '2,596 cc diesel passenger van, manual transmission, 12 passengers plus driver. Driver-inclusive capacity is 13. Representative model photo; pictured trim/year may differ. Sample fleet year and registration; rental price is a demo rate. Model source: https://demo.forcemotors.com/traveller-3050.php',
    'assets/images/vehicles/nepal-traveller.jpg'
FROM
    vehicle_categories
WHERE
    category_name = 'Vans'
    AND NOT EXISTS (
        SELECT
            1
        FROM
            vehicles
        WHERE
            registration_number = 'DEMO-NP-TRAVELLER'
    );

COMMIT;

-- Persistent in-app notifications
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
-- Customer saved vehicles
USE riderent;

CREATE TABLE IF NOT EXISTS favorites (
    user_id INT UNSIGNED NOT NULL,
    vehicle_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, vehicle_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles (vehicle_id) ON DELETE CASCADE
) ENGINE = InnoDB;

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
