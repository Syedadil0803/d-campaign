# Code Quality — Runbook

Every command used to measure this codebase, what it produces, and how to read
it. The security scanners live in a separate runbook
(`security-scanning-runbook.md`); this one is about structure and size.

**Two sections, kept apart on purpose.** The first holds commands that have
been run against this repository, with the output actually observed. The
second holds commands for tools not yet installed — written down so they are
ready, but marked because nobody has seen their output yet. A runbook that
blurs the two is how a plan starts being quoted as a result.

---

# Verified — run against this repository

## cloc — how much code is there

Not installed; `npx` fetches it on demand.

### Totals for our own code

```bash
npx cloc src
```

Observed:

```
Language        files    blank   comment     code
TypeScript         78     1747      5236    20960
CSS                 2       88       138      472
SUM:               80     1835      5374    21432
```

Read the four columns as:

- **code** — the instructions that run. This is the honest figure to quote for
  size.
- **comment** — notes for humans. The computer ignores them.
- **blank** — spacing.
- **files + blank + comment + code** — a plain line count. For TypeScript that
  is 27,943, which is what `wc -l` reports, and the two agree.

Quote **20,960** as the size of the codebase. Quoting 27,943 counts comments
and empty lines as if they were code, and anyone who checks will notice.

### Per file — where the code actually sits

```bash
npx cloc src --by-file --include-lang=TypeScript
```

Observed at the top of the list:

```
src/components/PromoSection.tsx           4935
src/components/AnnouncementSection.tsx    2344
src/app/page.tsx                          2148
```

Three files, 9,427 lines, **45% of all the code** across 78 files. This
command needs no human judgement, which is what makes it the strongest single
piece of evidence in the assessment.

### Whole project, dependencies excluded

```bash
npx cloc . --exclude-dir=node_modules,.next,coverage,dist,build
```

**Never run `npx cloc .` without the exclusions.** It counts `node_modules` —
every package the project installs — and reports around 3,000,000 lines. That
number is Next.js and its dependencies, not anything we wrote.

## The feature breakdown

```bash
node scripts/feature-inventory.mjs
```

Groups files by feature and prints lines per feature, plus a backend-only
total.

**No tool can produce this on its own**, and the reason matters: the codebase
has no folders that mark where one feature ends and the next begins —
everything sits together in `components/` and `lib/`. That absence is part of
what the review is fixing. So the grouping is a human judgement, written into
the script as a list rather than typed into a spreadsheet once. Anyone who
disagrees with a placement changes one line and re-runs it.

Observed: 78 files, 27,943 total lines; backend-only 1,081 lines across 16
files, 3.9% of the codebase.

Note the script counts **total** lines, where cloc separates code from
comments. Both are correct; they answer different questions. Do not mix the
two figures in one table.

## The compiler

```bash
npx tsc --noEmit
```

Type-checks the whole project without building it. Currently clean — zero
errors in `src`.

This is the safety net during a refactor, and it must be run after every step,
not at the end. It is also the only automated check the project has today.

---

# Verified — the remaining four

All four have now been run against this repository. Every count below is what
was actually observed.

## Install

```bash
npm i -D knip jscpd madge eslint eslint-config-next@15
```

**Pin eslint-config-next to the framework version.** npm installs the latest
major by default, which put v16 on a Next 15 project — a rule set describing a
framework this code is not running. The cost of matching is that v15 needs the
FlatCompat wrapper rather than supporting flat config directly.

cloc is not installed; `npx` fetches it each time.

## knip — unused code

```bash
npx knip
```

Observed: 4 unused files, 2 unused packages, 36 unused exports, 5 unused
exported types.

**Half the file findings were wrong**, and that is the tool working correctly
rather than failing. knip follows imports between code files. Three of the
things it flagged are used in ways that leave no import to follow:

- `public/sw.js` — the browser loads it by address
- `scripts/feature-inventory.mjs` — run by hand
- `flag-icons` — a script reads it as files rather than importing it

