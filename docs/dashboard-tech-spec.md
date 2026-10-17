# Dashboard: technical specification

Status: implemented (14 October 2026), branch `feature/next-work`.

## 1. Purpose

The dashboard is the first screen after sign-in. In one view it answers three
questions for every website widget (Broadcasts, Smart Card, Video Story):

1. Is it live on the site?
2. Does anything need fixing?
3. Is there unfinished work to go back to?

It does not edit anything itself. Every action either changes the widget's
on/off state (Stop / Go on air, behind a confirm) or opens the widget's editor.

## 2. Layout rules

Layout depends on how many widget cards are shown.

| Cards shown | Layout | Container max width |
|---|---|---|
| 1–2 | Full cards, two columns | 1200 px |
| 3 | Full cards, three columns in one row | 1400 px |
| 4 or more | Compact summary tiles (see §5); clicking one opens the full card | 1400 px |

- The switch point is `FULL_CARD_LIMIT = 3` in `Dashboard.tsx`.
- Cards in a row stretch to the tallest card, so their buttons line up.
- **Why full cards up to three:** a full card shows the live preview, which is
  the fastest way to check the site. Tiles exist only so a fourth widget never
  squeezes the row.

### Responsive behaviour (full-card mode)

| Width | Columns |
|---|---|
| ≥ 1280 px (`xl`) | 3 when there are three cards, else 2 |
| 768–1279 px (`md`) | 2 (a third card wraps to a second row) |
| < 768 px | 1 |

At 1440 px the three cards measure about 427 × 472 px; at 1280 px about 373 × 488 px.

## 3. Which cards are shown

| Widget | Card shown when |
|---|---|
| Broadcasts | always |
| Smart Card | always |
| Video Story | it has been published at least once **or** a Video Story draft is saved |

A Video Story nobody has started gets no card, so the dashboard stays the
two-card screen. New Video Stories are started from the **Campaigns ▾** menu
in the header.

## 4. Full card anatomy

The three full cards share one structure, top to bottom:

| Zone | Broadcasts | Smart Card | Video Story |
|---|---|---|---|
| Header | icon, name, "SITEWIDE HEADER", Stop / Go on air | icon, name, "FLOATING CARD", Stop / Go on air | icon, name, "FLOATING VIDEO", Stop / Go on air |
| Summary line | `<n>` messages showing · View schedule breakdown | running state and start date | running state |
| Preview | mini bar | mini card (click to enlarge) | video thumbnail |
| Notice | draft saved / another device / recovered work | same | draft pending |
| Actions | Resume Draft + Add New, or Edit + Go on air | Resume Draft + Start New, or Create Smart Card | Create / Edit Video Story |

Components: `BroadcastsLifecycleCard`, `SmartCardLifecycleCard`
(`DashboardLifecycleCards.tsx`), `DashboardVideoStoryCard.tsx`.

## 5. Compact tile (4+ widgets)

Built and tested; used only past `FULL_CARD_LIMIT`.

| Part | Content |
|---|---|
| Header | icon, name, subtitle |
| Status row | chip "**Status:** Live / Needs Attention / Off / Ended / Not created" (ⓘ tooltip lists the issues) · key fact |
| Last saved | "Last saved: Today at 12:23 PM" (no seconds); the line keeps its height when empty |
| Button (44 px) | **Resume** when a draft exists, **Create** when not created, else **Open**, followed by the widget name |

- **The button** goes straight to the widget's editor and never opens the overlay.
- **Clicking the tile body** opens the full card in an overlay (`DashboardCardOverlay`):
  - it grows out of the tile (FLIP, about 250 ms in and 170 ms out);
  - Esc, × or a click outside closes it, and focus returns to the tile;
  - confirm popups stack above it.
- **Keyboard:** the tile is focusable, and Enter opens it.

Key facts:
- Broadcasts: "**9** Messages Active".
- Smart Card: "Ends in N days", "No end date" or "Ended".
- Video Story: "Video added" or "No video yet".

## 6. Status rules

