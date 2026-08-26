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

# Not yet run — tools not installed

Nothing below has produced output for this repository. These are recorded so
they are ready to run, not because their findings are known.

## Install

```bash
npm i -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks knip jscpd madge
```

`typescript-eslint` is the current single package. Older guides tell you to
install `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin`
separately — that is the ESLint 8 arrangement and does not fit this project.

## knip — unused code

```bash
npx knip
```

Finds files, exports and dependencies nothing uses.

**Expect false positives on the first run.** knip does not know Next's
conventions, and `page.tsx`, `layout.tsx`, `route.ts`, `middleware.ts` and
`manifest` are all entry points that nothing imports by design. Anything it
flags inside `src/app/` is almost certainly wrong until a `knip.json` declares
those as entry points.

**It will also miss things.** It follows JavaScript and TypeScript imports
only. Five dead HTML mockups were removed from `src` — 986 lines — and knip
would not have seen them, because nothing imported them and they were not
TypeScript. They turned up in the cloc language breakdown instead.

## jscpd — duplication

```bash
npx jscpd src --min-lines 20 --reporters console
```

Finds blocks of 20 or more lines repeated elsewhere.

First thing to check: Announcement against Promo. They do similar jobs and
were built at different times. **Whether they duplicate each other is a
hypothesis** — nothing has measured it yet.

## madge — how the parts connect

```bash
npx madge --extensions ts,tsx --circular src
```

Lists circular imports — where two files each depend on the other. A direct
measure of tangled boundaries.

```bash
npx madge --extensions ts,tsx --image docs/architecture.svg src
```

Draws the dependency graph. This is what replaces the architecture diagram
that was read from the code by hand. Needs Graphviz (`brew install graphviz`);
madge says so if it is missing.

## ESLint — everyday code problems

ESLint is not installed and there is no configuration file. `npm run lint`
runs `next lint`, which has nothing to run.

Next 15 uses **flat config** (`eslint.config.mjs`), not `.eslintrc`. `next
lint` is also deprecated in Next 15 and removed in 16, so the setup should
call ESLint directly rather than going through Next.

```bash
npx eslint .
```

---

# Saving output

Reports go to `security-reports/`, which is ignored locally through
`.git/info/exclude`, so nothing generated lands in the repository.

```bash
npx cloc src --by-file --include-lang=TypeScript > security-reports/cloc-before.txt
```

Save the "before" output before any code moves. The comparison at the end is
only worth something if the starting point was recorded rather than
remembered.