Check every finding before acting on it. Search the whole repository for the
name, including `scripts/`, which is where two of the three false positives
were hiding.

**The 36 unused exports are not dead code.** The functions are used inside
their own files and exported unnecessarily. The fix is deleting the word
`export`, not the function. Confirm by searching within the file itself: if the
name appears several times there and nowhere else, it is alive but needlessly
public.

**It will now report the quality tools themselves as unused devDependencies.**
cloc, knip, jscpd, madge and eslint are command-line tools that nothing
imports. Correct, and noise on every run — the argument for writing a
`knip.json` that declares the real entry points.

**It cannot see everything.** Five dead HTML mockups in `src` were invisible to
it because nothing imported them and they were not TypeScript. Eight unused
functions inside PromoSection were invisible because they were never exported.
ESLint found those.

## jscpd — duplication

```bash
npx jscpd src --min-lines 5 --reporters console
```

Observed at the tool's default of 5 lines: 50 repeated blocks, 580 duplicated
lines, 2.03%.

**The threshold changes the answer, so state which was used.** At 20 lines the
same codebase reports 6 blocks and 0.53%. Neither figure is wrong; they answer
different questions. Use the default unless there is a reason not to — a
threshold someone picked is a judgement that has to be defended.

Read the *locations*, not the percentage. 34 of the 50 blocks were a file
repeating itself rather than two files sharing code, and 25 of those were in
the two largest files. A repeat is within-file when the same filename appears
on both lines of the pair.

Duplication is reported in both lines and tokens. Quote lines — tokens are how
the tool compares code internally and mean nothing to a reader.

## madge — how the parts connect

```bash
npx madge --extensions ts,tsx --ts-config tsconfig.json --circular src
```

Observed: 80 files, 2 circular dependencies.

**The `--ts-config` flag is not optional here, and leaving it off fails
silently.** Without it madge cannot resolve this project's `@/...` import
paths. It skipped 55 of 80 files, said so only as "(55 warnings)", and reported
a confident, clean-looking "1 circular dependency" having ignored most of the
project. With the flag, unresolved files drop to 7 — all external packages —
and the real answer is 2.

Always read the warning count before the result.

**Check whether a reported cycle is real.** Open both files and read their
import lines. If either side uses `import type`, that half is erased when the
code is built and no cycle exists at runtime. Both of the two found here are
type-only, so neither exists in the built application.

## ESLint — everyday code problems

Needs `eslint.config.mjs` at the project root before it will run. ESLint 9 uses
flat config; `.eslintrc.json` is never read, and an old one left in place will
mislead whoever edits it next.

```bash
npx eslint .
```

Observed on first run: 94 problems — 31 errors, 63 warnings.

**Ignore what you did not write.** Without an ignore list this reads the build
output and reports thousands of problems in generated code. `next-env.d.ts`
belongs there too: Next regenerates it every build, so its one error cannot be
fixed and returns anyway.

**Teach it the underscore convention rather than obeying it.** Several Lexical
signatures require parameters this code does not use, marked `_config`,
`_editor`, `_position`. Deleting them breaks the signature; renaming them loses
the signal. `argsIgnorePattern: '^_'` in the config is the right answer.

```bash
npx eslint . --fix
```

**Only run this after the before-count is recorded.** It rewrites files. Check
what ESLint says is fixable first — it reported "1 error and 5 warnings
potentially fixable", so nothing else could be quietly rewritten.

## Re-measuring after a change

```bash
npx cloc src
npx cloc src --by-file --include-lang=TypeScript
npx knip
npx jscpd src --min-lines 5 --reporters console
npx madge --extensions ts,tsx --ts-config tsconfig.json --circular src
npx eslint .
npx tsc --noEmit
npm run build
```

Same commands, same scope, or the comparison means nothing. `npm run build`
last: it compiles every page and catches what a type check alone does not.

# Saving output

Reports go to `security-reports/`, which is ignored locally through
`.git/info/exclude`, so nothing generated lands in the repository.

