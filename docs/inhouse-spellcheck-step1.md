# In-house Spell-check — Step 1 (Detect + Underline)

**Status:** live and the only spell-check engine in the app. Harper (`harper.js`) has been removed. This document describes exactly what we built, how it works, and what it does and doesn't do.

---

## 1. What this is (in one line)

A **dictionary-based spelling detector** that finds misspelled words and draws a red underline under them — written entirely in-house, with **no third-party library, no browser-native checker, and no network** beyond fetching our own word-list file.

It is **detection only**. It tells the user *a word is wrong* (Step 1). It does **not** suggest corrections (that is Step 2, not built).

---

## 2. Dependencies — what we rely on

| Concern | What we use |
|---|---|
| Spell-check library | **None.** No `harper.js`, no npm spell-check package. |
| Browser's native `spellcheck` | **Not used** (inconsistent across browsers, can't read/style it). |
| Network / cloud | **None.** The one fetch is our own static file in `public/`. |
| AI / LLM | **None.** Pure dictionary lookup. |

The only "data dependency" is a word list we generate and ship ourselves (below).

---

## 3. The pieces (files)

| File | Role |
|---|---|
| `public/dictionaries/en.txt` | The bundled English word list (the dictionary). |
| `src/lib/spellcheck/localSpellcheck.ts` | The detector — loads the dictionary, tokenizes text, flags unknown words. |
| `src/lib/spellcheck/engine.ts` | The **personal dictionary** (user-added words, stored in `localStorage`). |
| `src/lib/spellcheck/types.ts` | Shared `Issue` / `Suggestion` types + `isSpellingKind`. |
| `src/hooks/useSpellCheck.ts` | Debounces input, runs the detector, returns issues to the UI. |
| `src/components/SpellCheckOverlay.tsx` | Draws the red underline; no popup when there are no suggestions. |

---

## 4. The dictionary

- **File:** `public/dictionaries/en.txt` — one lowercase word per line, ~**234,000 words**, ~2.4 MB.
- **Source:** the classic Unix English word list (`/usr/share/dict/words`, the "web2" list) — lowercased and de-duplicated — **plus a supplement** we added for words that old list misses: common **contractions** (`don't`, `it's`, `you're`…), **possessive/marketing/modern** terms (`email`, `checkout`, `whatsapp`, `promo`, `loyalty`, `cashback`, `faq`…), and a few region-common words (`encash`, `upto`).
- **Loaded lazily and once:** on first use we `fetch('/dictionaries/en.txt')`, split it into lines, and build a `Set<string>` for O(1) lookups. The set is cached for the rest of the session (and pre-warmed when an editor mounts, so it's ready before the first keystroke).

> Because it's a static file we own, there's no runtime dependency on anyone else — the dictionary ships with the app.

---

## 5. How detection works (the algorithm)

For a given piece of text, `proofreadLocal(text)` does this:

1. **Tokenize into words**, capturing each word's character offset. The regex keeps internal apostrophes and hyphens together so `don't`, `o'clock`, and `e-commerce` stay whole:
   ```
   /[A-Za-z]+(?:['’-][A-Za-z]+)*/g
   ```
   Because it only matches letters, **numbers and symbols are never flagged** (`999`, `5%`, `24/7` are ignored).

2. **For each word, decide if it's "known":**
   - Normalize it (lowercase; curly `’` → straight `'`).
   - It's known if it's **in the dictionary**, OR
   - it's a **possessive** whose base is known (`john's` → `john`), OR
   - it's a **hyphenated compound** whose every part is known (`gift-wrap` → `gift` + `wrap`).

3. **Skip things that shouldn't be flagged:**
   - words shorter than **3 letters**,
   - short **all-caps acronyms** (≤ 4 chars like `FAQ`, `USD`, `CTA`),
   - words in the user's **personal dictionary**.

4. **Everything left is a misspelling.** We emit an `Issue` for it:
   ```ts
   {
     start, end,               // exact character span of the word
     kind: 'Spelling',
     problem: <the word>,      // used to re-locate it as the user edits
     message: '“word” may be misspelled',
     suggestions: [],          // Step 1 → always empty
   }
   ```

That `Issue` shape is the same contract the overlay already understood, which is why detection dropped straight in.

---

## 6. The journey of one keystroke (real example: "Wintar")

A user editing an announcement types **"Wintar Sale is live"** (misspelling *Winter*):

1. **The user types.** The text is in a `contentEditable`; each keystroke fires an `input` event that `useSpellCheck` listens for.
2. **Debounce ~400 ms.** The hook waits until the user pauses, then runs once (not on every letter).
3. **The application runs the in-house detector.** It reads the field's text and calls `proofreadLocal("Wintar Sale is live")`. A run-id guards against an older, slower run overwriting a newer one.
4. **The detector flags "Wintar".** `wintar` isn't in the dictionary → one `Issue` at characters 0–6, `kind: 'Spelling'`, `suggestions: []`. `Sale`, `is`, `live` are all known → ignored.
5. **The overlay underlines it.** `SpellCheckOverlay` paints a red squiggle exactly under "Wintar" — without ever touching the editor's own text.
6. **Clicking does nothing.** Because the issue has no suggestions, the overlay opens **no popup** — the word is simply underlined.
7. **If the dictionary fails to load, nothing breaks.** No underlines appear and the editor keeps working normally.

**In one line:** *user types → app pauses → in-house detector checks against our word list → misspelled word gets a red underline. That's it.*

---

## 7. Where it runs

The same shared hook powers every editor, so detection is active in:

- **Announcement editor** — the rich message field.
- **Promo Card editor** — Title, Subtitle, Description, and Button text.

One hook, five fields — no per-field wiring.

---

## 8. The personal dictionary

Words the user marks as correct (brand names, product names) are stored in `localStorage` (`campaign-spellcheck-dictionary`) via `engine.ts`. `proofreadLocal` skips any word found there, so a user can silence false positives permanently on their machine.

---

## 9. What it does NOT do (by design)

- **No suggestions** ("did you mean Winter?") — that's **Step 2**. Clicking an underlined word intentionally shows nothing.
- **No grammar / word-choice / punctuation checks** — spelling only.
- **English only.**

---

## 10. Known limitations & how to fix them

- **Occasional false positives.** The base word list is comprehensive but old; a valid-but-uncommon or very new word may get underlined. Fix: add it to the **supplement** in `public/dictionaries/en.txt`, or the user adds it to their **personal dictionary**.
- **Some inflections may be missed** (rare plural/verb forms not in the list). Same fix as above.
- **Asset size (~2.4 MB).** Fine for now (fetched once, lazily). If we want it lighter later: trim rare entries, or serve it gzipped/compressed.

---

## 11. If we later want suggestions (Step 2)

Fill the currently-empty `suggestions` array: take the misspelled word, find the closest dictionary words by **edit distance** (Levenshtein / a BK-tree / SymSpell), rank by similarity (and optionally word frequency), and return the top few. The overlay's click-popup already renders a suggestions list and will light up automatically once the array is non-empty — no overlay changes needed.
