# Full Forum module

The full forum extends the original `Category`, `Topic`, and `Reply` tables in place. It does not create a second forum graph or a second user identity.

## Data guarantees

- Category/topic/reply/vote counters are mutated in the same Prisma transaction as the originating write.
- Topic and reply deletion is soft deletion. Replies remain in PostgreSQL when a topic is hidden.
- Topic/reply edits first create `ForumEditHistory` rows.
- Reputation is derived from `ReputationEvent`; there is no mutable reputation total on `User`.
- Reply nesting is normalized to one child level.
- Markdown is converted to sanitized HTML on write. External image hosts are removed; configure `S3_PUBLIC_URL` for the internal object-storage host.
- Notifications, mentions, accepted answers, report resolution, and moderation audit records are transactionally created with their source action.

## Rate limits

- MEMBER: 5 topics/hour and 20 replies/hour.
- CONTRIBUTOR: unlimited topics and 60 replies/hour.
- MODERATOR/ADMIN: no forum post/reply limit.
- Reports: 5/hour/user.

## Search

`GET /api/forum/search` currently tokenizes the query and applies parameterized case-insensitive matching to `title` and Markdown body. This is the documented MVP fallback for Vietnamese search. A code TODO marks the upgrade to an `unaccent`-aware generated `tsvector` and GIN index.

## Deployment

Apply both pending migrations after Docker/PostgreSQL starts:

```bash
docker compose up -d --wait
docker compose exec web npm run db:migrate:deploy
```

The enum migration `20260810165000_forum_enum_values` is intentionally committed first because PostgreSQL cannot consume new enum values in the transaction that creates them. `20260810170000_full_forum` then performs the one-time counter and safe HTML backfill.