```bash
npx cloc src --by-file --include-lang=TypeScript > security-reports/cloc-before.txt
```

Save the "before" output before any code moves. The comparison at the end is
only worth something if the starting point was recorded rather than
remembered.

---

# Tests

## Install

```bash
npm i -D vitest @vitest/coverage-v8
```

Both are devDependencies. Neither is bundled — a production install
(`npm ci --omit=dev`) fetches neither, and `next build` never compiles a test
file, because `tsconfig.json` excludes `*.test.ts`. `tsconfig.test.json`
type-checks them separately:

```bash
npx tsc -p tsconfig.test.json --noEmit
```

## Running

```bash
npm test              # once
npm run test:watch    # re-runs on change, while working
npm run test:coverage # with a coverage report
```

Six suites, 56 cases, under half a second. `coverage/` is git-ignored.

## What is tested, and why only that

The suites cover `src/lib/` — the shared decision logic, pure functions with
no React in them:

| File | What it decides |
| --- | --- |
| `promo/promoAuthorship.ts` | did the user write this, or did we hand it to them |
| `promo/cardReplaceConsent.ts` | should replacing the card ask, and what should it ask |
| `promo/promoCardIdentity.ts` | what a card *is*, and what it starts as |
| `promo/lookSignature.ts` | when two designs count as the same |
| `announcement/announcementWindow.ts` | which messages are live right now |
| `dateRange.ts` | when an end date is before its start |

This is not an arbitrary choice. Of the defects in the register, **24 of 43
came from one rule living in two places** — the two copies drifting apart, and
nobody noticing because both looked reasonable. Those rules now exist once
each, and these tests are what stops them quietly growing a second copy again.

Each case is one that **was wrong at some point**, so the files read as the
history of what this code got wrong rather than as a checklist. Two worth
knowing about:

- `cardReplaceConsent` pins the **order** of its branches, not just its
  outcomes. Several defects were a check that had drifted above or below
  another and so became unreachable, which the outcomes alone cannot show.
- The countdown's arithmetic asserts that hours never reaches 24 and that an
  unreadable date gives zero rather than `NaN`.

The suite earned itself on the first run: it found a live defect where an
announcement with a start date and **no end date never displayed at all**,
when it was set to run indefinitely. "Forever" had been written as the largest
date JavaScript can hold, and the next line widened it past the maximum into
`Invalid Date`. Manual testing had never caught it because the symptom is
silence.

## Coverage

```bash
npm run test:coverage
```

| | |
| --- | --- |
| Lines | 97% |
| Statements | 95% |
| Branches | 90% |
| Functions | 93% |

**Read the scope before quoting the number.** `vitest.config.mts` lists the
files it covers, and that list is exactly the decision logic above.
`lib/editor/timerUtils.ts` is deliberately outside it even though one of its
functions is tested: the rest builds markup through `DOMParser` and needs a
browser environment to exercise at all. Counting those lines as untested would
say the decision logic is thinly covered when it is not — and leaving them out
without saying so would be worse. They are a later phase, with jsdom.

## What is not covered

Stated plainly, because an auditor will ask and a partial answer reads worse
than a complete one:

- **React components** — no rendering tests. The editors are exercised by hand.
- **The countdown's markup builders** — need a DOM environment.
- **API routes and the database layer** — no integration tests.
- **End to end** — nothing drives a browser.

The order that would add the most safety next is the countdown's markup
builders, then the API routes.

## Adding a test

Put it beside the code as `<name>.test.ts`. Import through the `@/` alias, the
same way the app does, so the test exercises what actually ships:

```ts
import { describe, expect, it } from 'vitest';
import { isInvalidRange } from '@/lib/dateRange';

describe('isInvalidRange', () => {
  it('rejects an end before the start', () => {
    expect(isInvalidRange('2026-05-10', '2026-05-01')).toBe(true);
  });
});
```

One habit worth keeping: **when a bug is found, add the case before the fix.**
Watch it fail, then fix it. A test written afterwards proves the code does
what it now does; a test written first proves it does what it should.
