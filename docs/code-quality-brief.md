# Campaign Admin Tool — Code Quality Brief

Written before the work as a plan; updated after it with what actually
happened. The five sections are the five questions that were asked, and each
now carries both the position at the start and the position now.

Every number was measured, not estimated. The "before" figures come from
commit `a2a4645` (25 August). The "after" figures were measured at commit
`eee901b` and every one can be reproduced with the commands in
`code-quality-runbook.md`.

---

## What was asked for

Recorded verbatim, because the document should be answerable against the
request rather than against someone's memory of it:

> 1. **The Code we Used** — explain the tech stack, and also the advantages of
>    using Next.js
> 2. **The Objective of quality check** — what exactly are we checking, and by
>    fixing it what are we achieving?
> 3. **How did we Design (HLD)**
> 4. **How are we planning to check the code quality**
>    1. Architecture level or component level?
> 5. **How do we generate a report**

The sections below map one-to-one onto those five points, in that order.

Two of them cannot be fully answered yet, and the document says so where it
matters rather than filling the gap:

| Point | Status |
|---|---|
| 1. The code we used | Answerable now — measured from `package.json` |
| 2. Objective of the quality check | Answerable now — a decision, not a measurement |
| 3. How we designed it (HLD) | Answerable now, with the diagram marked as read from the code rather than generated from it |
| 4. How we plan to check quality | The **method** is settled. The **findings** do not exist until the tools have been run |
| 5. How we generate a report | The **format** is settled and the **baseline** is captured. There is no "after" column until a slice is complete |

The distinction between a settled method and an absent result is the thing to
protect. A plan presented as a result is the one failure this document cannot
recover from, because the next question is always "show me".

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

**This diagram is drawn from reading the code, not generated from it.** The
import chains beneath it were verified individually, but the picture as a whole
has not been checked against the real dependency graph. Running `madge` replaces
it with one derived from actual imports; until then it should be read as an
accurate summary rather than as evidence.

The published artefact is the point of the whole system: the editor writes a
JSON file to R2, and a widget on the customer's own website reads it. **That
widget lives in a different repository and is out of scope here.**

### Front end, back end, or both

Measured at `a2a4645` by `scripts/feature-inventory.mjs`, which is committed
alongside this document so the table can be reproduced and argued with:

```bash
node scripts/feature-inventory.mjs
```

The file-to-feature mapping in that script is a human judgement — it has to be,
because the codebase has no module boundaries to read — so it is written down
as code rather than described in prose. Anyone who disagrees with a placement
can move one line and re-run.

Note that the totals move as the code does: the same script at `ad9cdc5`
reports 27,943, ten lines more, from a change committed after the baseline.
This is why the "before" must be pinned to a commit rather than to a date.

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

One qualification, because the distinction matters and a reader will make it
anyway: what follows shows that the *layering holds*. It does not show that the
service and repository code is itself free of duplication, dead branches or
oversized functions — the same four questions being asked of the front end.
Layering is not quality. A well-layered service can still be a 400-line
function. The back end is small enough that checking it properly is cheap, and
it should be checked rather than assumed.

Every API route goes through a service or a repository — verified, no route
touches the database directly:

```
/api/config, /api/draft, /api/variants  →  campaignService  →  campaignRepository  →  db
/api/auth/*, /api/presence              →  userRepository                          →  db
```

That is a clean layered design. **The server code is 1,081 lines across 16
files — 3.9% of the codebase.**

An earlier draft of this document said 1,479 lines. That figure was wrong, and
the way it was wrong is worth recording. It came from adding the three
"front + back" feature rows (729 + 509 + 241), which are *feature* totals and
include each feature's client-side code. A feature row is not a layer count.
The corrected figure counts server code only:

| | Lines |
|---|---|
| `src/app/api` | 399 |
| `src/repositories` | 314 |
| `src/services` | 63 |
| Server-side lib and middleware | 305 |
| **Backend total** | **1,081** |

The other 95% is front end, and **44% of the entire codebase sits in three
files**:

| File | Lines (25 Aug) | Lines now |
|---|---|---|
| `src/components/promo/PromoSection.tsx` | 6,306 | **748** |
| `src/app/page.tsx` | 3,431 | **744** |
| `src/components/announcement/AnnouncementSection.tsx` | 2,637 | **714** |

These were not components. Each was an entire feature in a single file. That
was where the work was, and the effort went almost entirely to the front end.

**What replaced them.** Not one big file split into smaller big files: the
three features are now roughly ninety modules, each named for the one thing it
decides or draws. The test applied at every seam was not length but coupling —
how many things a group needs from outside it. Under about twelve inputs it is
a module; past twenty-five it is a keyhole, and cutting there makes the code
harder to change, not easier. One extraction was measured at thirty-nine
inputs and abandoned rather than shipped; it became viable only after the
duplication underneath it was removed, at which point it needed twelve.

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

