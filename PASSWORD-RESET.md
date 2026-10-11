# Easy password reset: admin-generated link

No Gmail, SMTP, OTP, or old password is required.

1. The customer contacts the RideRent administrator with their registered email.
2. The admin logs in at `http://localhost/RideRent/admin/login.html`.
3. Open **More → Reset user password** in the admin navigation.
4. Enter the customer email, verify their identity through your normal process, and check the confirmation box.
5. Click **Generate reset link**, then **Copy link**. Share it privately with that customer.
6. The customer opens the link, enters and confirms a new password, then logs in.

The link expires after 30 minutes and works once. Generating another link invalidates earlier links for that customer. A successful reset also revokes remembered-login tokens. Existing active sessions on other devices are not forcibly terminated.

Only authenticated administrators with a valid CSRF token can generate links. The public Forgot Password form gives instructions and never reveals reset tokens or whether an account exists. The database stores a hash of each token, not the full link. No database migration is needed.

The link uses the address currently used by the administrator. A localhost link works only on the XAMPP computer; for another device, use the site's reachable address. The Copy button falls back to selecting the text if clipboard access is unavailable.

Password recovery uses admin-generated links; no SMTP configuration is needed.

New API: POST `backend/admin/customers/create-reset-link.php` with JSON `{ "email": "customer@example.com", "identity_verified": true }` and the admin `X-CSRF-Token`. Returns `data.reset_path`, `data.expires_in_minutes`, and customer identity. Never publish or log the returned link.
