# Undo & Recovery — Promo Card

*Updated to match the tool as built. Reset edits and Discard draft are gone; Themes, Clear canvas and My Draft are in.*

## 1. Why this matters

The admin builds a whole promo card — five text boxes (title, subtitle, description, button, timer), colors, a countdown, and a call to action. Nothing is live while they work; it stays in the editor until they publish. That work takes real effort, and a wrong click — deleting a line they meant to keep, replacing the design with a template, switching to a variant, deleting one, or clearing the canvas — shouldn't cost them the card. This is how we protect it, without making the tool feel heavy.

## 2. How Undo works

Undo behaves in two ways, matched to the kind of action.

**While building the promo (the editor).** Ctrl+Z steps back through your recent changes, one at a time — up to about 30 steps; Ctrl+Shift+Z steps forward. All five text boxes, the formatting, the colors, the themes, the card styling, the schedule, the CTA and the timer share one undo list, so Ctrl+Z walks back through everything in the order you did it, no matter which box or setting you touched.

**For the actions that replace the whole card.** A one-tap **Undo** appears in the confirmation toast right after: apply a template, apply a variant, delete a variant, clear the canvas, load your saved draft, or apply an AI reply. It brings back exactly what you had — the card, the theme you were on, and which variant was selected. The offer lasts five seconds, and a small ring beside **Undo** drains as they run out, with the seconds left inside it — so you can see the deadline instead of guessing at it.

**What counts as one step.** A step is one editing action, not one keystroke. A burst of typing is a single step, and deleting a run of text (holding Backspace, or selecting and pressing Delete) is a single step too — so Ctrl+Z brings back the whole word or line at once, not one letter at a time. A color change, a bold toggle, a theme, a date change: each is its own step. This is why "about 30 steps" covers a long session — it's 30 actions, not 30 letters.

**No buttons on screen.** There are no Undo/Redo buttons in the editor. Editing undo is the keyboard shortcut; the replacing actions get the toast. That is what keeps the tool from feeling like a document editor.

**One clear boundary.** Ctrl+Z covers your editing. It does **not** step back across a template swap, a variant swap, a canvas clear, a draft load, or an AI apply — those are undone only by their own toast, right after you do them. Keeping the two paths apart is what stops a stray Ctrl+Z from unexpectedly wiping the template you just chose.

## 3. What happens, step by step

### Scenario 1 — Writing and styling one text box (title)

1. In the Title box, type "Mega Sale" → the title shows "Mega Sale".
2. Make it bold → **Mega Sale**.
3. Turn it red → bold and red.
4. Ctrl+Z → the red comes off.
5. Ctrl+Z → the bold comes off.
6. Ctrl+Z → the text goes. Empty title.

*Each press steps back one change, newest first, through the last ~30.*

### Scenario 2 — Deleting text you just typed (three ways, all recoverable)

You type "Summer Sale" in the Title box, then decide it's wrong.

- **Hold Backspace** and erase it letter by letter. Ctrl+Z → "Summer Sale" is back in one go.
- **Select all and press Delete.** Ctrl+Z → "Summer Sale" is back.
- **Select it and type over it** with "Winter Sale". Ctrl+Z → back to "Summer Sale".

*However you remove text, one Ctrl+Z brings the whole thing back — you never undo letter by letter. And typing after a delete starts its own step, so a delete followed by a new sentence takes two Ctrl+Z presses, not one that swallows both.*

### Scenario 3 — Editing across all five boxes (one shared history)

1. Title: type "Mega Sale". 2. Subtitle: "Ends Sunday". 3. Description: "Up to 50% off everything". 4. Button: "Shop now".
5. Ctrl+Z → the button text goes. Ctrl+Z → the description. Ctrl+Z → the subtitle.

*It doesn't matter which box you were in — every change is on the same timeline, undone in reverse order.*

### Scenario 4 — Styling on the preview card (same undo)

