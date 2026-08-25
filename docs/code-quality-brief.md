# Campaign Admin Tool — Code Quality Brief

Context pack for planning the code quality review. Every number here was
measured from the repository at commit `a2a4645`, not estimated.

---

## 1. The code we used

### Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.1 |
| Language | TypeScript, `strict: true` | 5.6 |
| UI | React | 19 |
| Styling | Tailwind CSS | 3.4 |
| Database | PostgreSQL via Drizzle ORM | 0.30 |
| File storage | Cloudflare R2 (S3 API) | AWS SDK 3.x |
| Rich text | Lexical | 0.45 |
| Icons | lucide-react | 0.460 |

### Why Next.js

**One deployable unit.** The editor and the API that serves it are the same
project. A promo card is designed, saved and published without a separate
back-end service to run, version or deploy alongside it. For a team of this
size that removes a whole category of work.

**Auth can be enforced before a page renders.** Next runs middleware at the
edge, so an unauthenticated request is redirected before any page code
executes. The check does not depend on every component remembering to make it.

**Server and client share one set of types.** `CampaignConfig` is defined once
and used by the editor, the API route and the database layer. A field renamed
in one place fails to compile in the others rather than failing in production.

**Static delivery without a separate build pipeline.** The admin UI is served
from the edge; only the API routes are dynamic.

The honest trade: App Router behaviour — streamed metadata, server vs client
components, caching — is subtle, and getting it wrong fails quietly rather
than loudly. A real example is recorded in section 3.

---

## 2. The objective of the quality check

**This is not a bug hunt.** A code review asks "is this correct?". This asks
"is this well built?" — which is a different question with different evidence.

### What we are checking

1. **Size** — is there more code than the job needs? Ten lines that should be
   three; a file that should be four files.
2. **Structure** — does each piece do one job, in one place? Or is one file
   holding an entire feature, so a change to one part risks the rest?
3. **Duplication** — is the same logic written twice? Two copies drift, and
   the second copy is the one nobody remembers to fix.
4. **Dead code** — files, exports and dependencies nothing imports any more.
5. **Boundaries** — do the layers hold, or does everything reach into
   everything?

### What we achieve by fixing it

**Changing one thing stops breaking another.** This is the whole point. When a
feature lives in one bounded module, a fix to it cannot reach the rest of the
app. Today a change inside a 6,306-line file has a much wider blast radius than
the change itself.

**Work can be divided.** Separate modules can be worked on by separate people,
or by the same person on separate days, without collisions.

**New features get cheaper rather than more expensive.** Every feature added to
a tangled codebase makes the next one harder. The curve bends the other way
once boundaries exist.

**The quality is demonstrable.** For a marketplace listing or an enterprise
buyer, "our code is good" is worthless and "here is what we measured, here is
what we changed, here is the re-measurement" is not.

---

## 3. How we designed it (HLD)

### Shape at 50,000 feet

```
Browser
  │
  ├── Editor UI (React, client components)
  │     Dashboard · Promo editor · Announcement editor · Templates
  │                        │
  │                        │  fetch()
  │                        ▼
  ├── Middleware (edge) — verifies the signed session before anything renders
  │                        │
  │                        ▼
  ├── API routes (server)  /api/auth/* · /api/config · /api/draft
  │                        /api/variants · /api/presence
  │                        │
  │                        ▼
  ├── Services & repositories — campaignService, campaignRepository,
  │                             userRepository
  │                        │
  │         ┌──────────────┴──────────────┐
  │         ▼                             ▼
  └──   PostgreSQL                  Cloudflare R2
        (config, drafts,            (published campaign JSON,
         users, presence)            read by the customer's website)
```

The published artefact is the point of the whole system: the editor writes a
JSON file to R2, and a widget on the customer's own website reads it. **That
widget lives in a different repository and is out of scope here.**

### Front end, back end, or both

Measured, at `a2a4645`:

| Feature | Layer | Files | Lines | Share |
|---|---|---|---|---|
| Promo card editor | front only | 15 | 9,962 | 35% |
| Shared shell & app state | front only | 14 | 5,519 | 19% |
| Countdown timer editor | front only | 12 | 3,128 | 11% |
| Announcement bar | front only | 3 | 2,961 | 10% |
| Templates & industry copy | front only | 2 | 1,730 | 6% |
| Rich text engine | front only | 5 | 1,618 | 5% |
| Dashboard | front only | 1 | 817 | 3% |
| Auth & session | **front + back** | 9 | 729 | 3% |
| Persistence & publishing | **front + back** | 6 | 509 | 2% |
| Cross-device presence | **front + back** | 3 | 241 | 1% |
| Installable app (PWA) | front only | 2 | 159 | 1% |
| Repositories, services, hooks, utilities | mixed | 6 | 560 | 2% |
| **Total** | | **78** | **27,933** | |

### The finding this produces

**The back end is already well structured. The front end is not.**

Every API route goes through a service or a repository — verified, no route
touches the database directly:

```
/api/config, /api/draft, /api/variants  →  campaignService  →  campaignRepository  →  db
/api/auth/*, /api/presence              →  userRepository                          →  db
```

