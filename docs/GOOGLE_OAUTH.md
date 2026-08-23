# Google OAuth setup

ROK FAQ uses Auth.js v5, Google OpenID Connect, the Prisma adapter, and revocable JWT sessions. Every session read reloads role, verification state, and login methods from PostgreSQL. `User.sessionVersion` invalidates every JWT after a password reset.

1. In Google Cloud Console, create an OAuth client ID of type **Web application**.
2. Add `http://localhost:3000/api/auth/callback/google` as the development authorized redirect URI.
3. Add `https://<your-production-domain>/api/auth/callback/google` for production.
4. Copy `.env.example` to `.env` and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`, and `NEXTAUTH_URL`.
5. Generate `AUTH_SECRET` with `openssl rand -base64 32` and never commit `.env`.
6. Apply the schema with `npx prisma migrate dev --schema prisma/schema`, then start the application.

Google's verified `profile.sub` is stored as the app's stable `googleSub`. It is not returned in the browser session. Access tokens, refresh tokens, and ID tokens remain in the server-side `accounts` table and are never added to session JSON.

Google is never silently merged by email. Linking is only performed while an existing ROK FAQ session is authenticated and the user explicitly starts the flow from `/profile/security`.
