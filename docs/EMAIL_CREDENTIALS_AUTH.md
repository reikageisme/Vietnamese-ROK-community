# Email/password authentication

## Local setup

The development Compose override starts Mailpit alongside the app:

- SMTP: `mailpit:1025`
- Inbox UI: `http://localhost:8025`

Copy `.env.example` to `.env`, start Docker, then apply the migration:

```bash
docker compose up -d --wait
docker compose exec web npm run db:migrate:deploy
```

Production must provide `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `EMAIL_FROM`. Do not point production at Mailpit.

## Security behavior

- Passwords use Argon2id with 19 MiB memory, two iterations, and parallelism 1.
- Registration is limited to five attempts per hour per IP in Redis.
- Five consecutive bad attempts lock an email key for 15 minutes. Responses do not distinguish an unknown email from a wrong password.
- Verification and reset links contain 256-bit random values. PostgreSQL stores only SHA-256 token hashes.
- Credential-only users can sign in before verification, but cannot create topics, replies, or reports.
- Password reset increments `User.sessionVersion` and deletes legacy database sessions, invalidating all existing devices.
- Google linking requires an authenticated session. Same-email accounts are not merged while signed out.
- A Google-only user must complete a fresh Google OAuth round trip before setting a password.
- The API prevents removing the final remaining login method.

## Routes

- `POST /api/auth/register`
- `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/link-google`
- `POST /api/auth/reauth-google`
- `POST /api/auth/set-password`
- `GET|DELETE /api/profile/security`

The migration is `prisma/schema/migrations/20260810143000_add_credentials_auth/migration.sql`.
