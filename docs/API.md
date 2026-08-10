# RokViet Hub MVP REST API

Base URL: `/api`  
Contract version: `v1` (the MVP paths below are unprefixed; breaking changes will introduce `/api/v2`)

> RokViet Hub là dự án cộng đồng độc lập, không đại diện hoặc được tài trợ bởi Lilith Games. These APIs expose RokViet Hub community data only; they do not proxy or emulate a Rise of Kingdoms game API.

## Conventions

- `BigInt` values such as power and kill points are JSON decimal strings.
- Authenticated requests use the secure Auth.js session cookie.
- `locale` is `vi` or `en`; default is `vi`.
- Common errors: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`.
- List response: `{"data":[],"meta":{"nextCursor":null}}`.

## Endpoint inventory

### Identity

| Method | Path | Access | Input → output |
|---|---|---|---|
| `GET/POST` | `/auth/[...nextauth]` | Public | Auth.js-managed OIDC flow |
| `POST` | `/auth/register` | Public | email, password, displayName, acceptedTerms → user + verificationRequired |
| `POST` | `/auth/verify-email` | Public | token → verified |
| `POST` | `/auth/forgot-password` | Public | email → enumeration-safe acknowledgement |
| `POST` | `/auth/reset-password` | Public | token, password → reset + all sessions revoked |
| `POST` | `/auth/link-google` | Member | start explicit Google account linking |
| `POST` | `/auth/reauth-google` | Member | start Google re-authentication for a security action |
| `POST` | `/auth/set-password` | Member + re-auth | password, currentPassword? → credentials linked |
| `GET/DELETE` | `/profile/security` | Member | list/remove login methods; final method cannot be removed |
| `GET` | `/identity/me` | Member | none → current user, roles, reputation |
| `PATCH` | `/identity/me` | Member | display name, locale → updated user |
| `GET` | `/identity/users/:id` | Public | locale → public contributor profile |

`GET /identity/me`

```json
{"data":{"id":"usr_1","displayName":"Tanh","locale":"vi","roles":["MEMBER"],"reputation":12}}
```

### Forum

The implemented full-forum contract is summarized in [FULL_FORUM.md](FULL_FORUM.md). Current write routes use the unified Auth.js user and verified-email guard where specified.

| Method | Path | Access | Input → output |
|---|---|---|---|
| `GET` | `/forum/categories` | Public | locale → categories |
| `GET` | `/forum/topics` | Public | category, tag, query, cursor, limit → topic summaries |
| `POST` | `/forum/topics` | Member | categoryId, title, body, locale, tagIds → topic |
| `GET` | `/forum/topics/:id` | Public | locale → topic and replies |
| `PATCH` | `/forum/topics/:id` | Author/Moderator | editable fields → topic |
| `DELETE` | `/forum/topics/:id` | Author/Moderator | none → tombstoned topic |
| `POST` | `/forum/topics/:id/replies` | Member | body, locale, parentId? → reply |
| `PATCH` | `/forum/replies/:id` | Author/Moderator | body → reply |
| `DELETE` | `/forum/replies/:id` | Author/Moderator | none → tombstoned reply |
| `POST/DELETE` | `/forum/vote` | Member | targetType, targetId, value? → score |
| `POST` | `/forum/report` | Verified member | targetType, targetId, reason, note? → report |
| `GET` | `/forum/tags` | Public | query, cursor → tags |
| `POST/DELETE` | `/forum/bookmark[/:topicId]` | Member | bookmark toggle |
| `POST/DELETE` | `/forum/subscribe[/:topicId]` | Member | subscription toggle |
| `POST` | `/forum/replies/:id/accept|unaccept` | Topic author | accepted answer + reputation log |
| `POST` | `/forum/topics/:id/pin|lock` | Moderator | moderation state + audit log |
| `GET` | `/forum/search` | Public | q, category, page, pageSize → paginated results |
| `GET/POST` | `/moderation/reports[...]` | Moderator | report queue and resolution |
| `GET` | `/moderation/audit-log` | Admin | moderator audit rows |
| `GET/POST` | `/notifications[...]` | Member | list/read/read-all notifications |

`POST /forum/topics`

```json
{"categoryId":"cat_beginner","title":"Nên ưu tiên chỉ huy nào?","body":"Mình mới bắt đầu mùa 1...","locale":"vi","tagIds":["tag_kvk1"]}
```

```json
{"data":{"id":"top_1","slug":"nen-uu-tien-chi-huy-nao","status":"PUBLISHED","score":0,"createdAt":"2026-08-08T03:00:00Z"}}
```

### Codex

| Method | Path | Access | Input → output |
|---|---|---|---|
| `GET` | `/codex/commanders` | Public | locale, query, civilization, cursor → commanders |
| `GET` | `/codex/commanders/:slug` | Public | locale → commander, skills, talents, revision metadata |
| `POST` | `/codex/commanders` | Contributor | structured commander draft → draft |
| `PATCH` | `/codex/commanders/:id` | Contributor | changed fields, changeNote, patchId? → pending revision |
| `GET` | `/codex/equipment` | Public | locale, query, slot, cursor → equipment |
| `GET` | `/codex/equipment/:slug` | Public | locale → equipment detail |
| `POST` | `/codex/equipment` | Contributor | equipment draft → draft |
| `PATCH` | `/codex/equipment/:id` | Contributor | changed fields + note → pending revision |
| `GET` | `/codex/talents` | Public | locale, query → talents |
| `GET` | `/codex/civilizations` | Public | locale → civilizations |
| `GET` | `/codex/troops` | Public | locale → troop types |
| `GET` | `/codex/events` | Public | locale, from, to → events |
| `GET` | `/codex/patches` | Public | cursor → patches |
| `GET` | `/codex/revisions/:entityType/:entityId` | Public | cursor → published revision history |

Example commander response:

```json
{"data":{"id":"cmd_1","slug":"sample-commander","name":"Chỉ huy mẫu","rarity":"LEGENDARY","status":"PUBLISHED","skills":[],"source":{"kind":"MANUAL_EDITORIAL","patch":"1.0.0"},"updatedAt":"2026-08-08T03:00:00Z"}}
```

### Tools (public and stateless)

| Method | Path | Input → output |
|---|---|---|
| `POST` | `/tools/speedup` | targetSeconds, ownedSeconds → requiredSeconds |
| `POST` | `/tools/resource` | required and owned resource maps → deficit map |
| `POST` | `/tools/healing` | troop tiers/counts and buffs → time/resources |
| `POST` | `/tools/commander-sculpture` | rarity, current skills/stars, target → sculpturesNeeded |
| `POST` | `/tools/equipment-crafting` | recipe and inventory → missing materials |
| `POST` | `/tools/migration-passport` | power, ownedPassports → passportsRequired/deficit |

`POST /tools/speedup`

```json
{"targetSeconds":86400,"ownedSeconds":28800}
```

```json
{"data":{"requiredSeconds":57600,"human":{"days":0,"hours":16,"minutes":0}}}
```

### Kingdom and Governor profiles

| Method | Path | Access | Input → output |
|---|---|---|---|
| `GET` | `/kingdom/governors/:governorId` | Public | none → profile + latest provenance-aware snapshot |
| `POST` | `/kingdom/governors` | Member | Governor identity and optional metrics → self-reported profile |
| `PATCH` | `/kingdom/governors/:id` | Owner/Moderator | profile fields → updated profile |
| `POST` | `/kingdom/governors/:id/snapshots` | Owner/R4/R5/Moderator | metrics, capturedAt, source → pending/self-reported snapshot |
| `GET` | `/kingdom/governors/:id/snapshots` | Public | cursor, from, to → history |
| `GET` | `/kingdom/kingdoms/:number` | Public | cursor → kingdom + public alliances/profiles |
| `GET` | `/kingdom/alliances/:id` | Public | cursor → alliance summary |
| `POST` | `/kingdom/alliances` | R4/R5 | kingdomId, tag, name → alliance |
| `PATCH` | `/kingdom/alliances/:id` | R4/R5 | mutable fields → alliance |

`POST /kingdom/governors`

```json
{"governorId":"123456789","governorName":"NguoiChoiViet","kingdomNumber":1234,"allianceTag":"VN","power":"25000000","killPoints":"90000000","deadTroops":"1200000"}
```

```json
{"data":{"id":"gov_1","governorId":"123456789","verificationStatus":"SELF_REPORTED","latestSnapshot":{"power":"25000000","killPoints":"90000000","deadTroops":"1200000","source":"SELF_REPORTED","capturedAt":"2026-08-08T03:00:00Z"}}}
```

### Ingestion and moderation

| Method | Path | Access | Input → output |
|---|---|---|---|
| `POST` | `/ingestion/uploads` | Member | multipart image + purpose → upload reference |
| `POST` | `/ingestion/ocr/profile` | Member | uploadId, governorProfileId → queued OCR job |
| `GET` | `/ingestion/jobs/:id` | Owner/Moderator | none → sanitized job status/result/confidence |
| `POST` | `/ingestion/submissions` | Contributor | entityType, entityId?, payload, sourceNote → pending submission |
| `GET` | `/ingestion/submissions/:id` | Owner/Moderator | none → submission status |
| `POST` | `/ingestion/imports/alliance` | R4/R5 | multipart CSV + allianceId → staged import job |
| `GET` | `/ingestion/imports/:id` | Owner/Moderator | none → validation summary/status |
| `GET` | `/ingestion/moderation` | Moderator | type, status, cursor → moderation queue |
| `POST` | `/ingestion/moderation/:id/decision` | Moderator | decision, note, resultingVerification? → review result |

OCR output remains pending until review:

```json
{"data":{"id":"ocr_1","status":"PENDING_REVIEW","result":{"governorId":"123456789","power":"25000000"},"confidence":{"governorId":0.98,"power":0.81},"verificationStatus":"SELF_REPORTED"}}
```

### Operational

| Method | Path | Access | Output |
|---|---|---|---|
| `GET` | `/health` | Public | process status only |
| `GET` | `/ready` | Internal | PostgreSQL/Redis/object-storage readiness |

## Standard error

```json
{"error":{"code":"VALIDATION_ERROR","details":{"field":"governorId","reason":"INVALID_FORMAT"}}}
```
