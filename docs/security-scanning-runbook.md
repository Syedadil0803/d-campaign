# Security Scanning — Runbook

Campaign Admin Tool

How to install and run the three free scanners, what each one covers, how to
read the output, and what to do about the findings.

Run them in this order. Each looks at something the others cannot see:

| Tool | Looks at | Answers |
|---|---|---|
| **gitleaks** | Git history | Have we ever committed a secret? |
| **Semgrep** | Our source code | Are there insecure patterns in what we wrote? |
| **npm audit / Socket** | Dependencies | Is anything we depend on vulnerable or malicious? |

---

# 1. gitleaks — secrets in git history

## What it finds

- Database connection strings (`postgres://user:password@host/db`)
- Cloud keys — the R2 access key and secret
- OAuth client secrets
- Private keys (`-----BEGIN PRIVATE KEY-----`)
- JWTs and session tokens
- Generic assignments: a secret-sounding name with a high-entropy value
- `.env` files that slipped past `.gitignore`
- Around 150 third-party token formats (Stripe, GitHub, Slack, and so on)

It searches **every commit ever made**, including files since deleted. A secret
removed in a later commit is still in history and still readable by anyone who
clones the repository.

## What it does not find

Code flaws, vulnerable dependencies, or logic anyone could abuse. It matches
shapes, so a low-entropy password like `summer2026` may not trigger it at all.

## Install

```bash
brew install gitleaks
gitleaks version
```

## Run

Three commands, one per question. Every one of them has been run against this
repository, and the timings below are what it actually took.

**Have we ever committed a secret?** This is the one that matters — it sees
every commit anyone could pull.

```bash
gitleaks git . -c .git/gitleaks.toml --no-banner --redact --verbose
```

298 commits in about 15 seconds. Currently clean.

**Is there a secret in what I am about to commit?** Run it after `git add`.

```bash
gitleaks git . --staged -c .git/gitleaks.toml --no-banner --redact --verbose
```

About 30ms, because it reads the staged diff rather than the history.

**Is there a secret sitting in a file on disk?** Includes untracked files.

```bash
gitleaks dir . -c .git/gitleaks.toml --no-banner --redact --verbose
```

About 300ms. **This one reports 2 findings and that is the correct result** —
both are in `.env.local`, which is gitignored and has never been committed. See
"Silencing false positives" below for why they are deliberately not hidden.

Exit code `0` means clean, `1` means findings.

The flags are not decoration. `--verbose` prints the file and line; without it
you get `leaks found: 2` and nothing to act on. `--redact` masks the secret so
running the scan does not paste it into your terminal scrollback. `-c` points at
the config, which lives inside `.git/` rather than the repository root.

### If you see `detect` or `protect` in older guides

`gitleaks detect --source .` and `gitleaks protect --staged` were the old
spellings. They still work in 8.30 as deprecated aliases, so nothing you find
online is broken — but `git` and `dir` are the current commands, and mixing the
two spellings across a team is how people end up unsure which one is real. Use
the three above.

## The pre-commit hook

`.git/hooks/pre-commit` runs the staged scan automatically on every
`git commit`. Findings block the commit before the commit object exists, which
is the whole point: a secret that never gets committed never needs rotating.

Hooks live in `.git/`, so this one is local to this machine — it is not in the
repository and does not follow a clone. That is deliberate, but it means it
protects whoever installed it and nobody else.

`git commit --no-verify` skips it. That does not make the finding wrong.

To remove it entirely and rely only on running the commands by hand:

```bash
rm .git/hooks/pre-commit
```

## Reading the output

Each finding gives the rule that matched, the file, the line, the **commit
hash** and the author. The commit hash is the important part: it tells you when
the secret entered and whether it is still live.

## What to do about a finding

Three questions, in order:

1. **Is it real?** `AUTH_SECRET="generate-with-openssl-rand-base64-32"` in
   `.env.example` is a placeholder and will flag. That is expected.
2. **Is it still valid?** A rotated key sitting in history is history, not an
   incident.
