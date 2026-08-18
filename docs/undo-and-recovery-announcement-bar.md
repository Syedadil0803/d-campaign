# Undo & Recovery — Announcement Bar

*Updated to match the tool as built. The editor undo is now multi-step, the Undo/Redo buttons are gone, and every list action carries its own Undo.*

## 1. Why this matters

The admin writes and styles the announcements that will go on the website. Nothing is live while they work — it stays in the editor until they publish. That work still takes real effort to build, and a wrong click — a deleted announcement, a cleared list, a change they regret — shouldn't throw it away. This is how we protect the work in progress, without making the tool feel heavy.

## 2. How Undo works

Undo behaves in two ways, matched to the kind of action.

**While writing and styling an announcement (the editor).** Ctrl+Z steps back through your recent changes, one at a time — up to about 30 steps; Ctrl+Shift+Z steps forward. The message text, its formatting, the link, the schedule and the bar's background all share one list, so Ctrl+Z walks back through everything in the order you did it.

**On the list of saved announcements.** A one-tap **Undo** appears in the toast right after a risky action — delete, reorder, clear, start fresh. It takes back just that one action, and it lasts five seconds — a small ring beside **Undo** drains as they run out, with the seconds left inside it, so the deadline is visible rather than a guess.

**What counts as one step.** A step is one editing action, not one keystroke. A burst of typing is a single step, and deleting a run of text (holding Backspace, or selecting and pressing Delete) is a single step too. A color change, a bold toggle, a font size: each is its own step. So "about 30 steps" covers a long session — it's 30 actions, not 30 letters.

**No buttons on screen.** There are no Undo/Redo buttons. Editing is the keyboard shortcut; the list actions are the toast. That's what keeps the tool from feeling like a document editor.

## 3. What happens, step by step

### Scenario 1 — Writing and styling the text

1. Type "Winter Sale" → the box shows "Winter Sale".
2. Make "Sale" bold.
3. Turn "Sale" red.
4. Ctrl+Z → the red comes off. Ctrl+Z → the bold comes off. Ctrl+Z → the text goes.

*Each press steps back one change, newest first, through the last ~30. Ctrl+Shift+Z walks forward again.*

### Scenario 2 — Typing, deleting, then styling

1. Type "Winter Sale".
2. Delete the "s" → "Winter ale".
3. Ctrl+Z → the "s" comes back.
4. Select "Sale" and make it bold.
5. Ctrl+Z → the bold comes off, **not** the "s".

*Undo never picks a random earlier change — it's always the newest. And typing after a delete opens its own step, so a deletion and the words you typed afterward are never swallowed by one press.*

### Scenario 3 — Background colors (each choice is its own step)

1. Background starts white. 2. Set it to solid blue. 3. Change it to red. 4. Change it to a blue-to-green gradient.
5. Ctrl+Z → back to red. Ctrl+Z → back to blue. Ctrl+Z → back to white.

### Scenario 4 — Text and styling mixed in one undo

1. Type "Winter Sale". 2. Bold "Sale". 3. Type " — up to 30% off". 4. Change the background to red.
5. Ctrl+Z → the background goes back. Ctrl+Z → the added text goes. Ctrl+Z → the bold comes off. Ctrl+Z → the text goes.

*It doesn't matter whether a step was text, formatting, or background — one timeline, peeled back in reverse order.*

### Scenario 5 — Themes (a look change, like any other)

Themes restyle the bar and keep your messages, so they're ordinary editing.

1. Click a theme → the bar restyles; your text is untouched.
2. Ctrl+Z → the previous look is back.

### Scenario 6 — The link popup has its own undo

The link popup is a separate field, so undo inside it steps back the URL rather than the announcement text.

1. Open **Add link** and type a URL.
2. Ctrl+Z inside the popup → steps back the URL, one change at a time.
3. Close the popup and Ctrl+Z again → you're back to stepping through the message.

### Scenario 7 — Deleting an announcement (the Undo toast)

1. Your list has three announcements.
2. You delete "Winter Sale" by mistake — from the ••• menu, or by selecting it and pressing Delete.
3. A toast appears: **"Announcement deleted — Undo"**.
4. Tap Undo → it's back in the list, in its original position, exactly as it was.

### Scenario 8 — When the Undo toast is gone

1. You delete an announcement. The toast appears.
2. Instead of tapping Undo, you do something else, or the few seconds pass. The toast disappears.
3. That delete can no longer be undone. The toast catches the mistake only in the moment.

### Scenario 9 — Reordering the list

1. You drag "Free shipping" above "Winter Sale".
2. A toast appears: **"Order changed — Undo"**.
3. Tap Undo → the previous order returns. (Or just drag it back yourself.)

### Scenario 10 — Clearing the whole list

1. You click **Clear** and the message list empties.
2. A toast appears: **"All announcements cleared — Undo"**.
3. Tap Undo → every message is back, in order.

### Scenario 11 — Start fresh (messages *and* styling)

1. From the ••• menu you pick **Start fresh** and confirm.
2. The messages go and the styling resets to defaults.
3. A toast appears: **"Started fresh — messages and styling reset to defaults — Undo"**.
4. Tap Undo → the whole bar comes back: messages, background, loop and schedule.

*This is the one action whose Undo restores more than the message list, because it's the one action that wipes more than the message list.*

