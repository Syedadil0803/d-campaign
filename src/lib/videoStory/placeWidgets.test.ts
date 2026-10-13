import { describe, it, expect } from 'vitest';
import { cornerClash, oppositeCorner, placeWidgets } from '@/lib/videoStory/placeWidgets';

// Two widgets on one page must never stack in the same corner.

describe('Widget placement', () => {
  it('flips a bottom corner', () => {
    expect(oppositeCorner('bottom-left')).toBe('bottom-right');
    expect(oppositeCorner('bottom-right')).toBe('bottom-left');
  });

  it('leaves each widget where it was put when only one is live', () => {
    const args = { cardPosition: 'bottom-right', videoPosition: 'bottom-right' } as const;
    expect(placeWidgets({ ...args, cardLive: true, videoLive: false })).toEqual(args);
    expect(placeWidgets({ ...args, cardLive: false, videoLive: true })).toEqual(args);
  });

  it('puts the video in the other bottom corner when both are live', () => {
    expect(
      placeWidgets({ cardPosition: 'bottom-right', videoPosition: 'bottom-right', cardLive: true, videoLive: true }),
    ).toEqual({ cardPosition: 'bottom-right', videoPosition: 'bottom-left' });
    // A top card still claims its side.
    expect(
      placeWidgets({ cardPosition: 'top-left', videoPosition: 'bottom-left', cardLive: true, videoLive: true }),
    ).toEqual({ cardPosition: 'top-left', videoPosition: 'bottom-right' });
  });

  it('warns only when the other widget is live in the same corner', () => {
    const live = { position: 'bottom-left', active: true } as const;
    expect(cornerClash('bottom-left', live, 'Smart Card')).toBe(
      "The Smart Card is live at Bottom Left. Choose Bottom Right so they don't overlap.",
    );
    expect(cornerClash('bottom-right', live, 'Smart Card')).toBeNull();
    expect(cornerClash('bottom-left', { ...live, active: false }, 'Smart Card')).toBeNull();
    expect(cornerClash('bottom-left', undefined, 'Smart Card')).toBeNull();
    // A top card never meets the video at the bottom.
    expect(cornerClash('bottom-left', { position: 'top-left', active: true }, 'Smart Card')).toBeNull();
  });
});
