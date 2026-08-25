# OWASP ASVS Level 2 — Self-Assessment

Campaign Admin Tool · 25 August 2026

## What this is

An assessment of the Campaign Admin Tool against the OWASP Application Security
Verification Standard, Level 2 — the level intended for an application handling
business data.

It is **self-assessed**. There is no certificate for ASVS; the value is a
documented, honest statement of which requirements are met, which are not, and
what would be needed to close the gap. It is also the cheapest way to find the
class of problem no scanner reports: logic that works exactly as written but not
as intended.

Verdicts used below:

| | |
|---|---|
| **Met** | The requirement is satisfied and was checked in the code |
| **Partial** | Satisfied in part, or by something other than the intended mechanism |
| **Not met** | The requirement is not satisfied |
| **Decision needed** | Cannot be met without a product decision, not just code |
| **N/A** | Does not apply to this application |

---

## Summary

| Chapter | Verdict |
|---|---|
| V1 Architecture | Partial |
| V2 Authentication | Partial — changes with Google sign-in |
| V3 Session Management | **Not met** — sessions cannot be revoked |
| V4 Access Control | **Not met** — saved variants are shared across accounts |
| V5 Validation and Encoding | Partial — needs verification at the widget end |
| V6 Stored Cryptography | Met |
| V7 Error Handling and Logging | Partial |
| V8 Data Protection | Partial |
| V9 Communications | Met |
| V10 Malicious Code | Partial |
| V11 Business Logic | **Not met** — no rate limiting |
| V12 Files and Resources | N/A |
| V13 API | Partial |
| V14 Configuration | **Not met** — no security headers |

Three findings need a product decision rather than a fix: session revocation,
variant scoping, and rate limiting on sign-in.

---

## V1 — Architecture

**Verdict: Partial**

The application is a single Next.js service with a Postgres database and a
Cloudflare R2 bucket holding the published configuration. Authentication is
about to move to Google sign-in.

There is no written threat model and no data-flow diagram. For Level 2 those are
expected as documentation rather than code.

**To close:** a one-page data flow — browser, application, database, R2, and the
customer's website — showing where personal data and credentials travel.

---

## V2 — Authentication

**Verdict: Partial. Changes substantially with Google sign-in.**

**Met**

- Passwords are hashed with scrypt and a per-user salt. No plaintext, no
  reversible encryption, no unsalted digest.
- Failed sign-in returns one message for both "no such account" and "wrong
  password", so the form cannot be used to discover which addresses have accounts.
- Credentials are only ever sent over HTTPS.

**Not met**

- **No rate limiting or lockout.** Passwords can be tried indefinitely. This is
  the most significant authentication gap today.
- No multi-factor authentication. Level 2 expects it to be available.

**Changing**

The live product will use Google sign-in only, and the seeded email and password
account will be removed. That removes password storage, password reset, and
credential stuffing from our responsibility entirely — Google carries them.

**What to verify once that lands**

- The redirect target after sign-in is validated, so the flow cannot be used to
  send a user to another site
- Tokens returned by Google are stored and handled correctly
- Rules exist for the same address arriving by more than one route

---

## V3 — Session Management

**Verdict: Not met. Decision needed.**

**Met**

- The session cookie is `HttpOnly`, so no script on the page can read it,
  including anything injected.
- `SameSite=Lax`, which blocks the common cross-site request forgery routes.
- `Secure` in production.
- The session token is signed with HMAC-SHA256 and carries an expiry. It is
  deliberately not a JWT: it has no algorithm header, so it cannot be persuaded
  to verify itself differently.
- Expiry is enforced on every request.

**Not met**

Sessions are stateless. There is no server-side record of active sessions, which
means:

- Signing out clears the cookie in that browser, but the token stays valid until
  it expires
- There is no way to sign an account out of all devices
- The only global revocation is rotating `AUTH_SECRET`, which signs out everyone

ASVS Level 2 expects session termination to be effective on the server.

**Decision needed:** add a sessions table so tokens can be revoked, or record
this as a known limitation and claim Level 1 for this control only.

The tradeoff is real. Statelessness is what allows the guard to run in
middleware, at the edge, without a database connection on every navigation.
A sessions table costs a lookup per request.

---

## V4 — Access Control

**Verdict: Not met.**

**Met**

- Every route reads the account id from the signed session cookie, never from
  anything the client sends. A user id in a request body is a suggestion; a
  signed cookie is a claim the server made itself.
- Drafts are keyed per account (`draft:<userId>`), so one account cannot read or
  overwrite another's draft.
- The device presence table is keyed on `(user_id, device_id)` and every query
  filters on the account from the session.

**Not met**

- **Saved variants ("My Published") are not scoped to an account.** They are
  stored in a single `variants` column on the shared configuration row. With one
  account this is invisible. The moment Google sign-in allows a second user,
  every user sees and can overwrite every other user's saved cards.
- **Two API routes have no authorisation check of their own.** `/api/config` and
  `/api/variants` rely entirely on the middleware guard. That guard is correct
  today, but a change to its path matcher would expose them silently, with
  nothing in the route itself to prevent it.

**To close:** key variants by account, as drafts already are. Add a session check
inside both routes as well as in middleware — defence in depth, so neither
mechanism is the only thing standing.

---

## V5 — Validation, Sanitisation and Encoding

**Verdict: Partial. One item needs verification outside this codebase.**

**Met**

- All database access goes through Drizzle. The one raw SQL statement uses
  parameter binding rather than string concatenation.
- No `eval`, no `Function()` constructor, no dynamic code execution.

**Needs verification**

