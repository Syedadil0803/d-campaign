import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../demo/campaign-config.json';
import type { CampaignConfig } from '@/types/campaign';
import { cardTimerHtml, decide, sanitize, safeUrl, videoLayout, videoTimeLeft } from './logic';

const now = new Date(2026, 9, 13, 12); // 13 Oct 2026, local noon
const base = () => structuredClone(config) as unknown as CampaignConfig;

beforeEach(() => vi.useFakeTimers({ now }));
afterEach(() => vi.useRealTimers());

describe('decide', () => {
  it('shows all three when live, video opposite the card', () => {
    const p = decide(base(), now);
    expect(p.messages.map((m) => m.text)).toHaveLength(2); // the 2025 message is out of window
    expect(p.card).not.toBeNull();
    expect(p.video).not.toBeNull();
    expect(p.cardPosition).toBe('bottom-right');
    expect(p.videoPosition).toBe('bottom-left'); // stored bottom-right, moved by placeWidgets
  });

  it('keeps the video where it was put when the card is not live', () => {
    const c = base();
    c.promoCard.active = false;
    const p = decide(c, now);
    expect(p.card).toBeNull();
    expect(p.videoPosition).toBe('bottom-right');
  });

  it('respects schedule windows, inclusive of the end day', () => {
    const c = base();
    c.promoCard.endDate = '2026-10-13';
    expect(decide(c, now).card).not.toBeNull();
    c.promoCard.endDate = '2026-10-12';
    expect(decide(c, now).card).toBeNull();
    c.promoCard.endDate = '2026-12-31';
    c.promoCard.startDate = '2026-10-14';
    expect(decide(c, now).card).toBeNull();
  });

  it('open-ended ignores the end date', () => {
    const c = base();
    c.videoStory!.scheduleMode = 'openEnded';
    c.videoStory!.endDate = '2020-01-01';
    expect(decide(c, now).video).not.toBeNull();
  });

  it('hides a video with no clip, and anything inactive', () => {
    const c = base();
    c.videoStory!.videoUrl = ' ';
    c.announcementBar.active = false;
    const p = decide(c, now);
    expect(p.video).toBeNull();
    expect(p.messages).toEqual([]);
  });

  it('shows nothing for empty or junk config', () => {
    for (const junk of [null, undefined, {}, { promoCard: {} }] as never[]) {
      const p = decide(junk, now);
      expect([p.messages.length, p.card, p.video]).toEqual([0, null, null]);
    }
  });
});

describe('sanitize', () => {
  it('strips scripts, handlers and javascript: links', () => {
    const out = sanitize(
      '<b onclick="x()">Hi</b><script>alert(1)</script><img src=x onerror=alert(1)>' +
        '<a href="javascript:alert(1)">bad</a><a href="https://ok.example/">ok</a><div><i>kept</i></div>',
    );
    expect(out).toBe(
      '<b>Hi</b><a>bad</a><a href="https://ok.example/" target="_blank" rel="noopener noreferrer">ok</a><i>kept</i>',
    );
  });

  it('keeps only colour, weight, style and size, with rem as px', () => {
    expect(sanitize('<span style="color:red;font-size:1.5rem;position:fixed;background:url(x)">t</span>')).toBe(
      '<span style="color:red;font-size:24px">t</span>',
    );
  });

  it('safeUrl allows web, mail and phone only', () => {
    expect(safeUrl('data:text/html,x')).toBe('');
    expect(safeUrl(' JavaScript:alert(1)')).toBe('');
    expect(safeUrl('https://wa.me/447911123456')).toBe('https://wa.me/447911123456');
    expect(safeUrl('tel:+44123')).toBe('tel:+44123');
  });
});

describe('countdowns', () => {
  it('card fills {timer} with the admin chip, sanitised', () => {
    const c = base().promoCard;
    c.endDate = '2026-10-15'; // to local end of day: 2 days 11h 59m
    const html = cardTimerHtml(c);
    expect(html.replace(/<[^>]*>/g, '')).toBe('Ends in 2 days : 11 hours : 59 mins');
    expect(html).not.toMatch(/data-|contenteditable/);
  });

  it('video shows time only', () => {
    expect(videoTimeLeft('2026-10-13')).toBe('11h 59m');
  });
});

describe('videoLayout', () => {
  it('bubbles only on a phone with the card showing', () => {
    expect(videoLayout(true, 390)).toBe('bubble');
    expect(videoLayout(true, 639)).toBe('bubble');
    expect(videoLayout(true, 640)).toBe('full');
    expect(videoLayout(false, 390)).toBe('full'); // video alone keeps the full widget
    expect(videoLayout(true, 1440)).toBe('full');
  });
});
