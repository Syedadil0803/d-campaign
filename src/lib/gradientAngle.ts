/**
 * Converting between CSS gradient directions and plain degrees.
 *
 * The colour picker's angle wheel works in degrees; CSS accepts either a
 * keyword ("to bottom right") or a degree value, and old configs contain both.
 * These three translate between the two so the wheel has one number to think
 * about.
 *
 * No React, no state — strings and numbers in, strings and numbers out.
 */

/** CSS defaults a gradient to 180deg; this app's cards default to 90. */
const DEFAULT_ANGLE = 90;

const KEYWORD_ANGLES: Record<string, number> = {
  'to top': 0,
  'to top right': 45,
  'to right': 90,
  'to bottom right': 135,
  'to bottom': 180,
  'to bottom left': 225,
  'to left': 270,
  'to top left': 315,
};

/** Accepts either form — "135deg" or "to bottom right" — and returns degrees. */
export function directionToAngle(direction?: string): number {
  if (!direction) return DEFAULT_ANGLE;
  const normalized = direction.trim().toLowerCase();
  const degreeMatch = normalized.match(/^(-?\d+(?:\.\d+)?)deg$/);
  if (degreeMatch) return Number(degreeMatch[1]);
  return KEYWORD_ANGLES[normalized] ?? DEFAULT_ANGLE;
}

/**
 * Any angle brought into 0–359.
 *
 * The doubled modulo is not redundant: a negative angle stays negative through
 * the first one, which the wheel produces every time it is dragged anticlockwise.
 */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Degrees back into the form CSS wants. */
export function angleToCssDirection(angle: number): string {
  return `${Math.round(normalizeAngle(angle))}deg`;
}
