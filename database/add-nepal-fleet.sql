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