That is a clean layered design, and it is only about **1,479 lines**, roughly
5% of the codebase.

The other 95% is front end, and **44% of the entire codebase sits in three
files**:

| File | Lines |
|---|---|
| `src/components/PromoSection.tsx` | 6,306 |
| `src/app/page.tsx` | 3,431 |
| `src/components/AnnouncementSection.tsx` | 2,637 |

These are not components. Each is an entire feature in a single file. This is
where the work is, and the quality effort should be aimed almost entirely at
the front end.

`src/app/page.tsx` is a special case: it is not a feature, it is shared state
that every feature reaches into. It will be pulled apart by whichever feature
is worked on, so it should be treated as a surface that shrinks continuously
rather than as a chunk of its own.

### A real example of the subtlety cost

While making the tool installable, the manifest link was being streamed into
the body instead of the document head, because Next streams metadata for
dynamically rendered pages. Chrome runs its installability check at parse time,
found no manifest, and silently declined to offer installation. Every check by
hand said the setup was correct: the link was in the DOM, the URL returned 200
with the right content type. Only asking Chrome directly, over the DevTools
protocol, revealed it. Recorded here because it is exactly the class of problem
a quality review should surface: correct-looking code that fails quietly.

---

## 4. How we plan to check the code quality

### Architecture level or component level?

**Feature level — a vertical slice through both layers.** Neither of the
obvious alternatives works on this codebase:

- **Page level fails.** There is effectively one page. `src/app/page.tsx` is
  3,431 of `src/app`'s 4,153 lines. One bucket would hold the whole tool.
- **Component level fails.** "Component" here does not mean what the word
  implies — `PromoSection.tsx` is a whole feature in one file. It would give 75
  trivial units and 3 that cannot be reviewed in one sitting. The unevenness
  *is* the problem, so it cannot also be the unit of work.
- **Feature level works.** Each slice cuts through front end and back end
  together, which answers the front/back question by construction, and each
  slice is a few days with its own before and after number.

### Order of work

By concentration, not by interest:

1. **Promo card editor** — 35% on its own, the worst tangle, and where the
   technique gets proven
2. **Announcement bar** — likely duplicates promo logic; measuring that is a
   finding in itself
3. **Countdown timer editor** — 12 files already, so mostly a boundary check
4. **Everything else**

`src/app/page.tsx` shrinks throughout rather than being its own phase.

### What checks the code today

Stated plainly, because it is the honest starting point:

- **TypeScript `strict: true`** — genuinely doing work
- **ESLint — not installed.** No config file, not in `package.json`. The `lint`
  script is `next lint`, which has nothing to run. (`next lint` is also
  deprecated in Next 15 and removed in 16, so any setup should use ESLint
  directly.)
- No formatter, no dead-code detection, no duplication detection, no
  dependency-graph check

So today the only automated quality gate is the compiler. That eliminates a
whole class of bugs and says nothing at all about structure, duplication or
dead code — which is precisely what is being asked about.

### Proposed toolchain

Four tools, each answering a different question:

| Tool | Answers | Feeds |
|---|---|---|
| **ESLint** (flat config, `+ react-hooks`) | unused variables, hook misuse, unsafe patterns | §4 |
| **knip** | dead files, unused exports, unused dependencies | §2 — "written 10,000, needed 7,000" |
| **jscpd** | copy-pasted blocks | §2 |
| **madge** | dependency graph, circular imports | **§3 — draws the HLD from the real code** |

`madge` earns its place twice: the architecture diagram becomes *derived from
the code* rather than drawn from memory, and it shows exactly which features
reach into `page.tsx`.

`jscpd` has an obvious first target: Announcement (2,961 lines) and Promo
(9,962 lines) do similar jobs and were built at different times.

### Method per slice

1. Measure the slice — lines, files, tool findings
2. Agree what moves where, before touching anything
3. Refactor, with `tsc` clean at every step
4. Re-measure and record the difference
5. Verify behaviour is unchanged

---

## 5. How we generate a report

### Per slice

- Files and lines before / after
- Findings by tool, with what was done about each
- What moved where, and why
- Confirmation that behaviour did not change

### Final report

- **Total lines of code at baseline: 27,933 across 78 files** (commit
  `a2a4645`)
- Lines reviewed, as a percentage of the whole
- Findings by category: dead code, duplication, oversized modules, boundary
  violations
- Lines removed, lines relocated, modules created
- Final measurement, same tools, same commands, so the two are comparable

The comparison only means something if the "before" is captured *before* any
code moves. That snapshot is the first task.

### Reports are gitignored

Tool output is written to `security-reports/`, ignored locally via
`.git/info/exclude`. Nothing generated lands in the repository.

---

## Constraints anyone working on this must respect

- **UK English** throughout, in code comments and user-facing copy
- **Comments explain why, not what** — the existing codebase documents the
  reasoning behind decisions, not a restatement of the line below
- **Behaviour must not change.** This is a structural exercise. Any behaviour
  change is a separate, deliberate decision
- **`tsc --noEmit` must stay clean** at every step
- The **widget that renders published cards is in another repository** and is
  out of scope
- The **live branch is `feature/promo-guided-flow`**; quality work happens on
  `quality/code-quality-baseline`
