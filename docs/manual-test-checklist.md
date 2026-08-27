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
