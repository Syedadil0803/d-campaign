# Spell-check & Autocorrect — Technical Research

**Context:** our editor's proofreading is powered by the `harper.js` library (v2.4.0). This note explains what that is, how it works, whether we can bring it in-house, and whether a lighter "highlight-only" checker is possible with **no third party at all**.

---

## 1. What we're actually using: Harper

Harper is an **offline, privacy-first English grammar-and-spelling checker**. It's open source (**Apache-2.0**), built by **Automattic** (the WordPress company) and originally authored by Elijah Potter. The engine is written in **Rust** and compiled to **WebAssembly (WASM)**, so it runs straight in the browser — no server, no API calls, no telemetry, no account.

The npm package we install, **`harper.js`**, is simply the JavaScript/TypeScript wrapper around that WASM engine.

For reference, the wider Harper toolkit:

| Package | Role |
|---|---|
| `harper-core` | The Rust linting engine (rules + dictionary) |
| `harper-wasm` | The core compiled to WebAssembly |
| **`harper.js`** | **The JS/TS package we use** |
| `harper-ls` | Language server (VS Code, Neovim, Obsidian…) |
| `harper-cli` | Command-line checker |
| `harper-dictionary-wordlist`, `harper-thesaurus` | Word list + synonyms |

---

## 2. How it works

Two ideas do the heavy lifting — and, importantly, **neither uses AI**:

- **Dictionary lookup** for spelling: a word that isn't in the dictionary (and isn't in your personal list) gets flagged.
- **Hand-written rules** for grammar and word choice: a curated set of patterns ("its" vs "it's", doubled words, spacing, etc.).

Because it's *rules + a word list* rather than a machine-learning model, it's tiny and extremely fast — roughly **~10 ms** to check a document, using **less than 1/50th of LanguageTool's memory**. The trade-off: it's **English-only** and won't catch the subtle, context-heavy mistakes a large language model would.

In the browser, `harper.js` gives two ways to run the engine:

- **`LocalLinter`** — runs the WASM on the main thread. Simple, but can briefly block the UI while the (~17 MB) binary warms up.
- **`WorkerLinter`** — runs the WASM inside a **Web Worker** so the UI never stutters. Recommended for interactive apps.

### How our app uses it today — a real example ("Wintar")

Say a user is editing an announcement and types **"Wintar Sale is live"** — misspelling *Winter* as **Wintar**. Here is what happens, step by step:

1. **The user types "Wintar".** The text sits in a `contentEditable` field. Each keystroke fires an `input` event that the application's `useSpellCheck` hook is listening for.
2. **The application waits ~400 ms (debounce).** It doesn't check on every letter — it waits until the user pauses typing, then runs once. (The Harper engine is pre-warmed when the editor opens, so it's ready before the first keystroke.)
3. **The application sends the text to the Harper library.** It takes the field's plain text — `"Wintar Sale is live"` — and calls `proofread(text)`, which calls Harper's `lint(text)` on the on-device WASM engine (`src/lib/spellcheck/harper.ts`). Each run is tagged with an id, so a slow result from an older keystroke can't overwrite a newer one.
4. **The Harper library flags "Wintar".** It can't find *Wintar* in its dictionary, so it returns one issue: `span` = the characters covering **"Wintar"**, `lint_kind` = `Spelling`, and `suggestions` = `["Winter", "Winter's", …]`. The application ignores it if the user has added "Wintar" to their **personal dictionary** (they haven't), and also silences two rules that are just noise for marketing copy (`SentenceCapitalization`, `LongSentences`).
5. **The application draws a red underline under "Wintar".** The issue is handed to the `SpellCheckOverlay`, which paints a squiggle exactly under those characters — **without ever touching the editor's own text.** *(This is "Step 1 — detect + underline" from §6.)*
6. **The user clicks "Wintar" → sees "Winter".** Clicking the underlined word shows Harper's suggestions; the user picks **Winter**, and the application replaces the word. *(This is "Step 2 — suggest.")*
7. **If the Harper library fails to load, nothing breaks.** The user simply sees no underline and keeps editing normally (see §3).

**In one line:** *the user types "Wintar" → the application pauses, then asks the Harper library → Harper flags it as misspelled → the application underlines it → the user clicks and picks "Winter".*

The API surface behind this flow: `setup()`, `lint()`, `lintConfig` (enable/disable rules), `applySuggestion()`, `ignoreLint()`, and `importWords()` / `exportWords()` for the personal dictionary.

---

## 3. How it runs inside your app — and what happens if it fails?

A fair worry: *if `harper.js` "stops," does my whole application break?* **No — not if the failure is handled in code.** Here is exactly what's going on.

**It's a library, not a service.** `harper.js` is code that runs *inside* your own browser/Node process — the same process as the rest of the app. It is **not** a separate server or background daemon that can "go down" on its own. There's no network call and no external process to lose a connection to, so it cannot randomly crash while sitting idle.

**Failures are function-level, not app-level.** If something does go wrong, it happens *during a specific call* — usually `lint(text)` choking on some unusual or corrupted input — and it surfaces as an error thrown from that one function, not a collapse of the whole app. The engine doesn't "stop running" in the background; it simply throws on that call and hands control back to your code.