3. **What does it open?** Database, R2, Google — each has a different reach.

If it is real and live, **rotate it before anything else**. Once a secret has
been pushed, assume it is compromised; removing it from git does not un-leak it.

1. Rotate the credential at its source (Supabase, Cloudflare, Google)
2. Update `.env.local` and the Vercel environment variables
3. Confirm the application still works
4. Only then consider rewriting history

Rotating `AUTH_SECRET` signs every user out. That is expected, not a fault.

Rewriting history with `git filter-repo` or BFG changes every commit hash and
forces everyone to re-clone. On a shared branch this is disruptive, and rotation
is nearly always the better answer.

## Silencing false positives

The config is at `.git/gitleaks.toml` — inside `.git/`, not the repository
root. It therefore never appears in `git status` and cannot be committed by
accident. The trade is that it is local to this machine, like the hook.

```toml
[extend]
useDefault = true

[[allowlist.regexes]]
description = "Placeholder value in .env.example"
regex = '''generate-with-openssl-rand-base64-32'''
```

Allowlist a **specific value or path**, never a whole rule. Disabling a rule
hides the real findings it would have caught later.

The current config excludes `.next/`, `node_modules/` and `.git/` — generated
output, which produced seven false findings, all of them Next.js build keys that
are regenerated on every build.

`.env.local` is deliberately **not** excluded. It holds real secrets and the dir
scan flags two of them every time. That is the point: those two lines are the
proof the rules still fire on this machine. Silence them and a genuinely leaked
key looks identical to a clean run.

A caveat worth knowing, found by testing rather than assuming: gitleaks
allowlists well-known example credentials, so AWS's documented sample key
(`AKIAIOSFODNN7EXAMPLE`) passes straight through. A realistic key is caught
immediately. The tool has blind spots by design.

## Specific to this repository

`.env.local` is gitignored, so the live secrets should not be in history — the
scan confirms that rather than assuming it.

Check `scripts/seed-user.mjs` carefully. It briefly held a real email and
password as literals before they moved to the `SEED_PASSWORD` environment
variable. If any committed version still contains them, that is a genuine
finding and the password should be changed.

---

# 2. Semgrep — flaws in our own code

## What it finds

Semgrep reads the code and understands its structure, so it can follow a value
from where it enters to where it is used.

- **Cross-site scripting** — unescaped values reaching `dangerouslySetInnerHTML`
- **SQL injection** — queries built by joining strings instead of using parameters
- **Open redirects** — sending a user to an address taken from the request
- **Missing authorisation** — routes that change data without checking who is asking
- **Unsafe evaluation** — `eval`, `Function()`, unchecked parsing of untrusted input
- **Weak cryptography** — MD5 or SHA1 for passwords, `Math.random()` for anything security-related
- **React and Next.js pitfalls** — server-only values reaching the client bundle,
  unsafe `target="_blank"`

## What it does not find

Secrets in history, vulnerable dependencies, or whether security-critical code is
*correct*. It flags missing crypto, not crypto that is subtly wrong.

## Install

```bash
brew install semgrep
semgrep --version
```

## Run

Automatic ruleset selection — detects TypeScript, React and Next.js:

```bash
semgrep --config=auto .
```

Save a report:

```bash
semgrep --config=auto --json -o semgrep-report.json .
```

For GitHub's Security tab or a compliance platform:

```bash
semgrep --config=auto --sarif -o semgrep-report.sarif .
```

Specific rulesets rather than automatic:

```bash
semgrep --config=p/typescript --config=p/nextjs --config=p/owasp-top-ten .
```

Exit code `0` is clean, `1` means findings, `2` means the scan itself failed —
which is what makes it usable as a CI gate.

## Reading the output

Terminal output gives four things per finding:

```
  src/components/PromoSection.tsx
    ❯❱ typescript.react.security.audit.react-dangerouslysetinnerhtml
          Setting HTML from code is risky because it's easy to
          inadvertently expose users to a cross-site scripting attack.

          4702┆ dangerouslySetInnerHTML={{ __html: card.title }}
```

