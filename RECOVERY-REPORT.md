## Latest verification — 8 October 2026, final continuation

This section supersedes the earlier stopped-service and pending-browser notes below.

- Apache served the live vehicle API with HTTP 200 after the normal XAMPP startup. The live database retained 23 vehicles and 9 bookings; all 15 tables passed mysqlcheck again.
- The remaining review browser test passed in an isolated QA copy: the customer logged in, selected the confirmed rental, submitted a five-star review, and saw it persist after reload. The form was replaced with the already-reviewed notice. SQL confirmed one saved review for the tested booking.
- Admin categories were fixed and retested earlier; customer lists/details, reports, payments, messages, profile, reset-link form and booking details also loaded successfully.
- The temporary QA website was archived outside the web root at work/qa-validation-completed-20261008. The browser QA database was exported to work/browser-qa-completed-20261008.sql and dropped.
- One non-production cleanup item remains: riderent_status_qa_20260928 has orphaned files from the interrupted earlier test. Its SQL drop could not remove the nonempty directory. No engine files were manually removed. It is not used by RideRent; the production database check and live API still pass.

The tested application flows are working. This is not an exhaustive guarantee for every input or future service stability. The original database crash cause remains unconfirmed. Keep Apache and MySQL running during the demonstration and retain the recovery backup outside the web root.

---
# Database recovery and verification — 8 October 2026

## Recovery performed

Before startup, the stopped MySQL data directory and configuration were copied to the workspace at `work/mysql-recovery-20261008`. The original backup remains untouched.

A diagnostic copy started successfully. The original installation then completed InnoDB crash recovery, rolling back its interrupted transaction. All 15 RideRent tables passed mysqlcheck. A full SQL export, including triggers and routines, was saved at `work/mysql-recovery-20261008/riderent-export.sql` outside the web root.

Two further startup/write/read/shutdown cycles succeeded, including one with the unmodified XAMPP configuration. Temporary test tables were created, inserted, updated, read, and dropped. Existing RideRent records were not replaced. The normal XAMPP startup subsequently served the vehicle API with HTTP 200; the database contained 23 vehicles and 9 bookings.

The original cause of the earlier file-read crash has not been established. Successful recovery and short stability tests are not a guarantee against future crashes. No database engine files were deleted, no force-recovery mode was enabled, and no production schema was re-imported.

## Application fix

The administrator category page failed because a shared form helper assigned `type` to a textarea, which is read-only in the browser. The helper now assigns it only to inputs. The corrected category form loaded and saved a disposable category successfully. The change is installed in both the workspace and live project.

After recovery, admin customer lists/details, reports, payment records, messages, profile, reset-link form and booking details loaded through Apache. Existing booking, payment, image-upload and customer-flow evidence is recorded in VERIFICATION-REPORT.md.

## Current limitation

On the final continuation, localhost again refused connections. The crash dump still had its earlier 07:26:54 timestamp, so there was no new dump establishing another crash. Review submission UI and a complete final rehearsal remain unverified. Apache and MySQL must remain running in XAMPP for those checks and for the defense demonstration.

The temporary qa-validation website has been archived outside the web root. The two named QA databases are retained until the service is available for SQL cleanup; do not delete database engine files manually. The live riderent database is separate.

