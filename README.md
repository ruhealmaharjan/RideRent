# RideRent Vehicle Rental System

RideRent is a semester project with customer HTML pages, an administrator interface, PHP JSON APIs, and a MySQL-compatible database. JavaScript communicates with the APIs using fetch; PHP does not generate page layouts.

## Run locally

1. Place the project at `C:\xampp\htdocs\RideRent` with `index.html` directly inside it.
2. Start Apache and MySQL in XAMPP.
3. For a **fresh installation only**, import `database/riderent.sql` through phpMyAdmin. Keep an existing database and its records intact.
4. Open `http://localhost/RideRent/`. Administrator login is at `http://localhost/RideRent/admin/login.html`.

The default PDO connection uses localhost, database `riderent`, user `root`, and an empty password. Configuration supports `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD`. PHP 8.2 with PDO MySQL and Fileinfo is required. Image uploads also require GD (`extension=gd`) and a writable upload temporary directory; restart Apache after changing PHP configuration.

For an older installation, review the named SQL migrations in `database/` against its existing schema and back up the database before applying missing migrations. Do not blindly rerun all migrations or overwrite live data with sample records.

## Demo accounts

The seed contains administrator `admin@riderent.example` and customers `aarav@example.com`, `maya@example.com`, and `rohan@example.com`, each with demo password `password`. These are initial sample credentials, not a guarantee about passwords in an existing installation. Newly created passwords require at least eight characters, one uppercase letter, one number, and one special character.

## Features

- Customers can browse, search, filter and sort vehicles, like vehicles, compare specifications, and submit bookings.
- Customer accounts include booking history and progress, profile editing, password changes, account deletion, and notifications.
- Confirmed or Completed rentals qualify for one review per booking.
- Administrators can manage vehicles, categories, booking statuses, customers, payment records, messages, reports, and customer password-reset links.
- Vehicle photos and their attribution are listed on `photo-credits.html`; rental prices and sample registrations are demonstration data.

## Booking and payment rules

The normal booking flow is **Pending → Confirmed → Completed**, with Cancelled as a separate terminal status. Pending and Confirmed bookings block overlapping dates. Rentals use an exclusive return date, so another rental may begin on the previous return date. Rental duration must be between 1 and 365 days. Past dates are permitted for the academic demonstration.

Booking creation locks the vehicle within a transaction, checks availability, and calculates the total from the database price. Customers cannot select another user's booking. Public booking references use the creation date and daily order sequence, such as `20260928A01`; URLs use internal numeric IDs with ownership checks.

Payments are manually recorded by administrators; no payment gateway processes money. Recording full payment confirms a Pending booking after availability checks. Revenue counts payment records currently marked Paid and excludes Refunded records. Cancellation does not automatically refund money.

## Password recovery

An administrator verifies the customer and opens **More → Reset user password** to generate a private reset link. Links expire after 30 minutes and are single-use. The customer opens the link and chooses a new password. SMTP and Gmail are not required. See `PASSWORD-RESET.md`.

## Project organization

- Root HTML files: customer pages; `admin/`: administrator pages.
- `assets/css/`: styles; `assets/js/`: shared utilities and page behavior.
- `assets/images/`: logos, sample photos, and uploaded images. Preserve uploads when updating.
- `backend/`: JSON endpoints, shared PHP logic, configuration, authentication and authorization.
- `database/`: fresh-install schema and migrations for existing installations.

Customer and admin sessions are separate. Mutations require CSRF tokens, passwords are hashed, queries use prepared statements, and uploaded images are validated and re-encoded. Compatibility API wrappers remain available for older integrations; small wrapper files are intentional.

## Verification and troubleshooting

See `CLEANUP-REPORT.md` for this audit and `BACKEND-API.md` for API contracts. Earlier testing documents describe the version tested at the time and may contain historical behavior.

- Database errors: start MySQL and verify the connection settings and required schema.
- Image-upload errors: enable GD and Fileinfo, check folder permissions and PHP upload limits.
- Missing updates: use the Apache URL rather than opening files directly; refresh the page.
- Password recovery: use the administrator-generated link, not email configuration.

Use this installation for local coursework. Replace demo credentials and review deployment configuration before public use.
