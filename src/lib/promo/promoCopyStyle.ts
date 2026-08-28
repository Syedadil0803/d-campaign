/**
 * The house typography for promo copy, written as prompt text.
 *
 * Every built-in template composes lines the same way: a bold name with a
 * small all-caps kicker, a big number between two small phrases, a plain
 * description. That mix of sizes inside one line is most of what makes a
 * template look designed rather than typed.
 *
 * Both AI prompts used to say only "you may use light inline HTML", which a
 * model reads as permission it need not take — so cards came back as three
 * flat sentences beside templates that did not look like them. These are the
 * actual patterns, quoted so the model has something to copy.
 *
 * Shared by both prompts so they cannot drift. Examples use SINGLE quotes in
 * attributes because the prompt asks for JSON, and the importer's sanitizer
 * keeps exactly these tags.
 */
export const PROMO_COPY_STYLE_GUIDE: string[] = [
  '── HOW THE COPY SHOULD LOOK ──',
  'Write the copy the way the built-in templates are written. They are not flat',
  'sentences: sizes and weight change WITHIN a line, and that is what makes the',
  'card look designed. Match that.',
  '',
  'TITLE — the name in bold, optionally followed by a small all-caps kicker:',
  "  <strong>Royal Loom Collection</strong> <span style='font-size:0.8rem'>SIGNATURE EDIT</span>",
  'For a headline event, compose it small → large → small:',
  "  <span style='font-size:0.75rem'>THE</span> <strong style='font-size:1.6rem'>MAKEOVER</strong> <span style='font-size:0.75rem'>EVENT</span>",
  '',
  'SUBTITLE — lead in small, put the number big and bold, trail off small:',
  "  <span style='font-size:0.85rem'>Up to</span> <span style='font-size:1.35rem'><strong>40% OFF</strong></span> warm-tone rugs",
  '',
  'DESCRIPTION — one plain sentence, no size changes. Bold at most one thing,',
  'usually a discount code:',
  '  Apply <strong>COZY35</strong> before this drop disappears.',
  '',
  'TIMER — the words around the countdown. Keep {timer} exactly as it is, and',
  'bold the part that creates the urgency:',
  '  <strong>Only {timer} left</strong>',
  'This line is TIGHT. {timer} renders as a live countdown roughly the width of',
  '"2 days : 10 hours : 17 mins", it never wraps, and the space left over holds',
  'about FOUR SHORT WORDS. Write two to four and stop — "Offer ends in {timer}",',
  '"{timer} left at this price", "Basket closes in {timer}". A sentence here',
  'overflows the card.',
  '',
  'BUTTON — short and plain, at most one emoji or arrow: "Reveal My Offer",',
  '"🎁 Claim Holiday Deal", "Start My Makeover →". If one word carries the value,',
  'bold that word alone — never resize a button:',
  '  Claim <strong>40% OFF</strong>',
  '',
  'THE RULE BEHIND ALL OF IT — emphasis marks the one thing that must be read,',
  'wherever it happens to live. Usually that is the number or the deadline, so it',
  'lands in the title or subtitle; but if the urgency is in the countdown line,',
  'bold it there, and if the offer is in the button, bold it there. One emphasis',
  'per line. If everything is bold, nothing is.',
  '',
  'Sizes run 0.7rem to 1.6rem and the default is 1rem, so 0.8rem reads as fine',
  'print and 1.35rem as a headline number. Use at most two size changes in a',
  'line — more looks like a ransom note — and never resize the description or',
  'the button.',
  "Use SINGLE quotes in HTML attributes so the JSON stays valid, and only these",
  'tags: <strong>, <em>, <span style=\'font-size:…\'>, <span style=\'color:#hex\'>.',
];