Everything is derived from the **published** config, so it reflects what
visitors see. The logic lives in `src/lib/dashboard/tileSummary.ts` and
`src/lib/videoStory/videoStoryStatus.ts`.

| Status | Broadcasts | Smart Card | Video Story |
|---|---|---|---|
| Not created | off and no messages | never published | never published and blank |
| Off | `active = false` | `active = false` | `active = false` |
| Ended | (none; the bar is on or off) | end date passed | end date passed |
| Live | `active = true` | active, within its dates | active, within its dates |
| Needs Attention | live **and** has a medium or high issue | same | same |

Low-severity items (a saved draft waiting) never turn a live widget amber.

## 7. Issues (the "Your site" bar)

Each issue records its widget and severity. The same list feeds the bar at
the top and the tiles' "Needs Attention".

| Issue | Widget | Severity |
|---|---|---|
| Smart Card has no call-to-action | Smart Card | high |
| Unsaved local edits (Smart Card) | Smart Card | high |
| Unsaved local edits (Broadcasts) | Broadcasts | high |
| Smart Card is turned OFF | Smart Card | medium |
| Broadcasts are turned OFF | Broadcasts | medium |
| Schedule ended for Smart Card | Smart Card | medium |
| Video Story has no video | Video Story | high |
| Video Story has no call-to-action | Video Story | high |
| Video Story is turned OFF | Video Story | medium |
| Schedule ended for Video Story | Video Story | medium |
| Saved draft ready (Smart Card) | Smart Card | low |

A site that never made a Video Story gets no Video Story issues.

## 8. Actions

| Control | Effect |
|---|---|
| Stop / Go on air | confirm popup, then `setLiveActive(widget, on/off)`; publishes only that widget |
| Resume Draft / Resume | that widget's editor with its draft loaded |
| Add New / Start New / Create | that widget's editor, blank |
| Edit / Open | that widget's editor with the live version |
| Smart Card preview | enlarged preview popup |
| View schedule breakdown | the message schedule popup |

## 9. Motion and accessibility

- **Motion:**
  - tiles fade up 60 ms apart and lift 2 px on hover;
  - the overlay grows out of its tile;
  - all of it is off under `prefers-reduced-motion`.
- **Overlay accessibility:** `role="dialog"`, `aria-modal`, labelled by the card's name; focus is trapped inside it and restored on close.
- **Colour is never the only signal.** Every status chip carries its text.

## 10. Files

| File | Role |
|---|---|
| `src/components/dashboard/Dashboard.tsx` | data, statuses, issues, layout switch |
| `src/components/dashboard/DashboardLifecycleCards.tsx` | Broadcasts and Smart Card full cards |
| `src/components/dashboard/DashboardVideoStoryCard.tsx` | Video Story full card |
| `src/components/dashboard/DashboardSummaryTile.tsx` | compact tile (4+ widgets) |
| `src/components/dashboard/DashboardCardOverlay.tsx` | tile → full card overlay |
| `src/components/dashboard/DashboardPopups.tsx` | confirms and preview popups |
| `src/components/dashboard/CommandBar.tsx` | "Your site" bar with issues |
| `src/lib/dashboard/tileSummary.ts` (+ test) | status, chip, fact, button word, last-saved rules |
| `src/lib/videoStory/videoStoryStatus.ts` (+ test) | Video Story status |

## 11. Verification

- **Gates:** `tsc` clean, `eslint` 0, `vitest` (tile rules covered), `knip`, `madge`. No file is over 750 code lines.
- **Browser checks** (Playwright, system Chrome):
  - checked at 1440, 1280, 1024 and 390 px wide, with no sideways scroll;
  - the overlay opens and closes and focus returns;
  - each button lands on the right editor.

## 12. Known gaps

1. At 768–1279 px a third full card sits alone on a second row. Centring it is
   the usual fix and is still open.
2. The Video Story tile can't show the clip's length, because it isn't stored yet.
3. Seen once: the "Your site" bar said "Smart Card is Off" while the Smart Card
   card showed Stop. This needs a check that both read the same state.