Text is typed in the input boxes on the left; the preview card is where you select that text and restyle it — bold, color, size, alignment. Those changes go on the same undo list.

1. On the preview card, select the title and make it bold → the title turns bold.
2. Ctrl+Z → the bold comes off, using the same undo the panel uses.

*The timer is the one field that is typeable on the card itself, and it steps back the same way.*

### Scenario 5 — Editing the countdown timer text

The timer shows your own label around a live countdown ("Ends in 2 days : 11 hours"). You can type that label in the input box or on the card.

1. Type "Hurry — ends in" before the countdown → it shows in the timer.
2. Ctrl+Z → the label steps back, like any other field.
3. Try to delete the countdown itself → it comes straight back, and nothing is added to the undo history.

*The one-line limit and the undeletable countdown are guardrails, not undo steps.*

### Scenario 6 — Colors and card styling (each choice is a step)

1. Card background is white. 2. Set it to solid blue. 3. Change it to a red gradient.
4. Ctrl+Z → back to solid blue. Ctrl+Z → back to white.

*Colors, per-element styling, position, schedule, CTA and timer settings are all editing — each is its own step in the same history.*

### Scenario 7 — Themes (a look change, not a swap)

Themes restyle the card and keep your words, so they are ordinary editing, not a replacing action.

1. You've written your copy on a cream card.
2. Click a dark theme chip → the card restyles; your text is untouched.
3. Ctrl+Z → back to cream.

Alongside the theme chips there is a **revert swatch** with a circular arrow, showing the design the card had before you started trying themes. It's there so browsing themes isn't a one-way door: try five, then click it to land back where you were. Clicking it is itself an undo step.

*Because your words are never at risk, themes get no confirmation and no toast — just Ctrl+Z and the revert swatch.*

### Scenario 8 — Redo (changing your mind)

1. You made "Mega Sale" bold, then Ctrl+Z → the bold came off.
2. Ctrl+Shift+Z → the bold is back.
3. But if you had typed something new after the undo, redo is gone — the fresh change takes its place.

### Scenario 9 — A long mixed session and the ~30-step limit

Real editing is mixed: type, delete, recolor, try a theme, change dates. The list holds about the last 30 of these actions, in order.

Press Ctrl+Z repeatedly and it walks back newest-first through those ~30 actions. Anything older was never kept, so you eventually reach the end and nothing more happens. Ctrl+Shift+Z goes forward again until you make a new change.

*The cap is on actions, not keystrokes, so 30 covers a genuinely long session. Past it, the oldest steps quietly drop off the back.*

### Scenario 10 — Applying a template (Undo toast, replaces the design)

1. You've built a promo — title, colors, button, all set up.
2. You pick "Executive Slate" from Template Hub → the whole card is replaced with that template's design and its sample text.
3. A toast appears: **"Template applied: Executive Slate — Undo"**.
4. Tap Undo → your original design is back, along with the theme you were on and the variant that was selected.

*Template Hub asks for consent first when there's actually work to lose. Applying a template keeps your campaign dates — a template is a design and its copy, not a schedule.*

### Scenario 11 — Editing right after a swap (the boundary, made concrete)

1. You apply "Executive Slate". The toast is showing.
2. Instead of tapping Undo, you start tweaking — change the title text, make it bigger.
3. Ctrl+Z now undoes your tweaks, newest-first.
4. Ctrl+Z does **not** jump back over the swap to your old design. That's the toast's job, and only while it's showing.

### Scenario 12 — Applying a saved variant (Undo toast)

1. Open **My Published** and click a saved variant → the card switches to that variant's design and copy.
2. A toast appears: **"Variant applied: Saved Aug 14, 5:56 PM — Undo"**.
3. Tap Undo → back to what you were editing, including which variant was highlighted.

*Like templates, a variant contributes its design and its words, not its dates — those belong to the campaign that already ran.*

### Scenario 13 — Deleting a variant (Undo toast)

