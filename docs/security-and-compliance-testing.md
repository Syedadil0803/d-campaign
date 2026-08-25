# Security Testing — Tools, Standards, Evidence

Campaign Admin Tool · 21 August 2026

---

## 1. The distinction

A **tool** produces evidence. A **standard** is what evidence is measured
against. A **certificate** is a third party confirming the measurement.

A scanner report alone proves nothing to a customer. The same report mapped to a
named standard is what a procurement team accepts.

---

## 2. Standards

### OWASP ASVS — Application Security Verification Standard

The benchmark for web applications. Three levels; Level 2 is the normal target
for an application handling business data. Free, self-assessed, published by
OWASP. Chapters used below: V2 authentication, V3 session management,
V5 validation, V6 cryptography, V7 error handling, V14 configuration.

### Cyber Essentials — UK

UK government scheme, administered by IASME. Five control areas: firewalls,
secure configuration, user access control, malware protection, security update
management. Self-assessed questionnaire with independent verification.
Cyber Essentials Plus adds hands-on technical audit.

Required for many UK public sector contracts.

### ISO/IEC 27001

Certifies the organisation's information security management system, not the
product. Requires an accredited certification body.

### SOC 2 Type II

US-origin attestation covering security controls over a period. Requires a CPA
firm. Increasingly requested in UK and EU B2B.

### UK GDPR / EU GDPR

We process personal data (section 5). Obligations: lawful basis, record of
processing, retention period, subject access and deletion.

### EU Cyber Resilience Act

Applies to products with digital elements. Introduces CE marking for software,
SBOM obligations, vulnerability handling and update duties. Entered into force
2024; obligations phase in. **Dates require verification against official EU
sources.**

### European Accessibility Act / EN 301 549

References WCAG 2.1 AA. Our promo cards render on consumer-facing sites.
**Scope for this product requires confirmation.**

### EU AI Act

The product includes an "Improve with AI" feature. Transparency obligations
apply to systems interacting with users. **Current obligations require
verification.**

---

## 3. UK and EU differ

| | UK | EU |
|---|---|---|
| Data protection | UK GDPR, Data Protection Act 2018, ICO | EU GDPR, national regulators |
| Product marking | UKCA | CE — extending to software under the CRA |
| Common credential | Cyber Essentials | ISO 27001 |

---

## 4. Tools

Each tool takes a different input. A static analyser cannot test a running site;
a dynamic scanner cannot read source code.

### Semgrep — static analysis

- **Input:** the repository. No credentials, no running application.
- **Output:** SARIF (OASIS standard). Read by GitHub Security, Azure DevOps, GRC platforms.
- **Detects:** unsafe HTML injection, string-concatenated SQL, hardcoded secrets, unvalidated redirects.
- **ASVS:** V5, V7.

```bash
semgrep --config=auto --sarif -o semgrep.sarif .
```

### gitleaks — secret detection

- **Input:** full git history, not the working tree.
- **Output:** JSON or SARIF.
- **Detects:** committed keys, tokens, connection strings. A secret removed in a later commit remains in history.
- **ASVS:** V6.

```bash
gitleaks detect --source . --report-format sarif --report-path gitleaks.sarif
```

### Syft — software bill of materials

- **Input:** the repository or built artifact.
- **Output:** CycloneDX (OWASP) or SPDX (ISO/IEC 5962).
- **Required by:** EU Cyber Resilience Act.

```bash
syft dir:. -o cyclonedx-json=sbom.json
```

### Socket.dev or Snyk — dependency analysis

- **Input:** `package.json`, `package-lock.json`.
- **Output:** CVE identifiers with CVSS severity.
- **Detects:** vulnerable libraries. Socket additionally detects malicious packages; `npm audit` does not.
- **ASVS:** V14.

### OWASP ZAP — dynamic analysis

- **Input:** deployed URL, test credentials, optionally an OpenAPI specification.
- **Output:** findings mapped to CWE identifiers; SARIF export.
- **Detects:** session handling flaws, missing security headers, authorisation gaps.
- **ASVS:** V2, V3.

```bash
zap-baseline.py -t https://<staging-url> -r zap-report.html
```

### Penetration test — a person, not a tool

- **Provider:** CREST-accredited firm (UK recognised scheme).
- **Input:** scoped environment and credentials.
- **Output:** signed report.
- **Accepted by:** ISO 27001, SOC 2, enterprise procurement.

---

## 5. This product

### Authentication

Production will use **Google sign-in only**. The email and password login in the
codebase is for development and will be removed. No passwords will be stored.

Requires review when that work lands:

- OAuth redirect target validation
- Storage and handling of tokens returned by Google
- Account linking, if one address can arrive by more than one route

### Sessions cannot be revoked

The session is a signed cookie containing an account identifier and expiry.
There is no server-side session store.

- Signing out clears the browser cookie; the token remains valid until expiry
- "Sign out of all devices" is not possible
- Rotating `AUTH_SECRET` invalidates every session at once

ASVS V3 expects server-side session termination. **Decision required:** add a
sessions table, or document the limitation and claim Level 1 for that control.

### Unsaved work is not transmitted

Work not saved as a draft remains in the browser that created it. The server
stores only that unsaved work exists, on which device, and when.

### Personal data held

| Data | Table | Purpose |
|---|---|---|
| Email address | `campaign.users` | Account identity |
| Generated device identifier | `campaign.user_device_presence` | Distinguishing devices |
| Browser and OS label | `campaign.user_device_presence` | Naming the device holding unsaved work |
| Timestamp | `campaign.user_device_presence` | Age of that work |

Device records are deleted when work is saved or discarded. Claims older than
fourteen days are ignored on read.

**Outstanding:** documented retention period; deletion route for account data.

---

## 6. Sequence

1. gitleaks over full history
2. Semgrep in CI
3. Syft — SBOM
4. Socket or Snyk in CI
5. ZAP against staging
6. ASVS Level 2 self-assessment
7. Cyber Essentials
8. Penetration test
9. ISO 27001

Steps 1–6 carry no fee. Step 7 is the first that produces a certificate.

---

## 7. Limits

Automated tools detect known patterns. They do not detect flawed business logic,
and they do not confirm that security-critical code is correct — only that
recognised mistakes are absent. Steps 6 and 8 involve people reading code.

Regulatory dates in section 2 marked for verification were phasing in at the
time of writing.
