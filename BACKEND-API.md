# RideRent backend API

The requested backend folder structure is implemented. All API files return JSON and contain no page layouts. Existing customer endpoints and the extra `auth/reset-password.php` endpoint are retained. The listed `submit-review\.php` spelling is normalized to `submit-review.php`.

## Updating an existing XAMPP copy

Keep the frontend and backend from the same version together. Preserve uploaded images and the existing database. See README.md for fresh-install and migration guidance; do not re-import sample data over a working installation.

Enable `extension=gd` in XAMPP's `php.ini` and restart Apache for image uploads. Fileinfo must also be enabled. PHP must be able to write to `assets/images/profiles/`, `assets/images/vehicles/`, and its configured upload temporary directory. Set `upload_max_filesize=2M`, `post_max_size=3M`, `display_errors=Off`, and `log_errors=On` in PHP configuration. Startup warnings happen before endpoint code runs, so server configuration is needed to keep those out of JSON responses. Upload APIs return a JSON 503 if GD is unavailable.

Administrator pages include the dashboard, vehicle/category management, bookings, customers, payments, messages, reports, password-reset links, and profile. The customer profile-image upload API is available, but the profile screen does not currently expose an upload control.

## Authentication and responses

Every response has `success`, `message`, and `data`. Errors use HTTP 400/401/403/404/405/409/422/429/500/503 where appropriate.

GET `backend/auth/session.php` for customer status and its CSRF token. GET `backend/admin/session.php` for administrator status and its separate CSRF token. Both responses include `data.loggedIn` and `data.csrfToken`; customer identity is `data.user`, admin identity is `data.admin`.

Every mutation uses **POST**, including login and logout, with an `X-CSRF-Token` header. Send JSON with `Content-Type: application/json`, or `FormData` for uploads without setting Content-Type manually. Fetch with `credentials: 'same-origin'`. Login regenerates the session ID and returns a new CSRF token; use the new token on subsequent POST requests.

Customer and administrator cookies are separate (`riderent_customer` and `riderent_admin`). A customer cookie cannot authorize admin APIs. Admin logout does not log out the customer.

Demo admin: `admin@riderent.example` / `password`.

Example for an admin HTML page, with this code placed in an external JavaScript file:

```javascript
const base = "../backend/admin/";
const session = await fetch(base + "session.php", {
    credentials: "same-origin",
}).then((r) => r.json());
const login = await fetch(base + "login.php", {
    method: "POST",
    credentials: "same-origin",
    headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.data.csrfToken,
    },
    body: JSON.stringify({ email, password }), // Values from the login form.
}).then((r) => r.json());
if (!login.success) throw new Error(login.message);
const csrfToken = login.data.csrfToken;
const dashboard = await fetch(base + "dashboard.php", {
    credentials: "same-origin",
}).then((r) => r.json());
```

## Shared files

| File                                  | Responsibility                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `backend/config/database.php`         | PDO connection, UTF-8, exception mode, optional environment overrides.                             |
| `backend/helpers/functions.php`       | Session bootstrap, prepared queries, validation, pricing, availability, password/remember helpers. |
| `backend/helpers/response.php`        | Standard JSON output and HTTP status.                                                              |
| `backend/helpers/csrf.php`            | CSRF generation, POST and token validation.                                                        |
| `backend/helpers/uploads.php`         | Validate, decode, and re-encode uploaded images under random filenames.                            |
| `backend/helpers/admin-functions.php` | Admin authorization, enum/integer/amount validation, pagination and report dates.                  |
| `backend/api.php`                     | Customer endpoint dispatch, preserving existing routes.                                            |
| `backend/admin-api.php`               | Admin endpoint dispatch. No customer session restoration.                                          |

## Customer endpoints

All paths in this table are relative to `backend/`. Existing endpoint contracts remain compatible with the customer JavaScript.

