# Changelog

## 2026-08-10

- Added email/password registration and Auth.js CredentialsProvider alongside Google OAuth on the same User model.
- Added Argon2id password hashing, email verification, password reset, Redis registration/login limits, and global session revocation.
- Added explicit Google linking, Google re-authentication before adding a password, login-method removal guards, and security notification email.
- Added sign-in/register/recovery/verification/security UI and Mailpit for local email testing.
- Blocked unverified credential users from creating topics, replies, and reports.
- Added the credentials-auth migration and security regression tests.
- Expanded Forum CRUD into the full forum module: denormalized counters, nested replies, edit history, accepted answers, bookmarks, subscriptions, mentions, notifications, moderation reports/audit and reputation logs.
- Added sanitized Markdown-to-HTML persistence with internal-only image hosting.
- Added forum search, topic editor/preview, activity pages, moderation screens and notification bell.
- Added the `20260810170000_full_forum` migration and full forum business-rule tests.
- Split PostgreSQL enum additions into `20260810165000_forum_enum_values`, then successfully deployed and smoke-tested all four migrations in Docker.

## 2026-08-08

- Added persistent Forum CRUD APIs backed by Prisma/PostgreSQL and real Auth.js sessions.
- Added soft deletion, accepted answers, vote toggling, debounced views, report/topic rate limits, and commander-tag verification metadata.
- Connected forum category/thread UI, sanitized Markdown rendering, and optimistic voting.
- Added an idempotent category-only seed with no fake users.
- Added real Google OIDC sign-up/sign-in with Auth.js, database sessions, role-aware guards, protected routes, and authenticated header UI.
- Added and applied the initial PostgreSQL migration; seeded 8 forum categories in Docker.
- Fixed the Docker development node_modules volume so dependency and Prisma Client changes are synchronized on container start.

All notable architecture and contract changes are recorded here. This project follows Keep a Changelog structure and will adopt semantic versioning at its first release.

## [Unreleased]

### Added

- Initial modular-monolith architecture specification.
- Multi-file Prisma schema baseline for identity, forum, Codex, kingdom, ingestion, and i18n.
- Stateless `tools` boundary with no persistence models.
- MVP REST API inventory and Google-to-Governor verification flow.
- Mandatory independent-community disclaimer and prohibition on private game APIs or game automation.
- Mobile-first Next.js UI for home, forum, Codex, tools, speedup calculator, and sign-in routes.
- Vietnamese/English client dictionaries and locale switcher.
- Six stateless calculator cores, a validated speedup API route, and calculator unit tests.
- Docker development/production stack with PostgreSQL, Redis, MinIO, Caddy, and a moderation-safe OCR worker skeleton.
- CI workflow, environment template, root README, and foundation QA/security report.

### Decisions

- PostgreSQL is the source of truth; Redis is non-authoritative infrastructure for caching, rate limiting, and BullMQ jobs.
- Google OIDC `sub` is stored as both the provider account identifier and the app's private `User.googleSub`; email is not the linking key.
- Large player metrics are serialized as decimal strings at the HTTP boundary.
- Governor verification uses `SELF_REPORTED`, `SCREENSHOT_VERIFIED`, and `MODERATOR_VERIFIED`; OCR is never auto-published.
- Domain display labels use stable i18n message keys with `vi` and `en` translation rows.
- Next.js was upgraded to 16.3.0 during integration to remove audited production dependency vulnerabilities.
