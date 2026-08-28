import { describe, expect, it } from 'vitest';
import { isAnnouncementInWindow, visibleAnnouncements } from '@/lib/announcement/announcementWindow';

/**
 * Which messages are live right now.
 *
 * This rule existed twice — once for the editor's preview bar and once for the
 * dashboard — and the two agreeing was luck rather than design. They are one
 * function now; these cases are what "one function" has to keep meaning.
 */

const iso = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('isAnnouncementInWindow', () => {
  it('shows a message with no schedule at all', () => {
    expect(isAnnouncementInWindow(undefined, undefined)).toBe(true);
  });

  it('shows a message whose run has started and not finished', () => {
    expect(isAnnouncementInWindow(iso(-2), iso(2))).toBe(true);
  });

  it('shows a message that ends TODAY — the run covers the whole day', () => {
    // The end is widened to 23:59:59 local. Compared at midnight it would
    // read as already finished, and a campaign would vanish on its last day.
    expect(isAnnouncementInWindow(iso(-5), iso(0))).toBe(true);
  });

  it('shows a message that starts today', () => {
    expect(isAnnouncementInWindow(iso(0), iso(3))).toBe(true);
  });

  it('hides a message that has not started', () => {
    expect(isAnnouncementInWindow(iso(1), iso(5))).toBe(false);
  });

  it('hides a message whose run has passed', () => {
    expect(isAnnouncementInWindow(iso(-9), iso(-1))).toBe(false);
  });

  it('treats a missing start as "since always" and a missing end as "forever"', () => {
    expect(isAnnouncementInWindow(undefined, iso(1))).toBe(true);
    expect(isAnnouncementInWindow(iso(-1), undefined)).toBe(true);
  });
});

describe('visibleAnnouncements', () => {
  it('keeps only the messages in their window, in order', () => {
    const list = [
      { text: 'always' },
      { text: 'expired', startDate: iso(-9), endDate: iso(-1) },
      { text: 'running', startDate: iso(-1), endDate: iso(1) },
      { text: 'future', startDate: iso(3), endDate: iso(5) },
    ];
    expect(visibleAnnouncements(list).map((a) => a.text)).toEqual(['always', 'running']);
  });
});