| Endpoint                          | Method          | Fields or query parameters                                                                                               |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `auth/session.php`                | GET             | None.                                                                                                                    |
| `auth/register.php`               | POST            | `full_name`, `email`, `phone`, `address`, `driving_license`, `password`, `confirm_password`.                             |
| `auth/login.php`                  | POST            | `email`, `password`, optional `remember`.                                                                                |
| `auth/logout.php`                 | POST            | None.                                                                                                                    |
| `auth/forgot-password.php`        | POST            | `email`; returns instructions to contact the administrator for a reset link.                                                                |
| `auth/reset-password.php`         | POST            | `token`, `password`, `confirm_password`.                                                                                 |
| `auth/change-password.php`        | POST            | `current_password`, `new_password`, `confirm_password`. Requires customer login.                                         |
| `vehicles/get-vehicles.php`       | GET             | `q`, `category`, `brand`, `fuel`, `transmission`, `min_price`, `max_price`, `sort`, `page`, `limit`, optional date pair. |
| `vehicles/search-vehicles.php`    | GET             | Same filters as the vehicle list.                                                                                        |
| `vehicles/get-vehicle.php`        | GET             | `id`.                                                                                                                    |
| `vehicles/get-categories.php`     | GET             | None; returns `data.categories`.                                                                                         |
| `vehicles/check-availability.php` | GET             | `vehicle_id`, `pickup_date`, `return_date`.                                                                              |
| `bookings/create-booking.php`     | POST            | `vehicle_id`, `pickup_date`, `return_date`; requires login.                                                              |
| `bookings/get-bookings.php`       | GET             | Optional `status`; owned bookings only.                                                                                  |
| `bookings/get-booking.php`        | GET             | `id`; owned booking only.                                                                                                |
| `bookings/cancel-booking.php`     | POST            | `booking_id`; owned Pending/Confirmed booking only.                                                                      |
| `users/get-profile.php`           | GET             | Current customer only.                                                                                                   |
| `users/update-profile.php`        | POST            | `full_name`, `phone`, `address`, `driving_license`; current customer only.                                               |
| `users/upload-profile-image.php`  | POST / FormData | `image` file; current customer only. Returns `data.profile_image`.                                                       |
| `contact/submit-message.php`      | POST            | `full_name`, `email`, `phone`, `subject`, `message`.                                                                     |
| `reviews/get-reviews.php`         | GET             | `vehicle_id`; returns reviews, average and own eligible Confirmed/Completed bookings.                                              |
| `reviews/submit-review.php`       | POST            | `booking_id`, `rating` (1–5), `review_text`; owned Confirmed/Completed booking, one review per booking.                            |
| `public/stats.php`                | GET             | Public aggregate statistics.                                                                                             |

## Admin endpoints

Paths below are relative to `backend/admin/`. Every endpoint except login and session requires administrator authentication. Lists support `page` and `limit` (1–100, default 20) and return a `pagination` object, except category lists.