1. You delete a saved variant by mistake.
2. A toast appears: **"Variant deleted — Undo"**.
3. Tap Undo → it's back in the list, in its original slot, with its original name and save time.

**One exception.** Deleting the variant that is currently **live** also takes the card off your website and clears the canvas. That one says so in the confirmation and offers no Undo — putting it back means publishing again.

### Scenario 14 — Clearing the canvas (Undo toast, wipes the card)

1. You've built a promo and click **Clear Canvas**.
2. It asks first, then the card is wiped to a blank promo.
3. A toast appears: **"Fresh promo card started — Undo"**.
4. Tap Undo → your work is back, including the on-air status.

### Scenario 15 — Loading your saved draft (Undo toast, replaces the card)

1. You're editing, and open **My Draft** to bring the saved draft back.
2. The draft's card lands on the canvas, replacing what was there.
3. A toast appears: **"Saved draft loaded into the editor — Undo"**.
4. Tap Undo → the card you were editing is back. The saved draft itself is untouched either way.

### Scenario 16 — Applying an AI reply (Undo toast, replaces the card)

1. You paste the reply from your AI tool and click **Apply to my card**.
2. The card takes on the new copy, and the new palette too if you asked for one.
3. A toast appears: **"Applied to your card — Undo"**.
4. Tap Undo → the card you had before the paste is back.

*Like the other replacing actions, this is a swap rather than an edit, so Ctrl+Z doesn't reach across it — the toast is the way back.*

### Scenario 17 — When the Undo toast is gone

1. You apply a template over your design. The toast appears.
2. You start editing instead, or the few seconds pass. The toast disappears.
3. That replacement can no longer be undone — though your editing on the new design is still covered by Ctrl+Z.

*This is the reason the replacing actions ask for consent up front when there's work to lose: the toast is a grace period, not a safety net.*

### Scenario 18 — Actions with nothing to recover

- Saving or updating a variant doesn't touch the card you're editing — nothing is lost.
- Turning the promo **On air** or **Off** is a live switch. Want it the other way? Flip it back.

*These get no Undo, because nothing was thrown away.*

### Scenario 19 — Refreshing or leaving the page

1. You've made several changes.
2. You refresh the tab. The browser warns you first, and your work is rescued into the saved draft on the way out.
3. Come back and the work is there — but the undo history is not. Ctrl+Z won't step back through anything from before the reload.

*Undo lives only in the current session. The saved draft is what survives a reload — the work is safe, the steps are not. To get back to what's on the website, apply your live card from **My Published**.*

## 4. Which action uses which (summary)

### A. Text editing (title, subtitle, description, button, timer text)

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 1 | Typing text | Ctrl+Z (burst = one step) | Walks back through your edits |
| 2 | Deleting a run of text | Ctrl+Z (whole run = one step) | The text as it was before you deleted it |
| 3 | Overwriting selected text | Ctrl+Z | The selected text, before you typed over it |
| 4 | Pasting text | Ctrl+Z | The state before the paste |

### B. Formatting the text

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 5 | Bold / italic / font size | Ctrl+Z | The style before the last change |
| 6 | Text color | Ctrl+Z | The previous color |
| 7 | Alignment | Ctrl+Z | The previous alignment |

### C. Per-element style (title, subtitle, description, timer, button)

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 8 | Element background color | Ctrl+Z | The previous color |
| 9 | Element text color | Ctrl+Z | The previous color |

### D. Card appearance

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 10 | Card position | Ctrl+Z | The previous position |
| 11 | Card background (type, colors, gradient) | Ctrl+Z | Each change, one step at a time |
| 12 | **Applying a theme** | Ctrl+Z, plus the revert swatch | The look you had before |
| 13 | **The revert swatch** | Ctrl+Z | The theme you were trying |

### E. Schedule

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 14 | Start / end date | Ctrl+Z | The previous dates |

### F. Call to action

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 15 | Show / hide button, button text | Ctrl+Z | The previous state |
| 16 | CTA type, WhatsApp number, URL, full width | Ctrl+Z | The previous setting |

