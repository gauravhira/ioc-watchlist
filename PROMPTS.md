# AI Usage Notes

**Tool used:** Claude Code (claude-sonnet-4-6) via the Claude desktop app

---

## Prompts given (in order)

1. *(Pasted the full assignment brief)* "this is a coding assignment i was given. I'm planning to use next js frontend and python backend (or just next js for ease of deployment)"

2. "Yes, push to GitHub" *(after Claude proposed the stack and asked where to build)*

3. "the coloring is all wrong. The cards have white bg with very light greyish text so nothing is visible properly. Also can we add some more examples in the database?"

4. "let's add a confirmation window before deleting and save it in a recently deleted table to be permanently deleted within 7 days"

5. "let's move the add indicator to the left side of window and list to right side in a 2-column layout on desktop and single on mobile. recently deleted can be below the ioc list on the right"

6. "let's deploy on github with appropriate readme from the assignment doc"

---

## Where the AI got something wrong or needed correction

### 1. Database URL path confusion
After running `npx prisma migrate dev`, the generated `dev.db` file landed in `prisma/dev.db` (Prisma resolves relative paths from the schema location). Claude initially changed `DATABASE_URL` to `file:./prisma/dev.db` before recognising the error and reverting — Prisma's client resolves the same path at runtime, so `file:./dev.db` is correct in both contexts.

### 2. Port collision on dev server restarts
The original `npm run dev` process was left running in the background while a second instance was started. The second process picked up port 3001, but Claude's seed script was still targeting 3000. This caused a confusing round of connection-refused errors before Claude identified that the original server was still alive on 3000 and updated the script accordingly.

### 3. Prisma client lock during migration
After running `prisma migrate dev` to add the `deletedAt` column, `prisma generate` failed with `EPERM` because the running dev server held a lock on the query engine DLL. Claude initially attempted to regenerate in-place, which failed. The fix required stopping the server (`taskkill`), regenerating, and restarting — something a human would likely have known to do first.

### 4. Tailwind v4 colour contrast
The initial colour scheme used Tailwind's `bg-blue-100 text-blue-800` badge style, which rendered nearly invisible under Tailwind v4's updated palette (lighter tints than v3). Claude only caught this after the user reported it. The fix was to switch to solid-colour badges (`bg-blue-600 text-white`).

---

## Total build time

- **Start:** 2026-10-29 ~13:53 (session opened)
- **End:** 2026-10-29 ~15:00 (README + push)
- **Active build time:** ~45 minutes (including all back-and-forth iterations)
