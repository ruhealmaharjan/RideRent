# Customer application validation

- PASS: Anonymous session returns JSON and CSRF token
- PASS: Authentication and CSRF guards
- PASS: Vehicle listing, search, filters, sorting, pagination, invalid IDs
- PASS: Registration, duplicate email, invalid credentials, login
- PASS: Profile authorization, data minimization, update
- PASS: Availability and booking ignore client price and user ID
- PASS: Overlap rejection, past and invalid dates, adjacent rentals allowed
- PASS: Booking ownership and cancellation restrictions
- PASS: Concurrent requests across two PHP servers cannot double-book
- PASS: Completed-only reviews, review ownership, duplicate prevention
- PASS: Contact submission, password verification/change, logout and new login
- PASS: Persistent remember-me token and logout revocation
- PASS: One-time password reset token redemption
- PASS: Passwords preserve intentional whitespace
- PASS: All 18 HTML pages and local links; PHP restricted to backend
- PASS: Browser customer flow, form validation, rendering, and mobile overflow

PHP and JavaScript syntax checks passed separately. Tests use an isolated temporary MariaDB database, two PHP servers, independent cookie sessions, and HTTP requests. Browser automation used Edge at 390, 768, 1440, and 1920 pixels. No JavaScript runtime errors were observed in the tested customer journey.

Not validated: actual email delivery (requires mail setup) and administrator pages (outside this customer-page implementation). Apache-specific .htaccess rules were supplied but tests used PHP development servers.
