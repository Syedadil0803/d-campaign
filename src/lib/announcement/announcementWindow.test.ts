import { describe, expect, it } from 'vitest';
import {
  announcementScheduleState,
  isAnnouncementInWindow,
  visibleAnnouncements,
} from '@/lib/announcement/announcementWindow';

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

describe('Message scheduling', () => {
  it('ANN-08 shows a message with no schedule at all', () => {
    expect(isAnnouncementInWindow(undefined, undefined)).toBe(true);
  });

  it('ANN-09 shows a message whose run has started and not finished', () => {
    expect(isAnnouncementInWindow(iso(-2), iso(2))).toBe(true);
  });

  it('ANN-10 shows a message that ends today — the run covers the whole day', () => {
    // The end is widened to 23:59:59 local. Compared at midnight it would
    // read as already finished, and a campaign would vanish on its last day.
    expect(isAnnouncementInWindow(iso(-5), iso(0))).toBe(true);
  });

  it('ANN-11 shows a message that starts today', () => {
    expect(isAnnouncementInWindow(iso(0), iso(3))).toBe(true);
  });

  it('ANN-12 hides a message that has not started', () => {
    expect(isAnnouncementInWindow(iso(1), iso(5))).toBe(false);
  });

  it('ANN-13 hides a message whose run has passed', () => {
    expect(isAnnouncementInWindow(iso(-9), iso(-1))).toBe(false);
  });

  it('ANN-14 treats a missing start as "since always" and a missing end as "forever"', () => {
    expect(isAnnouncementInWindow(undefined, iso(1))).toBe(true);
    expect(isAnnouncementInWindow(iso(-1), undefined)).toBe(true);
  });
});

describe('Message scheduling', () => {
  it('ANN-15 keeps only the messages in their window, in order', () => {
    const list = [
      { text: 'always' },
      { text: 'expired', startDate: iso(-9), endDate: iso(-1) },
      { text: 'running', startDate: iso(-1), endDate: iso(1) },
      { text: 'future', startDate: iso(3), endDate: iso(5) },
    ];
    expect(visibleAnnouncements(list).map((a) => a.text)).toEqual(['always', 'running']);
  });
});

// The badge a message shows in the list — derived from the same window rule,
// so the badge and what the site displays can never disagree.
describe('Schedule badge state', () => {
  it('ANN-17 badges a future dated run as future', () => {
    expect(announcementScheduleState(iso(3), iso(9))).toBe('future');
  });

  it('ANN-18 badges a live message with an end date as current', () => {
    expect(announcementScheduleState(iso(-1), iso(5))).toBe('current');
    expect(announcementScheduleState(undefined, iso(5))).toBe('current');
  });

  it('ANN-19 badges a live message with a start and no end as open-ended', () => {
    expect(announcementScheduleState(iso(-1), undefined)).toBe('openEndedCurrent');
    expect(announcementScheduleState(iso(0), undefined)).toBe('openEndedCurrent');
  });

  it('ANN-20 badges an unscheduled or expired message as none', () => {
    expect(announcementScheduleState(undefined, undefined)).toBe('none'); // no dates
    expect(announcementScheduleState(iso(-9), iso(-2))).toBe('none'); // already ended
  });

  it('ANN-21 tells a future open-ended run apart from a future dated one', () => {
    // The state we used to miss: a start still to come, with no end. It must not
    // read the same as a bounded future run — it also never ends.
    expect(announcementScheduleState(iso(3), undefined)).toBe('openEndedFuture');
    expect(announcementScheduleState(iso(3), iso(9))).toBe('future');
  });
});
