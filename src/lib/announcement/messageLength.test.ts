import { describe, it, expect } from 'vitest';
import { clipChars, countChars, messageLength, messageText } from '@/lib/announcement/messageLength';

describe('messageLength', () => {
  it('counts a space stored as &nbsp; once, not six times', () => {
    expect(messageLength('a&nbsp;b')).toBe(3);
  });

  it('decodes other entities to the one character they show', () => {
    expect(messageLength('Tom &amp; Jerry')).toBe(11);
    expect(messageText('&lt;3 &#39;hi&#39; &#x2764;')).toBe("<3 'hi' ❤");
  });

  it('ignores formatting tags', () => {
    expect(messageLength('<b>hi</b> <span style="color:red">there</span>')).toBe(8);
  });

  it('counts a whole emoji as one character', () => {
    expect(countChars('👍🏽')).toBe(1);
    expect(countChars('hi 👨‍👩‍👧')).toBe(4);
  });

  it('ignores the zero-width spaces the editor inserts', () => {
    expect(countChars('a​b')).toBe(2);
  });
});

describe('clipChars', () => {
  it('cuts at a character boundary, never inside an emoji', () => {
    expect(clipChars('ab👍🏽cd', 3)).toBe('ab👍🏽');
  });
});
