# Prisma schema

ROK FAQ uses Prisma's multi-file schema layout. Each bounded context owns one file under `schema/`; cross-context relations are explicit and reviewed as API contracts.

```bash
npx prisma format --schema prisma/schema
npx prisma validate --schema prisma/schema
npx prisma migrate dev --schema prisma/schema
npx prisma db seed --schema prisma/schema
```

`tools.prisma` intentionally has no model because calculators are pure, stateless functions. Never add a model merely to log calculator inputs; saved calculations, if later approved, belong to a separately specified user feature.

The schemas contain no game API integration. All Codex and kingdom provenance must be supplied by community/manual/import/OCR workflows described in `docs/SPEC.md`.

The idempotent seed creates only forum categories and their translations. It never creates a fake user; forum writes always use the authenticated Google session user.
