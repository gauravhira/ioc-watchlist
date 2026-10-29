# IOC Watchlist Manager

A full-stack web app for security analysts to maintain a watchlist of Indicators of Compromise (IOCs).

## What it does

- Add IOCs (IP addresses, domains, URLs, MD5/SHA-1/SHA-256 hashes) with optional notes and tags
- Automatically detects the IOC type from the submitted value
- Normalises indicators so defanged variants (`192[.]168[.]1[.]10`, `hxxps://`) are recognised as duplicates of their canonical forms
- Filters the watchlist by type and/or tag
- Deletes individual entries

## Tech stack

| Layer      | Technology                      |
|------------|---------------------------------|
| Frontend   | Next.js 16 (App Router) + React |
| Styling    | Tailwind CSS                    |
| Backend    | Next.js API Routes (TypeScript) |
| ORM        | Prisma                          |
| Database   | SQLite (via `better-sqlite3`)   |

Single-repo, zero extra services — chosen for simplicity of local development and easy Vercel deployment.

## Architecture & design decisions

### Normalisation pipeline (`src/lib/ioc.ts`)

Every submitted value goes through:
1. **Trim whitespace**
2. **Defang**: `hxxp(s)` → `http(s)`, `[.]` → `.`, `[:]` → `:`, `[//]` → `//`
3. **URL canonicalisation**: parsed with `new URL()` to strip the fragment (`#...`), remove trailing slashes on root paths, and lowercase the entire value
4. **Non-URL canonicalisation**: strip trailing dots (FQDN) and slashes, lowercase

The normalised form is stored in a `UNIQUE` column so the database enforces the dedup constraint.

### Type detection

After normalisation, types are tested in priority order:
`ipv4` → `sha256` → `sha1` → `md5` → `url` → `domain`

Hash types are matched first so a 64-char hex string is never mistaken for a domain.

### Data model

```
Ioc ←→ IocTag ←→ Tag   (many-to-many)
```

Tags are stored once and shared; `IocTag` is a join table with a composite PK. Cascade deletes on the Ioc side keep orphan cleanup automatic.

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

| Variable       | Default            | Description             |
|----------------|--------------------|-------------------------|
| `DATABASE_URL` | `file:./dev.db`    | SQLite file path        |

The `.env` file is included in the repo (safe since it only sets a local file path).

## API endpoints

| Method   | Path               | Description                                      |
|----------|--------------------|--------------------------------------------------|
| `GET`    | `/api/iocs`        | List all IOCs. Query params: `?tag=…&type=…`     |
| `POST`   | `/api/iocs`        | Create an IOC. Body: `{value, note?, tags?}`     |
| `DELETE` | `/api/iocs/:id`    | Delete an IOC by ID                              |

### POST /api/iocs

**Request body:**
```json
{
  "value": "hxxps://evil[.]example[.]com/login",
  "note": "seen in phishing campaign",
  "tags": ["phishing", "c2"]
}
```

**Response 201:**
```json
{
  "id": 1,
  "value": "hxxps://evil[.]example[.]com/login",
  "type": "url",
  "note": "seen in phishing campaign",
  "createdAt": "2026-10-29T...",
  "tags": ["phishing", "c2"]
}
```

**Error 409 (duplicate):**
```json
{
  "error": "Duplicate: this indicator already exists as entry #1 (\"hxxps://evil[.]example[.]com/login\")",
  "existingId": 1
}
```

**Error 422 (unrecognised type):**
```json
{
  "error": "\"badvalue\" is not a recognised IOC type (ipv4, domain, url, md5, sha1, sha256)"
}
```

## Deployment (Docker)

```bash
docker build -t ioc-watchlist .
docker run -p 3000:3000 -v ioc-data:/app/prisma ioc-watchlist
```

Or deploy to Vercel (note: Vercel's serverless environment does not support SQLite with a persistent filesystem — swap `DATABASE_URL` for a Postgres connection string and update `prisma/schema.prisma` to `provider = "postgresql"`).

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
      - DATABASE_URL=file:./dev.db
    command: sh -c "npx prisma migrate deploy && node server.js"
volumes:
  ioc-data:
```

## Known limitations & improvements with more time

- **No pagination** — the list grows unbounded; a cursor-based page API would fix this
- **No URL dedup across http/https** — `http://evil.com` and `https://evil.com` are stored as separate entries; a policy decision is needed
- **No edit/update** — analysts can only delete and re-add to change a note or tags
- **SQLite on Vercel** — would need Postgres (or Turso) for true serverless deployment
- **No authentication** — any user can delete any entry; OIDC/API-key auth would be the first thing to add in production
- **Tag autocomplete** — the tag input is free-text; a multi-select with existing tag suggestions would reduce typos

## Security & domain assumptions

- **Defanging is presentation, not validation** — the original submitted value (including its defanged form) is preserved for display; only the normalised form is used for dedup
- **URL fragment stripping** — `https://evil.com/page#section` and `https://evil.com/page` are treated as the same indicator since fragments are client-side only and carry no network significance
- **Case folding** — domains and hashes are lowercased; IP octets are compared numerically after the IPv4 regex match
- **Trailing dot** — `evil.com.` (FQDN with explicit root dot) normalises to `evil.com`
- IOC detection is intentionally strict: a value that matches no type is rejected with a 422 rather than stored as "unknown"