### G. Countdown timer

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 17 | Show / hide, label text, styling | Ctrl+Z | The previous state |

### H. Templates & variants

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 18 | Apply a template | Undo toast (single step) | Your design before the template |
| 19 | Apply a saved variant | Undo toast (single step) | Your design before the variant |
| 20 | Delete a variant | Undo toast (single step) | The variant, back in its slot |
| 21 | Delete the **live** variant | Confirm only — no Undo | It also leaves your website; republish to restore |
| 22 | Save or update a variant | Nothing to recover | Nothing is lost |

### I. Whole-card actions

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 23 | Clear canvas | Confirm, then Undo toast | Your work, back in full |
| 24 | Load the saved draft | Undo toast (single step) | The card you were editing |
| 25 | Apply an AI reply | Undo toast (single step) | The card before the paste |
| 26 | Turn On air / Off | Nothing to recover | Just switch it back |
| 27 | Update saved draft | Confirm when it would replace | The previous draft is replaced, by choice |

## 5. What changed from the first draft of this spec

- **Reset edits is gone.** The control was removed from the tool, so the "revert to the applied design" case no longer exists. Themes and the revert swatch cover the same ground without a second history model.
- **Discard draft is gone.** There's no standing Discard control and no discard confirmation. Getting back to what's live is now an ordinary action: apply your published card from **My Published**.
- **Start fresh is called Clear canvas**, and it asks before wiping.
- **Themes are new** since the first draft, and they're editing, not replacing — Ctrl+Z covers them.
- **Loading the saved draft** and **applying an AI reply** are replacing actions too, and both now carry the same Undo toast.
- **Undo/Redo buttons**: the first draft asked for them to be removed. They are removed.

## 6. Why this is the right fit

- **It matches what people already know.** Type and Ctrl+Z walks back; replace the design and a one-tap Undo pops up. Nothing new to learn.
- **It doesn't feel like a document editor.** That feeling comes from visible Undo/Redo buttons, which aren't there.
- **It builds on what was already in the tool.** The editor already snapshots the whole card and already showed template/variant/delete/fresh toasts. This extends the snapshot to a bounded 30-step history and puts an Undo on those toasts.

## 7. What we'd tell the user

- "While you're building the promo, Ctrl+Z steps back through your recent changes; Ctrl+Shift+Z redoes."
- "Deleted a line you meant to keep? One Ctrl+Z brings the whole thing back — you don't undo letter by letter."
- "Replaced your design with a template or variant, cleared the canvas, or deleted a variant by mistake? Tap Undo — but only for a few seconds."
- "Trying themes is safe: your words never change, Ctrl+Z steps back, and the revert swatch takes you to the design you started from."
- "A refresh clears Undo, but not your work — it's kept in your saved draft. You just can't step back through earlier changes after reloading."
- "To get back to what's on your website, apply your live card from My Published."

## 8. Decisions

- **Hybrid model.** Multi-step Ctrl+Z across the whole editor; single-step Undo toast for the actions that replace the card (apply template, apply variant, delete variant, clear canvas, load saved draft).
- **A step is an action, not a keystroke.** A typing burst, a whole delete, an overwrite: one step each. Typing after a delete opens a new step, so a delete and the sentence that follows it are never swallowed by one press.
- **Undo is bounded, not unlimited.** About 30 recent actions, so it stays light; the oldest roll off the back.
- **No visible Undo/Redo buttons.**
- **Undo is session-only.** Cleared on refresh; the saved draft is what persists.
- **A swap is a hard boundary.** Applying a template or variant, clearing the canvas, or loading the draft clears the history, so Ctrl+Z can never step across one.
- **The Undo offer restores the surroundings too** — the card, the theme revert point, and which variant was selected — not just the card's contents.
- **Deleting the live variant is deliberately not undoable**, because it also removes the card from the website.
