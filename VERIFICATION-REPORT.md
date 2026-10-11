## Latest verification — 8 October 2026, final continuation

This section supersedes the earlier stopped-service and pending-browser notes below.

- Apache served the live vehicle API with HTTP 200 after the normal XAMPP startup. The live database retained 23 vehicles and 9 bookings; all 15 tables passed mysqlcheck again.
- The remaining review browser test passed in an isolated QA copy: the customer logged in, selected the confirmed rental, submitted a five-star review, and saw it persist after reload. The form was replaced with the already-reviewed notice. SQL confirmed one saved review for the tested booking.
- Admin categories were fixed and retested earlier; customer lists/details, reports, payments, messages, profile, reset-link form and booking details also loaded successfully.
- The temporary QA website was archived outside the web root at work/qa-validation-completed-20261008. The browser QA database was exported to work/browser-qa-completed-20261008.sql and dropped.
- One non-production cleanup item remains: riderent_status_qa_20260928 has orphaned files from the interrupted earlier test. Its SQL drop could not remove the nonempty directory. No engine files were manually removed. It is not used by RideRent; the production database check and live API still pass.

The tested application flows are working. This is not an exhaustive guarantee for every input or future service stability. The original database crash cause remains unconfirmed. Keep Apache and MySQL running during the demonstration and retain the recovery backup outside the web root.

---
# RideRent verification — 8 October 2026

## Completed

- Enabled the installed GD extension in XAMPP php.ini; the original file was backed up in work/php-before-gd.ini.
- Verified photo preview (loaded at 240 pixels wide) and successful vehicle upload through Apache in a disposable copy of the website.
- Verified customer login, bike filtering, liking a vehicle, two-vehicle comparison, booking date selection, rental total, booking submission, booking reference, profile update and navigation in the browser.
- Verified administrator login and dashboard. Recording a test payment increased revenue from NPR 26,500 to NPR 30,100 and changed the booking to Confirmed. The customer tracker displayed matching Pending and Confirmed checkmarks.
- Inspected the mobile catalogue at 390 pixels and the desktop dashboard. The mobile comparison page contained its wide table without document overflow. Admin login had no document overflow at 390, 768 and 1440 pixels.
- Fixed garbled punctuation in admin loading labels and empty table cells. Updated the payment button accessibility label to use the public booking reference.
- Core API regression passed registration, authentication, vehicle search/filter/sort/pagination, profile update, price calculation, invalid dates, overlap protection, booking ownership/cancellation, concurrent double-booking prevention, reviews, contact submission, password change, logout and remember-me revocation.
- Vehicle API tests passed upload, add, read, edit while retaining the image, deactivate, relist and CSRF checks.
- Notification and favorites API tests passed access control, ownership, mutations and duplicate-event/idempotence checks.
- All 71 PHP files and 10 JavaScript files passed syntax checks. Local references in 36 HTML pages resolve.

## Unresolved service failure

On 8 October, MySQL stopped while a temporary test schema was being created. The client reported a lost connection, subsequent connections were refused, and MySQL produced a crash dump. Apache remained running. The cause has not been established; no database repair, production re-import or deletion of database engine files was attempted.

Consequently, the remaining browser walkthrough (admin categories, reports, customer details, messages, reset UI and review submission UI) is not complete. Some underlying APIs passed earlier tests, but this is not a claim that every screen or workflow has been verified.

The disposable browser database is riderent_browser_qa_20261007. An interrupted status test may also have left riderent_status_qa_20260928. Neither is the normal riderent database. Leave them intact until MySQL is stable and cleanup can be done through SQL.

The temporary qa-validation website was moved outside the Apache document root to the workspace work directory. Customer records in riderent were not intentionally modified by these tests. Keep Apache and MySQL running in XAMPP to use the application; the database service failure must be resolved before final sign-off.

