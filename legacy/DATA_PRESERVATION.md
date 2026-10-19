# Data preservation and migration report

## Inspection and current state

The connected repository is `Com-Adarsh/ZMock-test-`. Its prior implementation was a static reconstruction of publicly visible pages. Repository documentation recorded no original application source, database schema, authentication configuration, question bank, or exam API. The static version contained a copied public leaderboard snapshot and links to the live site; it did not contain an exam engine or access to private records.

This rebuild removes that static preview and its copied leaderboard entries rather than presenting old, unverified rankings as current. No production database, account, storage bucket, deployment or DNS was accessed or changed. No verified historical data was available to migrate.

## Preservation boundary

- No production database connection or production write was made.
- No existing user accounts, uploaded source files, exam attempts, responses, answer keys or historical results were available in this workspace.
- The new migration is a schema for a new Supabase application. It is not a migration of the prior WordPress content or an assertion that prior records do not exist.
- Do not apply the migration to a production project until an authorised owner confirms the target and reviews a backup, staging restore and rollback plan.

## Required before any production migration

Obtain authorised source/API and database access. Identify the existing database, authentication, storage, integrations and records from trusted configuration. Back up database and uploaded-file storage; verify restoration; compare IDs, relationships, permissions, record counts and representative file checksums in staging. Test user sign-in, exam attempts, scoring, reports and rollback. Obtain explicit approval before production writes, domain changes or traffic switching.