`dangerouslySetInnerHTML` is used throughout the promo card editor and template
previews. Within the admin panel this is deliberate: the content is rich text the
author wrote themselves, rendered back to them.

The risk is not in the panel. The published card is written to R2 and rendered on
the **customer's own website** by the widget. If the widget does not escape that
content, whoever edits a card can place script on that site. A scanner cannot
follow a value from this repository, through R2, into a different codebase.

**To close:** confirm how the widget renders card content. This is the single
highest-value check in this assessment.

---

## V6 — Stored Cryptography

**Verdict: Met.**

- scrypt with a per-user random salt for passwords, from Node's standard library
- HMAC-SHA256 for session signing, via Web Crypto
- Session verification uses `crypto.subtle.verify` rather than string comparison,
  so a forged signature cannot be found one character at a time
- Password comparison is length-checked then constant-time
- No secrets in source. `AUTH_SECRET` is read from the environment, lazily, so a
  missing value fails a request rather than the build

**Note:** the session payload is signed, not encrypted. Anyone holding the cookie
can decode it and read the account id and expiry. Nothing sensitive is in there,
which is why that is acceptable — but it must stay that way.

---

## V7 — Error Handling and Logging

**Verdict: Partial.**

**Met**

- Errors return generic messages. Sign-in failures do not reveal which half was
  wrong.
- No stack traces reach the client.
- No credentials or tokens are written to logs.

**Not met**

- No audit log. There is no record of who signed in, when, from where, or what
  they published. Level 2 expects security-relevant events to be logged.
- Logging is `console.log` and `console.error` only, with no structure, retention
  or alerting.

**To close:** log authentication events and publishes with an account id and a
timestamp, in a form that can be searched later.

---

## V8 — Data Protection

**Verdict: Partial.**

**Met**

- Personal data is limited to an email address, a generated device identifier, a
  browser and operating system label, and timestamps.
- Unsaved work is never transmitted. It stays in the browser that created it; the
  server records only that it exists, on which device, and when.
- Device records are deleted as soon as the work is saved or discarded, and
  claims older than fourteen days are ignored.
- No card content is uploaded until the user deliberately saves or publishes it.

**Not met**

- No documented retention period for account data
- No route for a user to request deletion of their account and its data

Both are UK GDPR obligations rather than ASVS requirements alone.

---

## V9 — Communications

**Verdict: Met.**

- HTTPS everywhere, terminated by Vercel; HTTP is redirected
- The database connection uses TLS
- R2 is reached over HTTPS with signed credentials

---

## V10 — Malicious Code

**Verdict: Partial.**

**Met**

- No dynamic code execution
- Dependencies come from npm with a committed lockfile, so builds are reproducible

**Not met**

- **12 known vulnerabilities in dependencies** at the time of writing: 7 high,
  5 moderate. Four are direct dependencies — `next`, `postcss`, `drizzle-orm`
  and `drizzle-kit`.
- No supply-chain monitoring. `npm audit` reports only vulnerabilities somebody
  has already found and filed; it cannot detect a package compromised last week.

**To close:** `npm audit fix`, then bump the direct dependencies deliberately.
Add Socket to the repository for supply-chain alerts.

---

## V11 — Business Logic

**Verdict: Not met.**

**Not met**

- **No rate limiting anywhere.** Not on sign-in, not on publishing, not on any
  API route. Sign-in is the one that matters: passwords can be tried without
  limit. Google sign-in largely removes this, but the seeded account exists today.
- No anti-automation controls on any endpoint

**Worth testing by hand, because no tool will**

- Can the publish flow be driven repeatedly to flood R2?
- Can a card be published while the account has no live campaign, or in a state
  the interface does not allow?
- Can the presence endpoint be used to write a claim naming an arbitrary device?

**To close:** rate limiting on the authentication routes at minimum.

---

## V12 — Files and Resources

**Verdict: N/A.** The application accepts no file uploads and serves no
user-supplied files.

---

## V13 — API

**Verdict: Partial.**

**Met**

- All routes require a signed session, enforced by middleware
- Request bodies are validated for shape before use; malformed input returns 400
- No sensitive data in URLs or query strings, except the device identifier on the
  presence route, which is not sensitive

**Not met**

- No rate limiting (see V11)
- No API schema. An OpenAPI specification would make the routes testable and
  reviewable, and is needed before dynamic scanning can cover them properly.

---

## V14 — Configuration

**Verdict: Not met.**

**Met**

- Secrets are in environment variables, never in source
- `.env.local` is gitignored
- Production and development configuration are separate
- Dependencies are pinned by lockfile

**Not met**

- **No security headers at all.** `next.config.ts` sets none. Level 2 expects
  Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy and Strict-Transport-Security.

This is the cheapest finding in the entire assessment to fix — a headers block in
`next.config.ts` — and one of the most visible, since anyone can check it from
outside with a browser.

---

## Priority

In the order I would take them:

1. **Security headers** — smallest change, externally visible, V14
2. **Dependency vulnerabilities** — 12 known, four direct, V10
3. **Scope variants per account** — silently wrong the day a second user exists, V4
4. **Verify the widget escapes card content** — highest potential impact, V5
5. **Rate limiting on sign-in** — V11
6. **Session revocation** — needs a decision, V3
7. **Audit logging** — V7
8. **Retention and deletion** — V8 and UK GDPR

## What this assessment does not cover

It is a reading of the code, not an attack on the running system. It cannot tell
you whether a chain of individually reasonable steps produces an unreasonable
result — that is what a penetration test is for, and this document is what makes
that engagement worth paying for.