| Endpoint                          | Method                  | Parameters / response                                                                                                                                |
| --------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.php`                     | GET                     | Admin status and CSRF token.                                                                                                                         |
| `login.php`                       | POST                    | `email`, `password`.                                                                                                                                 |
| `logout.php`                      | POST                    | End only the admin session.                                                                                                                          |
| `dashboard.php`                   | GET                     | Statistics, recent bookings/users, booking/availability summaries. Available count means active fleet marked Available, not a requested-date search. |
| `vehicles/get-vehicles.php`       | GET                     | `id` (for editing), `q`, `category`, `status`, `is_active`, pagination. Returns `vehicles` array.                                                    |
| `vehicles/add-vehicle.php`        | POST / FormData         | All vehicle fields below and required `image`. Returns `vehicle_id`.                                                                                 |
| `vehicles/update-vehicle.php`     | POST / JSON or FormData | `vehicle_id`, all vehicle fields; optional `image` and `is_active` (0/1). Missing image preserves current image.                                     |
| `vehicles/deactivate-vehicle.php` | POST                    | `vehicle_id`; sets `is_active=0`, never deletes history. Existing reservations remain and should be reviewed by the operator.                        |
| `categories/get-categories.php`   | GET                     | Categories and vehicle counts.                                                                                                                       |
| `categories/add-category.php`     | POST                    | `category_name`, `description`.                                                                                                                      |
| `categories/update-category.php`  | POST                    | `category_id`, `category_name`, `description`.                                                                                                       |
| `categories/delete-category.php`  | POST                    | `category_id`; refuses categories referenced by any vehicles.                                                                                        |
| `bookings/get-bookings.php`       | GET                     | `q` (booking ID/customer/vehicle), `status`, pagination.                                                                                             |
| `bookings/get-booking.php`        | GET                     | `id`; joined booking/customer/vehicle data and payments.                                                                                             |
| `bookings/update-status.php`      | POST                    | `booking_id`, `booking_status`.                                                                                                                      |
| `customers/get-customers.php`     | GET                     | `q` (name/email/phone), pagination; no password fields.                                                                                              |
| `customers/get-customer.php`      | GET                     | `id`; customer, booking history, count and paid amount.                                                                                              |
| `payments/get-payments.php`       | GET                     | `status`, `booking_id`, pagination.                                                                                                                  |
| `payments/update-payment.php`     | POST                    | `payment_id`, `payment_status`; optional `payment_method`, `transaction_reference`. Amount remains the stored amount.                                |
| `messages/get-messages.php`       | GET                     | `is_read` (0/1), pagination.                                                                                                                         |
| `messages/mark-read.php`          | POST                    | `message_id`.                                                                                                                                        |
| `messages/delete-message.php`     | POST                    | `message_id`; permanent deletion of that contact message.                                                                                            |
| `reports/get-reports.php`         | GET                     | `from_date`, `to_date` (`YYYY-MM-DD`), inclusive calendar dates.                                                                                     |

Vehicle fields: `category_id`, `vehicle_name`, `brand`, `model`, `registration_number`, `manufacturing_year`, `fuel_type`, `transmission`, `seats`, `price_per_day`, `description`, `availability_status` (defaults to Available).

Allowed fuels: Petrol, Diesel, Electric, Hybrid. Transmissions: Manual, Automatic. Fleet status: Available, Maintenance, Unavailable. Registration numbers are unique. Years: 1980 through next calendar year; seats: 1–50. Daily prices must be positive, with at most two decimal places.

## Booking and payment rules

Normal status flow: Pending → Confirmed → Completed. Pending and Confirmed may also become Cancelled. Completed and Cancelled are terminal; repeating the current status is idempotent. Vehicle locks use the same order as customer booking creation, and confirmation rechecks overlapping reservations and fleet availability.

Payment flow: Pending → Paid/Failed; Failed → Pending/Paid; Paid → Refunded. Refunded is terminal. Repeating a state is idempotent. A new Paid update is rejected if it would exceed the booking total or collect against a cancelled booking. Payment method values: Cash, Card, Bank Transfer, Online. No real money is processed.

Payment updates and the booking payment summary commit in one transaction. Recording full payment also confirms a Pending booking after checking availability. Existing booking creation supplies a Pending cash record, so the update endpoint does not create extra payment rows. If the database contains multiple payment rows, the booking summary uses their aggregate paid total; partial payment remains Pending. Current Paid rows count toward revenue; refunded rows do not. This is a simple payment-record system, not a historical accounting ledger.

Reports count bookings using booking creation date and revenue using payment date. Vehicle/category popularity excludes cancelled bookings. Revenue by month includes currently Paid records only. Report defaults are 2000-01-01 through today. Customer totals use paid records, avoiding inflated totals from unpaid/cancelled reservations.

## Upload security

Only JPEG, PNG, and WebP are accepted, at most 2 MB, 4000 pixels per side, and 12 megapixels. Both extension and detected MIME/type are checked. GD decodes and re-encodes each image as PNG, and the server generates a random filename. SVG uploads are rejected. Failed database writes remove the new uploaded file; successful replacements remove only the previous server-generated image. Seeded illustrations are never removed.

## Compatibility

Earlier flat administrator endpoints are retained as aliases: `vehicles.php`, `add-vehicle.php`, `update-vehicle.php`, `delete-vehicle.php`, `categories.php`, `bookings.php`, `update-booking.php`, `customers.php`, `payments.php`, `messages.php`, and `reports.php`. Flat list aliases are GET only; new mutations use the nested routes above. Prefer the new paths for all new frontend code.

See `BACKEND-TESTING.md` for validation of this update and `TESTING.md` for customer regression coverage.
