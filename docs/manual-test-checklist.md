# Manual test checklist

One section per commit, newest last. Every commit is separate on purpose: if a
section fails, revert that one commit and the rest still stand.

Nothing here is pushed. `git log --oneline origin/quality/code-quality-baseline..HEAD`
lists what is waiting.

---

## 6f8bde6 — Lift the skeleton ghosts out of the canvas *(pushed)*

On a fresh or cleared card:

- [ ] Blank canvas shows the dashed **countdown** outline and dashed **button** outline
- [ ] With no end date, the countdown outline reads "set an end date to switch it on"
- [ ] With an end date but the timer switched off by hand, it reads "turn on Countdown Timer Display"
- [ ] Turning the countdown on replaces its outline with the real countdown; the button outline stays
- [ ] Turning the CTA on does the same for the button
- [ ] Both outlines are inert — clicking them does nothing and switches nothing on
- [ ] Changing the card's text colour re-tints both outlines
- [ ] Applying a template removes both outlines
- [ ] Clear Canvas brings both back

## 8105a95 — Move getFreshPromoCard to lib

- [ ] **Clear Canvas** produces a blank card: no words, both toggles off
- [ ] The cleared card's start date is today and its end date is empty
- [ ] The blank-palette colour advances on each clear (not the same colour every time)
- [ ] Timer wording on a fresh card is "Ends In {timer}"
- [ ] **Create new** campaign produces the same blank card

## PromoTextField — the three panel text fields merged into one component

**This is the risky one.** The last attempt at this was reverted because the
per-field line limit stopped working. If any box below fails, revert this one
commit and everything else still stands.

The mechanism behind the old failure is now understood and closed off: a field
whose editor ref is created inside the component leaves PromoSection's
`titleRef` / `subtitleRef` / `descRef` null, and `onFieldInput` returns before
measuring when that ref is null — the cap disappears with nothing else changed.
The refs stay in PromoSection and are passed down.

### The line limit — test this first
- [ ] **Title**: type past one line — the edit reverts and the amber warning shows
- [ ] **Subtitle**: type past two lines — reverts and warns
- [ ] **Description**: type past three lines — reverts and warns
- [ ] Each one stops at the **visible** edge, not early with space left
- [ ] "⚠️ Field limit reached" appears under whichever field is at its limit
- [ ] Deleting a character clears that note
- [ ] Applying a **larger font size** that would overflow is rejected, and the size does not stay highlighted in the toolbar
- [ ] **Pasting** a long string into each field truncates it to what fits

### The rest of each field
- [ ] Labels read Title / Subtitle / Description
- [ ] Placeholders read "Your headline" / "A supporting line" / "A little more about the offer"
- [ ] The **palette button** on each opens that field's style panel, named correctly
- [ ] The **"i" note** shows the right guidance for each field, and "never show" hides it for good
- [ ] Clicking into a field highlights its border and the toolbar reads its formats
- [ ] Typing in the panel updates the card preview, and vice versa
- [ ] Undo/redo steps through edits one at a time
- [ ] The card widens as text grows
- [ ] Spacing above the Title field is unchanged (it carries the section's top margin)
