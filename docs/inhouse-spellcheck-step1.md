# In-house Spell-check — Step 1 (Detect & Underline)

**In short:** we built our own spell-checker that quietly underlines misspelled words as someone types. It's completely ours — no outside library, no browser tricks, and nothing sent over the internet. For now it *points out* mistakes; it doesn't yet suggest the correct word (that's a planned later step).

---

## Why we built it

We used to rely on an outside library (Harper) to check spelling. Keeping that *and* our own approach meant doing the same job twice, so we removed the outside library and kept one simple checker that we fully own.

The benefit is control: nothing outside our hands can break it, slow it down, change its behaviour, or disappear on us. It runs entirely inside the app.

---

## What it depends on — almost nothing

| Question | Answer |
|---|---|
| Any spell-check library? | **No** — nothing third-party. |
| The browser's built-in checker? | **No** — it's inconsistent and we can't control how it looks. |
| Internet or cloud? | **No** — it works fully offline. |
| Any AI? | **No** — it's a straightforward dictionary check. |

The only thing it needs is a list of correctly-spelled English words, which we ship inside the app ourselves.

---

## How it works, in plain terms

Think of it as a proofreader with a dictionary in hand:

1. As someone types and pauses, it takes what they've written.
2. It reads it one word at a time.
3. For each word it asks a simple question: *"Is this in my dictionary?"* It's sensible about the tricky cases — it understands contractions (*don't*), possessives (*John's*) and hyphenated words (*gift-wrap*), and it ignores numbers, very short words, and short all-caps abbreviations like *FAQ* or *CTA*.
4. Any word it doesn't recognise gets a red wavy underline — placed exactly under that word, without ever disturbing the text.

That's the whole loop: **type → pause → check against our word list → underline anything unknown.**

---

## A real example

Someone types **"Wintar Sale is live"** (misspelling *Winter*):

- **Wintar** isn't in the dictionary → it gets a red underline.
- **Sale**, **is**, **live** are all recognised → left alone.
- Numbers like *999* or *5%* are never touched.

Fix the spelling to "Winter" and the underline disappears.

---

## The dictionary — its "memory"

- It's a plain list of about **234,000 English words**, shipped inside the app.
- We built it from the standard English word list that comes with the computer, then **added the everyday words that older list tends to miss** — contractions (*don't*, *it's*), and modern and marketing words (*email*, *checkout*, *promo*, *whatsapp*, *loyalty*, *cashback*, *FAQ*…).
- It loads once, quietly, the first time an editor opens — so it's ready before the first keystroke.
- Because it's our own file that ships with the app, we don't depend on anyone else for it.

---

## Where it's active

The same checker powers every text field it's needed in:

- **Announcement editor** — the message field.
- **Promo Card editor** — Title, Subtitle, Description, and Button text.

---

## The personal dictionary

If someone marks a word as correct — a brand name, a product name — it's remembered on their device and never flagged again. This lets each person quietly silence the odd false alarm for good.

---

## What it deliberately doesn't do (yet)

- **No suggestions.** It underlines the mistake but doesn't yet offer the right word, so clicking an underlined word does nothing on purpose. Offering corrections is the planned **Step 2**.
- **No grammar or punctuation checks** — spelling only.
- **English only.**

---

## Honest limitations

- **The occasional false alarm.** Now and then it may underline a valid but unusual or very new word. Two easy fixes: add the word to the shipped list, or let the user add it to their personal dictionary.
- **File size.** The word list is about 2.4 MB. That's fine today — it loads once — and can be trimmed later if we ever want it lighter.

---

## If we add suggestions later (Step 2)

We'd take the misspelled word, find the closest real words in our own list, and show them when someone clicks the underline. The little suggestions menu is already built — it will simply start appearing once we have corrections to offer. No third party needed for that either.

---

<details>
<summary><strong>Under the hood (for developers)</strong></summary>

| File | Role |
|---|---|
| `public/dictionaries/en.txt` | The bundled word list (~234k lowercase words: system `web2` list + our supplement). |
| `src/lib/spellcheck/localSpellcheck.ts` | Loads the list once, scans the text, returns the flagged words. |
| `src/lib/spellcheck/engine.ts` | The personal dictionary (kept in `localStorage`). |
| `src/lib/spellcheck/types.ts` | Shared `Issue` / `Suggestion` types. |
| `src/hooks/useSpellCheck.ts` | Waits ~400 ms after typing, runs the check, hands results to the UI. |
| `src/components/SpellCheckOverlay.tsx` | Draws the underline; shows no popup when there are no suggestions. |

Each flagged word is returned as an `Issue` with its exact character position, `kind: 'Spelling'`, and an empty `suggestions` list (Step 1 has no suggestions). If a load ever fails, the check silently returns nothing and the editor keeps working. Suggestions would be added by filling that `suggestions` list using edit-distance matching (e.g. Levenshtein / SymSpell) against the same word list.

</details>
