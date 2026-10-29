# IOC Watchlist Manager

A full-stack web app where security analysts maintain a watchlist of Indicators of Compromise (IOCs).

---

## What the project does

Analysts can:
- **Add** an IOC (IP address, domain, URL, or file hash) with an optional note and one or more tags (e.g. `phishing`, `ransomware`, `c2`)
- **View** all IOCs with their auto-detected type and tags
- **Filter** the list by type and/or tag
- **Delete** an IOC — deletion is soft: the entry moves to a *Recently Deleted* section and is permanently purged after 7 days. It can be restored at any time before that.
- Submit IOCs in **defanged form** (`hxxps://`, `192[.]168[.]1[.]10`, `evil[.]com`) — the app normalises them automatically and stores the original display value alongside the canonical form

---

## Tech stack

| Layer    | Technology                                       |
|----------|--------------------------------------------------|
| Frontend | Next.js 16 (App Router, React, TypeScript)       |
| Styling  | Tailwind CSS v4                                  |
| Backend  | Next.js API Routes (same repo, same process)     |
| ORM      | Prisma 6                                         |
| Database | SQLite (via Prisma's `better-sqlite3` driver)    |

Single-repo, single-process. Chosen because the scope fits a monolith; it removes all coordination overhead, and deployment is a single `docker run`.

---

## Architecture & design decisions

### Normalisation pipeline (`src/lib/ioc.ts`)

Every submitted value is run through a pipeline before storage or dedup lookup:

1. **Trim** leading/trailing whitespace
2. **Defang** — `hxxp(s)` → `http(s)`, `[.]` → `.`, `[:]` → `:`, `[//]` → `//`
3. **URL parse** — if the value parses as a URL, use `new URL()` to strip the fragment (`#…`) and any trailing slash on a bare root path, then lowercase the whole string
4. **Plain value** — otherwise strip trailing dots (FQDN root dot) and trailing slashes, then lowercase

The normalised string is stored in a `UNIQUE` column (`Ioc.normalized`), so the database itself enforces the dedup constraint regardless of how the duplicate was written.

### Type detection (priority order)

After normalisation, types are matched in this order to avoid ambiguity:

```
ipv4 → sha256 (64 hex) → sha1 (40 hex) → md5 (32 hex) → url (http/https scheme) → domain
```

Hashes are tested before domain/URL because a 64-character hex string would otherwise pass the domain regex.

### Data model

```
Ioc ──< IocTag >── Tag   (many-to-many join table)
```

- `Ioc.normalized` — `UNIQUE`, used for dedup
- `Ioc.deletedAt` — `NULL` while active; set on soft-delete; row is hard-deleted by a background purge after 7 days
- `Tag.name` — `UNIQUE`; tags are shared across IOCs and created with `connectOrCreate`
- `IocTag` has a composite PK `[iocId, tagId]`; cascade-deletes on the `Ioc` side

### Soft-delete & retention

`DELETE /api/iocs/:id` sets `deletedAt` rather than removing the row. `GET /api/iocs` filters `deletedAt: null`. `GET /api/iocs/deleted` lists soft-deleted entries and, as a side-effect, hard-deletes any whose `deletedAt` is older than 7 days (lazy purge — no background worker needed at this scale).

---

## How to run locally

**Prerequisites:** Node.js ≥ 18, npm

```bash
git clone <repo-url>
cd ioc-watchlist
npm install
npx prisma migrate dev --name init
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable       | Default         | Description          |
|----------------|-----------------|----------------------|
| `DATABASE_URL` | `file:./dev.db` | Prisma SQLite path   |

The `.env` file is committed (it contains no secrets — only a local file path).

---

## How to run tests

No automated test suite is included in this submission. The normalisation and type-detection logic in `src/lib/ioc.ts` is the highest-value unit to test; a Jest/Vitest suite would cover cases like defang round-trips, hash-length boundary conditions, URL fragment stripping, and trailing-dot FQDN dedup. With more time this would be the first thing to add.

---

## API endpoints

| Method   | Path                  | Description                                                   |
|----------|-----------------------|---------------------------------------------------------------|
| `GET`    | `/api/iocs`           | List active IOCs. Query: `?tag=phishing&type=url`             |
| `POST`   | `/api/iocs`           | Create an IOC                                                 |
| `DELETE` | `/api/iocs/:id`       | Soft-delete (moves to trash)                                  |
| `PATCH`  | `/api/iocs/:id`       | Restore from trash                                            |
| `PUT`    | `/api/iocs/:id`       | Permanently delete immediately                                |
| `GET`    | `/api/iocs/deleted`   | List soft-deleted IOCs; auto-purges entries older than 7 days |

### POST /api/iocs — request body

```json
{
  "value": "hxxps://evil[.]example[.]com/login",
  "note": "seen in phishing campaign",
  "tags": ["phishing", "c2"]
}
```

### Responses

| Status | Meaning                                                             |
|--------|---------------------------------------------------------------------|
| 201    | Created                                                             |
| 409    | Duplicate — body includes `existingId` pointing to the original     |
| 422    | Value does not match any supported IOC type                         |
| 400    | Bad request (missing `value`, non-numeric `:id`, etc.)             |
| 404    | IOC not found                                                       |

---

## Deployment

### Docker

```bash
docker build -t ioc-watchlist .
docker run -p 3000:3000 -v ioc-data:/app/prisma ioc-watchlist
```

The volume keeps the SQLite file across container restarts.

### docker-compose

```yaml
version: "3.9"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ioc-data:/app/prisma
    environment:
      DATABASE_URL: file:./dev.db
    command: >
      sh -c "npx prisma migrate deploy && node server.js"
volumes:
  ioc-data:
```

### Vercel / serverless

SQLite requires a persistent filesystem — not available on Vercel's serverless runtime. To deploy there, change `prisma/schema.prisma` to `provider = "postgresql"` and set `DATABASE_URL` to a Postgres connection string (e.g. Neon, Supabase). No application code changes are needed.

---

## Known limitations

- **No pagination** — the full list is fetched on every render; would need cursor-based pagination beyond a few thousand rows
- **No http/https dedup** — `http://evil.com` and `https://evil.com` are stored as distinct entries; a policy decision is needed on whether they should be collapsed
- **No tag editing** — analysts must delete and re-add an IOC to change its tags or note
- **Lazy purge** — the 7-day trash cleanup runs when the deleted list is fetched, not on a schedule; entries won't be purged if nobody opens the trash panel
- **SQLite in Docker** — not suitable for multi-replica deployments; swap for Postgres for horizontal scale
- **No auth** — any user can read, add or delete any entry

---

## What I would improve with more time

1. **Unit tests** for `normalize()` and `detectType()` covering edge cases (defang round-trips, hash boundaries, URL fragments, IDN domains)
2. **Pagination** on `GET /api/iocs` with cursor-based navigation
3. **Bulk import** — paste or upload a list of IOCs, get a summary of what was added vs. what was already known
4. **Edit in place** — update note and tags without deleting and re-adding
5. **Scheduled purge** — replace the lazy-delete with a cron job so stale trash is cleaned up on a guaranteed schedule
6. **Export** — download the active watchlist as CSV or STIX 2.1 JSON
7. **Authentication** — even a simple API-key header would prevent unauthorised writes in a shared environment

---

## Security & domain assumptions

- **Defanging is display-only** — the original submitted value (including brackets) is preserved for display; only the normalised form is used for dedup and type detection. Analysts benefit from seeing what was originally shared.
- **URL fragment stripping** — `https://evil.com/page#section` and `https://evil.com/page` normalise to the same canonical form. URL fragments are resolved client-side and carry no network significance for tracking purposes.
- **Case folding** — all values are lowercased. Domains and hashes are case-insensitive in practice; a SHA-256 hash with mixed case refers to the same file as its lowercase form.
- **Trailing dot (FQDN)** — `evil.com.` normalises to `evil.com`. The trailing dot is valid DNS syntax for the root zone but is never significant for IOC identity.
- **IPv4 validation** — each octet must be ≤ 255; the regex alone is not sufficient (e.g. `999.0.0.1` matches the pattern but is not a valid address).
- **No IPv6 support** — out of scope for this submission; the type detector would need an RFC 5952 parser.
- **Input sanitisation** — all database writes go through Prisma parameterised queries; there is no raw SQL. The `value` and `note` fields are stored as-is and displayed in the UI with React's default escaping (no `dangerouslySetInnerHTML`), so XSS via stored content is not possible.
