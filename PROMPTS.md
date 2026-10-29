# AI Usage Notes

**Tool used:** Claude Code (claude-sonnet-4-6) via the Claude desktop app

---

## Prompts given (in order)

### 1 — Initial build brief

```
Build a full-stack IOC Watchlist Manager as a Next.js monorepo (App Router,
TypeScript, Tailwind CSS, Prisma + SQLite).

Requirements:
- Form to add an IOC: value (required), note (optional), tags (comma-separated,
  e.g. phishing, ransomware, c2)
- Auto-detect IOC type from the submitted value: ipv4, domain, url, md5, sha1,
  sha256. Reject anything that doesn't match with a clear error message.
- Normalise values before storing: strip defang encoding (hxxps → https,
  [.] → .), fold to lowercase, strip URL fragments and trailing slashes,
  strip trailing dots from FQDNs. Use the normalised form for dedup — if
  the same indicator is submitted twice in different formats it must be
  rejected with a 409 that identifies the existing entry by ID and original
  value.
- REST API: POST /api/iocs (create), GET /api/iocs (list, with optional
  ?tag= and ?type= filters), DELETE /api/iocs/:id.
- Tags are many-to-many with IOCs in a relational schema (SQLite via Prisma).
- List view shows type badge, value, note, tags. Clicking a tag filters the
  list. Separate dropdowns to filter by type and by tag.
- No authentication required. UI can be plain but must be readable.
- Sensible commit history — one commit per logical layer.
```

### 2 — Seed the database with realistic examples

```
Seed the database with representative IOC examples that demonstrate all
supported types and a variety of tags. Include at least:
- Two IPv4 addresses (one defanged, one plain)
- Two URLs (one defanged hxxps, one hxxp)
- Two domains (one with a trailing dot to demo FQDN dedup, one plain)
- One MD5 hash
- One SHA-256 hash
- At least one example where the dedup logic kicks in (e.g. submit the
  same domain with and without the trailing dot — the second should 409)
Add realistic notes and tags (phishing, c2, ransomware, dropper, bruteforce,
lateral-movement, etc.) so the UI looks meaningful.
```

### 3 — Fix UI contrast and colour scheme

```
The type badges are using Tailwind bg-*-100 text-*-800 classes which render
nearly invisible — the tints are too light. Replace them with solid filled
badges (e.g. bg-blue-600 text-white) so each type is clearly distinct.

Also audit the rest of the card styling: note text, tag chips, and the
"No indicators found" empty state should all have explicit dark text colours
rather than relying on inherited defaults. The page background should be
light grey (gray-100) so white cards stand out. Input placeholder text
should use placeholder-gray-400 so it's visible but clearly secondary.
```

### 4 — Soft-delete with a Recently Deleted panel

```
Replace the hard-delete with a soft-delete flow:

1. Clicking the delete button on a card should open a confirmation modal
   ("Move to trash? Permanently deleted after 7 days" with Cancel / Delete
   buttons) before doing anything.

2. On confirm, set a deletedAt timestamp on the row instead of removing it.
   GET /api/iocs should filter to deletedAt IS NULL. Add:
   - DELETE /api/iocs/:id  → soft-delete (set deletedAt)
   - PATCH  /api/iocs/:id  → restore (clear deletedAt)
   - PUT    /api/iocs/:id  → permanent delete immediately
   - GET    /api/iocs/deleted → list soft-deleted entries; auto-purge any
     whose deletedAt is older than 7 days on every read (lazy cleanup, no
     background worker needed)

3. Add a collapsible "Recently Deleted" section below the IOC list. Each
   row shows the type badge (dimmed), value (strikethrough), note, and a
   countdown ("Permanently deleted in N days"). Each row has a Restore
   button and a Delete now button (the latter also needs a confirmation
   modal).

Add a Prisma migration for the new deletedAt column.
```

### 5 — Two-column responsive layout

```
Restructure the page layout:
- Desktop (md breakpoint and above): two columns. Left column is fixed-width
  (~320px) and contains only the Add Indicator form. Right column takes the
  remaining space and contains, top to bottom: the filter bar, the IOC list,
  and the Recently Deleted panel.
- Mobile: single column, form on top, list below.
Use Tailwind's flex/md:flex-row pattern. The Add IOC button should be
full-width inside the form panel. Widen the max-width of the outer container
to accommodate the two columns.
```

### 6 — Assignment README and AI notes file

```
Rewrite README.md to fully satisfy the assignment submission requirements.
It must cover:
  - What the project does
  - Tech stack (table format)
  - Architecture and design decisions: normalisation pipeline step-by-step,
    type detection priority order and why, data model (Ioc / Tag / IocTag),
    soft-delete retention design
  - How to run locally (prerequisites, commands, env vars)
  - How to run tests — honest note that none are included and what would be
    tested first
  - All API endpoints with request/response examples and error status table
  - Deployment: Docker one-liner, docker-compose snippet, note on
    Vercel/serverless (SQLite limitation and Postgres migration path)
  - Known limitations
  - What I would improve with more time (at least 5 concrete items)
  - Security and domain assumptions (defanging, fragment stripping, case
    folding, trailing dot, IPv4 octet validation, no IPv6, XSS stance)

Also create PROMPTS.md listing every prompt given to the AI and a short
section documenting where the AI got something wrong or needed correction.
```

---

## Where the AI got something wrong or needed correction

### 1. Database URL path confusion
After `npx prisma migrate dev`, Prisma placed `dev.db` inside the `prisma/` directory (it resolves relative paths from the schema location). Claude initially changed `DATABASE_URL` to `file:./prisma/dev.db`, which would have broken the migration path. It caught the mistake and reverted — the correct value is `file:./dev.db` in both the migration and runtime contexts because Prisma's generated client uses the same resolution.

### 2. Port collision on dev server restarts
The original `next dev` process was still running in the background when Claude started a second instance. The second process auto-selected port 3001, but the seed script was still targeting 3000. This caused a confusing sequence of connection-refused errors. Claude eventually identified that the first server was still alive on 3000 via the process log and updated the script port accordingly.

### 3. Prisma client lock on Windows during migration
After adding the `deletedAt` column, `npx prisma generate` failed with `EPERM: operation not permitted` because the running dev server held an exclusive lock on the Prisma query engine DLL. Claude attempted to regenerate in-place first before realising the server had to be stopped. The fix required `taskkill /PID`, regenerate, then restart — an obvious Windows-specific issue that should have been the first approach.

### 4. Tailwind v4 colour contrast
The initial badge design used `bg-blue-100 text-blue-800` and equivalent light-tint classes. Under Tailwind v4 these are noticeably lighter than under v3 and rendered nearly invisible against white card backgrounds. Claude only noticed after user feedback. The fix — solid filled badges (`bg-blue-600 text-white`) — should have been the default choice for accessibility.

---

## Build time

- **Start:** 2026-10-29 ~13:53
- **End:** 2026-10-29 ~15:00
- **Total:** ~1 hour 10 minutes including iterations, layout changes, and documentation
