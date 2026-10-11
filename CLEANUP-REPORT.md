# Project cleanup — 7 October 2026

## Changes

- Removed unused SMTP configuration, its example, and the mail helper. Admin-generated reset links remain the supported recovery method.
- Removed one unreferenced test upload from the workspace; it was not present in the localhost copy. Verified that no live vehicle or customer image record referenced it.
- Allowed blob image URLs in the image-only Content Security Policy directive so vehicle upload previews can display.
- Replaced inline preview styles with a shared CSS class compatible with the site's style policy.
- Fixed admin detail rendering so a numeric zero remains visible instead of becoming a dash.
- Removed obsolete Active-status wording from FAQ and terms.
- Updated setup, password-reset, and API documentation to reflect the implemented admin pages and current booking flow.

Compatibility endpoint wrappers, database migrations, photo credits, fallback illustrations, and intentional .gitkeep files were retained. They are useful even when small or not linked directly by a page.

## Verification

- All 71 remaining PHP files passed PHP syntax checks.
- All 10 JavaScript files passed Node syntax checks.
- Local src/href targets in all 36 HTML pages exist.
- No unintentionally empty project files were found.
- Isolated-database tests passed for administrator page APIs, category CRUD, authentication, CSRF, category deletion protection, and report date validation.
- Full payment confirms a Pending booking; repeated payment updates remain idempotent.
- Admin-assisted password reset passed authorization, replacement-link invalidation, single-use redemption, and login with the new password after SMTP removal.
- Updated localhost file hashes match the workspace copies.

The older standalone reset test required a separate server on port 8775 and could not connect. Its relevant checks were rerun successfully in a fresh isolated database/server harness.

## Limits and remaining setup

Live HTTP smoke checks were blocked by this session's network sandbox. No visual browser walkthrough was performed during this cleanup. Static link and syntax checks do not prove every user workflow works.

The installed PHP CLI reports GD disabled. Secure image uploads require enabling GD in XAMPP and restarting Apache; image preview corrections do not replace this server requirement.

Database records and user uploads were preserved. Backups are outside the served website under the workspace's work/cleanup-backup and work/cleanup-live-backup folders.
