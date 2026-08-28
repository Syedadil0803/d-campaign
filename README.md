# Campaign Admin

The tool the operator uses to write, schedule and publish the promo card and
announcement bar that appear on the live website.

Next.js 15 (App Router) · React 19 · TypeScript 5.6 · Tailwind 3.4 ·
PostgreSQL via Drizzle · Cloudflare R2 · Lexical for the countdown editor.

---

## Running it

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

`.env.local` holds the database URL, the R2 credentials and the session
secret. It is git-ignored and must never be committed — `.env.example` lists
the keys without their values.

---

## What ships, and what does not

This matters for a production deploy and for anyone auditing the app. **The
only things that reach the server are `dependencies` and the built output of
`src/`.**

| Reaches production | Stays behind |
| --- | --- |
| `src/` — excluding `*.test.ts` | `*.test.ts` (excluded in `tsconfig.json`) |
| `public/` | `docs/` |
| `dependencies` in `package.json` | `devDependencies` |
| `migrations/` (run against the DB, not served) | `scripts/` (operator tooling) |

A production install takes none of the dev tooling:

```bash
npm ci --omit=dev
```

Every quality tool — `vitest`, `jscpd`, `knip`, `madge`, `eslint`,
`typescript` — is a devDependency. So is `flag-icons`: only the SVGs
`scripts/copy-flags.mjs` copies into `public/` ship, never the package.

**Never committed** (all covered by `.gitignore`): `.env*.local`, `.next/`,
`coverage/`, `node_modules/`, `*.tsbuildinfo`, `.DS_Store`. If you see these
in the folder they are local build output — they regenerate, and deleting
them is always safe.

---

## Layout

```
src/
├── app/              routes and API handlers — page.tsx is the shell
├── components/
│   ├── promo/        the promo card editor
│   ├── announcement/ the announcement bar editor
│   ├── timer-lexical/the countdown field (a Lexical editor)
│   ├── dashboard/    the landing view
│   ├── shell/        header and the dialogs the page opens
│   └── shared/       used by more than one of the above
├── hooks/            state shared across the two editors
├── lib/              the rules: pure functions, no React
├── services/         one layer above the repository
├── repositories/     the only place SQL is written
└── types/            shapes shared across the app
```

The line worth knowing: **`lib/` holds the decisions and touches no React.**
That is what makes those rules testable, and it is where the tests are
pointed — see `docs/code-quality-runbook.md`.

---

## Commands

| | |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` | production build (also type-checks) |
| `npm test` | run the tests |
| `npm run test:watch` | tests, re-running on change |
| `npm run test:coverage` | tests with a coverage report |
| `npm run lint` | ESLint |
| `npm run db:apply` | apply migrations |
| `npm run seed:user` | create the first operator account |
| `npm run flags` | refresh the country flag SVGs in `public/` |

---

## Documentation

| | |
| --- | --- |
| `SETUP.md` | first-time setup, in detail |
| `docs/code-quality-runbook.md` | the quality tooling, the tests, and how to reproduce every figure |
| `docs/security-and-compliance-testing.md` | security testing |
| `docs/undo-and-recovery.md` | how undo and crash recovery work |
