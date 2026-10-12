import { describe, expect, it } from 'vitest';
import { getSharedPayload } from './share';

describe('share target', () => {
  it('reads shared SMS text', () => {
    const p = getSharedPayload('?text=BML%3A+MVR+250.00+debited+at+STO&title=BML');
    expect(p?.text).toContain('MVR 250.00');
  });
  it('returns null when nothing shared', () => {
    expect(getSharedPayload('')).toBeNull();
    expect(getSharedPayload('?foo=bar')).toBeNull();
  });
  it('combines title and text', () => {
    const p = getSharedPayload('?title=455&text=hello');
    expect(p?.text).toContain('455');
    expect(p?.text).toContain('hello');
  });
});