**Since.** ESLint 9 is installed and configured (flat config, `eslint-config-next`
pinned to the framework's major version), enforcing SonarQube's S104 file-length
rule at 750 lines. `knip`, `jscpd` and `madge` cover dead code, duplication and
the dependency graph. `vitest` runs the tests. Every one is a devDependency: a
production install takes none of them, and the shipped bundle is unchanged by
all of them.

### The gap this plan has to answer for: there are no tests

**Zero test files. No test framework in `package.json`.** Not Jest, not Vitest,
not Playwright, not Testing Library.

This is the most serious finding in the document, and it is about the *plan*
rather than the code. The method above proposes moving code across a 27,933-line
codebase with `tsc --noEmit` and manual checking as the only safety net. Types
catch a renamed field. They do not catch a reordered effect, a lost early
return, or a condition that used to be inverted — which is precisely the class
of mistake a large refactor makes.

There is no honest way to present a restructuring plan of this size without
saying what catches a regression. Three options, and the choice is a decision
to be taken rather than assumed:

1. **Characterisation tests before each slice** — write tests that capture what
   the code does *now*, refactor, and require them to still pass. Cheapest per
   slice, and it targets exactly the code being moved.
2. **A small end-to-end suite** over the critical paths — sign in, edit, save
   draft, publish. Fewer tests, catches whole-flow breakage, slower to write.
3. **Neither, explicitly** — accept manual verification, and say so, with the
   risk stated rather than left for someone to discover.

Option 1 is the recommendation: it scales with the work instead of preceding
all of it, and each slice arrives with its own evidence that behaviour did not
change. Whichever is chosen, the refactor should not start before it is decided.

**What happened.** Neither option 1 nor 2, in the end, and the reason is worth
recording because it was not the plan.

The safety net during the work was the compiler plus manual verification after
every commit — option 3, with the risk accepted. What made that defensible was
the shape of the changes rather than the discipline: extractions were verified
by hashing each moved function before and after and requiring the bytes to
match, so "did this move change behaviour" was answered mechanically rather
than by reading. Where a move could not be byte-identical, the difference was
stated in the commit.

Forty-three defects were found and fixed during the work. Every one was found
by hand, which is the honest measure of what the absence of tests cost.

Tests came at the end rather than the beginning, and were aimed by the defect
data rather than by coverage: **24 of the 43 defects came from one rule living
in two places**, so the suite covers those rules, which are now single and
pure. Fifty-six cases across six suites; 97% line coverage of that logic.

The suite justified itself on its first run by finding a live defect nobody had
noticed: an announcement with a start date and no end date never displayed at
all, when it was set to run indefinitely. "Forever" had been written as the
largest date JavaScript can hold, and the next line pushed it past the maximum
into `Invalid Date`, against which every comparison is false. Manual testing
had never caught it because the symptom is silence.

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
(9,962 lines) do similar jobs and were built at different times. **That they
duplicate each other is a hypothesis, not a finding** — nothing has measured it
yet, and it is listed here as the thing to check first, not as something known.

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

## Outcome — measured

Every figure reproducible with the commands in `code-quality-runbook.md`.

| | 25 Aug | Now | |
|---|---|---|---|
| Files | 78 | 194 | |
| Lines of TypeScript | 20,960 | 24,497 | comments and modules added |
| Largest file | 4,935 | **748** | −85% |
| Files over 750 lines (SonarQube S104) | 6 | **0** | |
| Files over 400 lines | 12 | **4** | |
| Functions over 7 parameters (S107) | — | **0** | |
| ESLint errors | 31 | **0** | |
| ESLint warnings | 63 | **11** | all deliberate `exhaustive-deps` on refs |
| Duplicated lines | 580 (2.03%) | **235 (0.68%)** | |
| Duplicated blocks | 50 | **21** | |
| Circular dependencies | 2 | **0** | |
| Unused exports | 36 | **0** | |
| Tests | 0 | **56** | 97% of the decision logic |

**Distribution, which says more than the maximum.** Median file 84 lines, 90%
under 276, 95% under 322. That is the shape that matters: not that the biggest
file shrank, but that a large file is now unusual rather than normal.

### The four files still over 400

`PromoSection` 748, `page.tsx` 744, `AnnouncementSection` 714,
`usePromoRichText` 641. Each is an orchestrator that already has six to eight
modules extracted from it. Taking them lower means seams of twenty-five to
forty inputs — shorter files, more coupling, harder to change. They were left
deliberately, and that is a defensible position rather than unfinished work.

### What the defect data actually says

Forty-three defects were found, fixed and recorded with symptom, reproduction
and root cause. **Twenty-four came from a single pattern: one rule implemented
in two places, the copies drifting, and nobody noticing because both looked
reasonable.**

Examples, each a separate incident: the schedule-window rule in the editor and
the dashboard; the card-is-blank rule in the authorship check and the editor's
Clear button; the countdown wording rule fixed in one place and not the other;
`FIELD_MAX_LINES` missing a field in four places; three copies of the sequence
that installs a card; two undo systems on the same keystroke.

This is the finding to carry forward. **File length was not the disease — it
was where duplicates could hide unnoticed.** The line counts made them
findable; consolidating the rules is what removed them. Any future standard
should be written against duplication and coupling, with length as the signal
that invites a look rather than the thing being fixed.

### Standard proposed

Three tiers rather than one number, derived from this codebase rather than
borrowed:

| | |
|---|---|
| **750 lines** | enforced by the linter — objective, and it fires |
| **400 lines** | a review prompt, not a gate: "what are the two things in here?" Matches the observed p90 of 276 |
| **Coupling** | the real gate. Under ~12 inputs across a seam is a module; past ~25 it is a keyhole and splitting makes things worse |

### What remains

Stated because a partial answer reads worse than a complete one:

- **59 functions over 100 lines and 39 over cognitive complexity 15**
  (SonarQube S138 and S3776). Mostly React components, where a long JSX return
  trips the rule without being a real problem. The job is calibrating and
  writing down the threshold, not refactoring.
- **No tests for React components, the countdown's markup builders, the API
  routes, or end-to-end.** The next most valuable is the markup builders,
  which need a browser environment.
- **11 dependency vulnerabilities** (`next`, `postgres`, `sharp`, `drizzle`),
  none introduced by the quality tooling and all predating this work.

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
