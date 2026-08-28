// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  buildTimerDisplayHtml,
  refreshTimerValueSpans,
  serializeTimerHtml,
  syncTimerElement,
} from '@/lib/editor/timerUtils';

/**
 * The countdown's markup: building it for the screen, and reducing it back to
 * what gets stored.
 *
 * jsdom, and only this file — the other suites run in plain node, which is
 * faster and proves those functions need no browser. Declared with the
 * `@vitest-environment` comment at the top rather than globally, so the choice
 * is visible in the file that needs it.
 *
 * These three are where the countdown's hardest defects have lived: a chip
 * rendered twice, styling lost on save, the caret thrown to the start of the
 * field while someone was typing in it.
 */

const AT = { days: 2, hours: 7, minutes: 11, seconds: 0 };
const el = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d;
};

describe('buildTimerDisplayHtml', () => {
  it('puts the countdown where the marker is, keeping the words either side', () => {
    const out = el(buildTimerDisplayHtml('Ends in {timer} — hurry', AT, { editorSlots: false }));
    expect(out.textContent).toBe('Ends in 2 days : 7 hours : 11 mins — hurry');
  });

  it('appends a countdown when the text has no marker at all', () => {
    const out = el(buildTimerDisplayHtml('Ends soon', AT, { editorSlots: false }));
    expect(out.querySelectorAll('[data-timer-fixed]')).toHaveLength(1);
    expect(out.textContent).toContain('Ends soon');
  });

  it('builds exactly ONE countdown, never two', () => {
    // A second chip is the visible form of several past defects: a stored
    // marker left beside a rendered chip, or a rebuild over an existing one.
    const once = buildTimerDisplayHtml('Ends in {timer}', AT, { editorSlots: false });
    const twice = buildTimerDisplayHtml(once, AT, { editorSlots: false });
    expect(el(twice).querySelectorAll('[data-timer-fixed]')).toHaveLength(1);
  });

  it('keeps the styling the user put on the words either side', () => {
    const out = buildTimerDisplayHtml(
      '<span style="color:red">Ends in</span> {timer}', AT, { editorSlots: false },
    );
    expect(out).toContain('color:red');
  });

  it('leaves out the editor slot spans when they are not asked for', () => {
    // Those slots are styled display:inline-block, and CSS collapses a
    // trailing space at the end of one — which is how a preview lost the gap
    // and read "Ends in2 days".
    const preview = buildTimerDisplayHtml('Ends in {timer}', AT, { editorSlots: false });
    expect(preview).not.toContain('data-timer-prefix');

    const editor = buildTimerDisplayHtml('Ends in {timer}', AT);
    expect(editor).toContain('data-timer-prefix');
  });
});

describe('serializeTimerHtml', () => {
  const rendered = buildTimerDisplayHtml('Ends in {timer} now', AT);

  it('KEEPS the chip block rather than reducing it to a marker', () => {
    // Deliberate, and easy to get backwards. Storage keeps the chip's per-word
    // spans so per-cell styling survives a save — reducing it to {timer} would
    // throw away a colour applied to just the hours. The Lexical field's own
    // serializer emits the token form instead, so BOTH shapes exist in stored
    // cards and buildTimerDisplayHtml accepts either.
    const stored = serializeTimerHtml(rendered);
    expect(stored).toContain('data-timer-fixed');
    expect(stored).toContain('data-timer-val');
  });

  it('accepts the other stored shape too — the bare marker', () => {
    const fromToken = buildTimerDisplayHtml('Ends in {timer}', AT, { editorSlots: false });
    expect(el(fromToken).querySelectorAll('[data-timer-fixed]')).toHaveLength(1);
    expect(el(fromToken).textContent).toBe('Ends in 2 days : 7 hours : 11 mins');
  });

  it('stores no live numbers — they would be wrong a second later', () => {
    const stored = serializeTimerHtml(rendered);
    expect(stored).not.toContain('2 days');
    expect(stored).not.toContain('7 hours');
  });

  it('keeps the words either side', () => {
    const stored = serializeTimerHtml(rendered);
    expect(stored).toContain('Ends in');
    expect(stored).toContain('now');
  });

  it('drops the editor-only slot spans', () => {
    expect(serializeTimerHtml(rendered)).not.toContain('data-timer-prefix');
  });

  it('survives a round trip: build, store, build again', () => {
    const again = buildTimerDisplayHtml(serializeTimerHtml(rendered), AT, { editorSlots: false });
    expect(el(again).textContent).toBe('Ends in 2 days : 7 hours : 11 mins now');
    expect(el(again).querySelectorAll('[data-timer-fixed]')).toHaveLength(1);
  });
});

describe('refreshTimerValueSpans', () => {
  it('updates only the numbers, leaving the words and their styling alone', () => {
    const node = el(buildTimerDisplayHtml(
      '<span style="color:red">Ends in</span> {timer}', AT, { editorSlots: false },
    ));
    refreshTimerValueSpans(node, { days: 1, hours: 3, minutes: 5, seconds: 0 });
    expect(node.textContent).toBe('Ends in 1 days : 3 hours : 5 mins');
    expect(node.innerHTML).toContain('color:red');
  });
});

describe('syncTimerElement', () => {
  it('writes the countdown into an element that is not being typed in', () => {
    const node = el('');
    syncTimerElement(node, 'Ends in {timer}', '2030-01-01', null);
    expect(node.textContent).toContain('Ends in');
    expect(node.querySelectorAll('[data-timer-fixed]')).toHaveLength(1);
  });

  it('leaves the element alone while it IS the one being edited', () => {
    // Replacing innerHTML under the caret throws it to the start of the field.
    // The countdown catches up when focus leaves.
    const node = el('<b>mid-edit</b>');
    syncTimerElement(node, 'Ends in {timer}', '2030-01-01', node);
    expect(node.innerHTML).toBe('<b>mid-edit</b>');
  });

  it('does nothing when there is no element', () => {
    expect(() => syncTimerElement(null, 'Ends in {timer}', '2030-01-01', null)).not.toThrow();
  });
});
