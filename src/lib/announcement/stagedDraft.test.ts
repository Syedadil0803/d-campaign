import { describe, it, expect } from 'vitest';
import {
  buildPreviewList,
  chipExcerpt,
  describeWindow,
  hasVisibleText,
  previewMessages,
  startsLater,
} from '@/lib/announcement/stagedDraft';
import type { Announcement } from '@/types/campaign';

/** Dates are built relative to the run, so these never rot. */
function dayOffset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

const published: Announcement[] = [
  { text: 'first' },
  { text: 'second' },
];

describe('startsLater', () => {
  it('is false for a message with no start date', () => {
    expect(startsLater()).toBe(false);
    expect(startsLater('')).toBe(false);
  });

  it('is false for a message starting today', () => {
    expect(startsLater(dayOffset(0))).toBe(false);
  });

  it('is true for a message starting tomorrow', () => {
    expect(startsLater(dayOffset(1))).toBe(true);
  });

  it('is false for a start date already past', () => {
    expect(startsLater(dayOffset(-3))).toBe(false);
  });

  it('reads today in local time, not UTC', () => {
    // 23:00 local on today's date. Taken as UTC this can land on tomorrow,
    // which would wrongly call a message meant for right now "scheduled".
    const tonight = new Date();
    tonight.setHours(23, 0, 0, 0);
    expect(startsLater(tonight.toISOString())).toBe(false);
  });

  it('ignores an unparseable date rather than calling it scheduled', () => {
    expect(startsLater('not a date')).toBe(false);
  });
});

describe('hasVisibleText', () => {
  it('sees words', () => {
    expect(hasVisibleText('<span>hello</span>')).toBe(true);
  });

  it('does not count markup as content', () => {
    expect(hasVisibleText('<span style="color: red"></span>')).toBe(false);
  });

  it('does not count the zero-width space the editor leaves behind', () => {
    expect(hasVisibleText('<span>​</span>')).toBe(false);
  });
});

describe('previewMessages', () => {
  it('adds a message that is on air now', () => {
    const result = previewMessages(published, { text: 'staged' });
    expect(result.map((m) => m.text)).toEqual(['first', 'second', 'staged']);
  });

  it('keeps a future-dated message out until its start date', () => {
    const result = previewMessages(published, {
      text: 'later',
      startDate: dayOffset(7),
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second']);
  });

  it('shows a message starting today', () => {
    const result = previewMessages(published, {
      text: 'today',
      startDate: dayOffset(0),
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second', 'today']);
  });

  it('ignores an empty message', () => {
    expect(previewMessages(published, { text: '<b></b>' })).toEqual(published);
    expect(previewMessages(published, null)).toEqual(published);
  });

  it('passes the markup through, so the preview matches what publishes', () => {
    const [, , staged] = previewMessages(published, {
      text: '<span style="color: red">sale</span>',
    });
    expect(staged.text).toBe('<span style="color: red">sale</span>');
  });
});

describe('buildPreviewList', () => {
  it('shows the staged message alongside the published ones', () => {
    const result = buildPreviewList({
      visible: published,
      staged: { text: 'staged' },
      editing: null,
      typing: null,
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second', 'staged']);
  });

  it('prefers the staged message over anything left in the editor', () => {
    const result = buildPreviewList({
      visible: published,
      staged: { text: 'staged' },
      editing: null,
      typing: { text: 'typing' },
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second', 'staged']);
  });

  it('shows a staged EDIT in the row it replaces, not as a second message', () => {
    const result = buildPreviewList({
      visible: published,
      staged: { text: 'second, restyled' },
      stagedReplaces: published[1],
      editing: null,
      typing: null,
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second, restyled']);
  });

  it('appends a staged message that replaces nothing', () => {
    const result = buildPreviewList({
      visible: published,
      staged: { text: 'new one' },
      stagedReplaces: null,
      editing: null,
      typing: null,
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second', 'new one']);
  });

  it('REPLACES the row being edited rather than showing it twice', () => {
    const result = buildPreviewList({
      visible: published,
      staged: null,
      editing: published[1],
      typing: { text: 'second, edited' },
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second, edited']);
  });

  it('appends a brand-new message being typed', () => {
    const result = buildPreviewList({
      visible: published,
      staged: null,
      editing: null,
      typing: { text: 'brand new' },
    });
    expect(result.map((m) => m.text)).toEqual(['first', 'second', 'brand new']);
  });

  it('leaves the list alone when the editor is empty', () => {
    const result = buildPreviewList({
      visible: published,
      staged: null,
      editing: null,
      typing: null,
    });
    expect(result).toEqual(published);
  });
});

describe('chipExcerpt', () => {
  it('strips markup', () => {
    expect(chipExcerpt('<b>Summer sale</b>')).toBe('Summer sale');
  });

  it('clips a long message', () => {
    expect(chipExcerpt('x'.repeat(60))).toBe(`${'x'.repeat(42)}…`);
  });
});

describe('describeWindow', () => {
  it('calls an undated message active and open-ended', () => {
    expect(describeWindow()).toBe('Runs until you stop it');
  });

  it('names the start date of a message that has not begun', () => {
    expect(describeWindow(dayOffset(5))).toMatch(/^Starts /);
  });

  it('shows both ends of a dated run', () => {
    expect(describeWindow(dayOffset(0), dayOffset(10))).toContain('→');
  });
});