**So protecting the app is straightforward:** wrap the proofreading call in a `try / catch` (and, in React, put an error boundary around the editor as a backstop). If a lint call ever throws, you catch it, skip the squiggles for that pass, and the editor keeps working exactly as before — the user just doesn't see suggestions for that moment. In short, **proofreading degrades quietly instead of taking the page down.**

**One real cost to plan for** is the ~17 MB WASM binary that loads on first use. That's a *load-time* consideration — lazy-load it (ideally in a Web Worker via `WorkerLinter`) so it never blocks the first paint — not a stability risk. Once loaded, every check is local and fast.

## 4. Can we replicate it internally?

Two honest points:

1. **There is nothing external to "remove."** Harper already runs **100% on-device** — no cloud, no API keys, no per-call cost — and it's Apache-2.0 licensed, so we're free to keep, vendor, or fork it. In that sense the engine is *already* internal to our app.
2. **Rebuilding the engine from scratch is a large job.** Harper is a mature Rust project: a big curated dictionary plus hundreds of grammar rules tuned over years. Matching that quality would be a multi-month build with ongoing maintenance — not worth it purely to avoid a dependency that is already free and offline.

**Verdict:** keep Harper for grammar. The only compelling reasons to build our own would be to (a) shed the ~17 MB WASM binary, or (b) fully own the rule set. If that day comes, a **spelling-only** engine (below) is the realistic scope.

---

## 5. Feasibility: highlight-only spelling, no third party

**Yes — this is very doable, and it does not need the browser's built-in checker.** We are deliberately *not* using the native `spellcheck` attribute: its behaviour is inconsistent across browsers, we can't read or restyle its red squiggles, and it isn't stable or controllable enough to build a real feature on.

The route is an **in-house dictionary + our own overlay**: ship an English word list (~50–100k common words, a few hundred KB gzipped), tokenize the text, and flag any token that isn't in the list or the personal dictionary. We already have the `SpellCheckOverlay` component that draws the underline, so the highlighting is entirely ours — **no external service, no browser dependency, no network, no LLM.**

What an in-house build **won't** easily give us is real grammar and word-choice checking — that is precisely Harper's value. The split:

| Need | Best route |
|---|---|
| Underline misspellings, our own UI + personal dictionary | In-house word list + overlay |
| Suggestions ("did you mean…") | In-house edit-distance, or keep Harper |
| Grammar, word choice, contextual fixes | Keep Harper |

## 6. Contingency: what if Harper is discontinued?

**First, the impact is smaller than it sounds.** Harper is Apache-2.0 and runs entirely on-device — we ship a copy of the WASM binary with the app. If the project were abandoned tomorrow, the version we've bundled keeps working exactly as it does today; nothing "switches off." The only thing we'd lose is *future updates* (new rules, bug fixes). So this is a "plan the migration calmly" situation, not an emergency.

**Our options, in order of effort:**

1. **Freeze the current version (near-zero effort — _not done yet_).** Today `harper.js` is declared as a caret range (`^2.4.0`), so it is **not** pinned — a fresh install could pull a newer 2.x. "Freezing" means pinning it to an exact version and vendoring the package (or at least its WASM binary) into the repo, so the exact copy we ship keeps working indefinitely regardless of what happens upstream. It's a small change, but it is a step we would still need to take.
2. **Fork it (low–moderate effort).** The source is open, so we can maintain our own fork if we ever need a fix. Realistic only if we have Rust capacity.
3. **Build our own (scoped effort).** Replace it with an in-house checker — and here the pipeline splits into two jobs that are **not** equally hard.

**The proofreading pipeline is two separate steps:**

| Step | What it does | Build-it-ourselves difficulty |
|---|---|---|
| **1. Detect + underline** | Find the misspelled word and draw the red line under it | **Easy** |
| **2. Suggest** | Offer the correct word(s) underneath it | **Harder** |

- **Step 1 (the red underline)** is a dictionary lookup: tokenize the text, and any word not in our word list (or the personal dictionary) gets flagged and underlined via our existing `SpellCheckOverlay`. A good English word list is a few hundred KB. This is a small, self-contained build — no third party, and (per our decision) **not** the browser's native checker.
- **Step 2 (the suggestions)** is the expensive part: given a misspelling, rank the most likely corrections. That needs edit-distance / phonetic matching (Levenshtein, a BK-tree, or SymSpell) plus frequency ranking to feel good. Doable, but this is where most of the effort lives.

**If we ever choose to build a backup, Step 1 is the cheaper place to start.** Building the detect-and-underline step in-house is inexpensive, gives us the visible "red squiggle" safety net with zero dependency, and covers the most important job — *telling the user a word is wrong*. Step 2 (suggestions) could stay on Harper, with our own suggestion engine added later only if we decided to fully cut over.

**In short:** there's no forced decision here. Harper is stable and low-risk today, and even if it were abandoned, freezing the current version keeps everything working. Whenever the team *does* want to reduce reliance on a third party, the natural first move — because it's the easy half — is the in-house Step 1 (word list + overlay), with Step 2 handled separately on our own timeline. That's an option to weigh, not a commitment.

---

*Sources: Harper by Automattic — [writewithharper.com](https://writewithharper.com/), [github.com/Automattic/harper](https://github.com/Automattic/harper), and Harper's [COMPARISON.md](https://github.com/Automattic/harper/blob/master/COMPARISON.md).*