### Scenario 12 — Adding or updating (nothing to recover)

1. You add "Free shipping this week" — nothing is lost. Don't want it? Delete it, and that delete has its own Undo.
2. You reword a message and click Update — the new wording is saved; to change it, edit it again.

*These get no Undo of their own, because nothing was thrown away. Adding or updating also ends the editor's step history: the editor has moved on to a different message.*

### Scenario 13 — Loop and On air / Off (nothing to recover)

1. Turn Loop off. Don't like it? Turn it back on.
2. Take the bar off the site. Want it back? Turn it On air.

*No Undo — it's a switch. Flipping it back is the whole action.*

### Scenario 14 — Refreshing or leaving the page

1. You've made several changes.
2. You refresh. The browser warns you first, and your work is rescued into the saved draft on the way out.
3. Come back and the work is there — but the undo history is not.

*Undo lives only in the current session. The draft is what survives a reload — the work is safe, the steps are not.*

## 4. Which action uses which (summary)

### A. Text editing (the announcement text field)

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 1 | Typing text | Ctrl+Z (burst = one step) | Walks back through your edits |
| 2 | Deleting a run of text | Ctrl+Z (whole run = one step) | The text before you deleted it |
| 3 | Overwriting selected text | Ctrl+Z | The text before you typed over it |
| 4 | Pasting text | Ctrl+Z | The state before the paste |

### B. Formatting the text

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 5 | Bold | Ctrl+Z | Takes the bold off |
| 6 | Italic | Ctrl+Z | Takes the italic off |
| 7 | Font size | Ctrl+Z | The previous size |
| 8 | Text color | Ctrl+Z | The previous color |

### C. List actions (the announcement list)

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 9 | Add an announcement | Nothing to recover | Nothing is lost |
| 10 | Update an existing announcement | Nothing to recover | Nothing is lost |
| 11 | Delete an announcement | Undo toast (single step) | The announcement, back in its slot |
| 12 | Reorder (drag) | Undo toast (single step) | The previous order |
| 13 | Clear the list | Undo toast (single step) | Every message, back in order |

### D. Settings on an announcement / the bar

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 14 | Add / change a link | Ctrl+Z (in the link popup) | The previous link |
| 15 | Add / change a schedule | Ctrl+Z | The previous dates |
| 16 | Background (type, colors, direction, balance) | Ctrl+Z | Each change, one step at a time |
| 17 | Applying a theme | Ctrl+Z | The look you had before |
| 18 | Loop on / off | Nothing to recover | Just switch it back |
| 19 | Turn the bar On air / Off | Nothing to recover | Just switch it back |

### E. Whole-bar actions

| # | Action | How it's handled | What the admin gets |
|---|---|---|---|
| 20 | Start fresh | Confirm, then Undo toast | The whole bar back — messages and styling |

## 5. What changed from the first draft of this spec

- **The editor undo was single-step; it is now multi-step.** One push locked "the previous state" and every later push was dropped, so Ctrl+Z could only ever go back once. It now runs on the same bounded 30-step stack as the promo editor, with typing bursts collapsed into one step.
- **The Undo/Redo buttons are gone**, as section 5 of the first draft asked. The 30-deep list stack that sat behind them is gone with them — each list action now carries its own Undo instead.
- **Delete, reorder, clear and start fresh all have Undo toasts.** Before, delete showed a plain confirmation and recovery depended on the very buttons the spec wanted removed; reorder showed nothing at all.
- **The toast lasts five seconds**, not three — matched to the promo card so the two halves of the tool behave the same.
- **Discard draft is gone from the spec**, because it isn't in the tool. The promo card lost it too. See the gap below.

**One honest gap.** The promo card can always get back to what's published by applying the live card from **My Published**. The announcement bar has no equivalent — **Start fresh** resets to *defaults*, not to what's on your website. So mid-session there's no one-click way back to the published bar. Worth deciding on separately; it isn't an undo problem.

## 6. Why this is the right fit

- **It matches what people already know.** Type and Ctrl+Z walks back; delete something and a one-tap Undo pops up.
- **It doesn't feel like a document editor.** That feeling came from the visible Undo/Redo buttons, which are now removed.
- **Both halves of the tool behave the same.** The announcement bar and the promo card share the same undo stack, the same grouping rules, and the same toast.

## 7. What we'd tell the user

- "While you're writing, Ctrl+Z steps back through your recent changes; Ctrl+Shift+Z redoes."
- "Deleted the wrong announcement, or dragged one to the wrong place? Tap Undo — but only for a few seconds."
- "Cleared the list or started fresh by mistake? The same Undo brings it all back, styling included."
- "A refresh clears Undo, but not your work — your draft is saved. You just can't step back through earlier changes after reloading."

## 8. Decisions

- **Hybrid model.** Multi-step Ctrl+Z inside the editor; single-step Undo toast on the list (delete, reorder, clear, start fresh).
- **A step is an action, not a keystroke.** A typing burst, a whole delete, an overwrite: one step each.
- **Undo is bounded, not unlimited.** About 30 recent actions, so it stays light and predictable; the oldest roll off the back.
- **No visible Undo/Redo buttons**, and no list history stack behind them.
- **Undo is session-only.** Cleared on refresh; the saved draft is what persists.
- **The link popup keeps its own history**, so undo inside it doesn't reach back into the message text.