The rule id is the part worth noting — it names the language, framework,
category and specific check, and it is what goes into an allowlist.

In JSON, each result carries a `metadata` block with `cwe` and `owasp`
identifiers. Those map directly onto the ASVS chapters in the security testing
document, so findings translate into standards evidence without extra work.

Severities are `INFO`, `WARNING` and `ERROR`, each with a confidence rating.

## What to expect on this repository

Three things will almost certainly appear, and all three are probably fine:

- **`dangerouslySetInnerHTML`** — used throughout the promo card fields and
  template previews. Deliberate: the content is rich text the user authored in
  their own admin panel. Worth confirming nothing untrusted reaches it.
- **The `next` parameter on the login page** — read from the query string and
  used for the redirect after sign-in. That is the shape of an open redirect.
  Ours only redirects to same-origin paths, but this is hand-written and worth
  checking properly.
- **`process.env` reads** — flagged when a rule cannot tell server code from
  client. `AUTH_SECRET` is only read in `session.ts`, which never reaches the
  browser.

Expect more noise than gitleaks. Gitleaks either found a key or it did not;
Semgrep says "this pattern is sometimes dangerous", and most of the time ours
will not be. The value is in reading each one and allowlisting the deliberate
ones with a comment explaining why.

## Silencing false positives

Inline, on the line above:

```ts
// nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml
```

Always name the rule and add a comment saying why it is safe. A bare
`// nosemgrep` silences everything on that line, including future rules.

---

# 3. Dependencies — npm audit and Socket

## What they find

- Libraries with publicly known vulnerabilities, each with a CVE number and severity
- Libraries no longer maintained, and so no longer receiving fixes
- **Malicious packages** — code published deliberately to steal credentials or data

The last one is why `npm audit` alone is not enough. It checks against a database
of *reported* vulnerabilities, so it can only tell you about attacks somebody has
already found and filed. Socket analyses what a package actually does — install
scripts, network access, filesystem access, obfuscated code — and catches a
package compromised last week that nobody has reported yet.

## Run — npm audit

Built into npm, nothing to install:

```bash
npm audit
```

A summary you can work through:

```bash
npm audit --json > npm-audit.json
```

Production dependencies only — ignores build tooling:

```bash
npm audit --omit=dev
```

## Fixing

Safe. Patches within the version ranges already in `package.json`:

```bash
npm audit fix
```

**Not safe to run unattended.** Installs breaking major versions:

```bash
npm audit fix --force
```

On this repository `--force` would touch Drizzle, which owns the database layer,
and possibly Next itself. Do not run it and walk away.

## Recommended sequence

1. `npm audit fix`, then re-run `npm audit` and see what remains
2. Bump the direct dependencies deliberately, one at a time
3. Run `npx tsc --noEmit` after each
4. Test the affected area — for Drizzle, that means migrations and queries
5. Then the indirect ones, by updating whatever pulled them in

## Reading the results

The audit tells you severity but not **reach**, and that changes the priority.
`sharp` and `postcss` are build-time tools — they never ship to users. A
high-severity finding there is not the same risk as one in a package running in
production.

Check the `isDirect` field in the JSON output: direct dependencies are yours to
fix, indirect ones are fixed by updating their parent.

## Socket

Sign in with GitHub at socket.dev and install the app on the repository. It then
comments on pull requests that add or change dependencies. There is nothing to
run locally and nothing to remember — which is the point, since supply-chain
attacks arrive when somebody adds a package, not when somebody runs a scan.

---

# Running all three regularly

A one-off scan is a snapshot. The value is in them running every time:

- **gitleaks** as a pre-commit hook, so a secret never reaches a commit
- **Semgrep** in CI on every pull request
- **npm audit** in CI, and Socket on the repository for supply-chain alerts

Until that is set up, run all three before each release and keep the reports.
They are the evidence that turns "we test for security" into something a
customer can be shown.
