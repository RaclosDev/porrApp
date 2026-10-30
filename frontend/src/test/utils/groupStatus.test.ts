import { describe, expect, it } from 'vitest';
import { isMathematicallyEliminated, isMathematicallyQualified } from '../../utils/groupStatus';

describe('groupStatus', () => {
  it('treats a locked first or second place as qualified', () => {
    expect(isMathematicallyQualified(1)).toBe(true);
    expect(isMathematicallyQualified(2)).toBe(true);
    expect(isMathematicallyQualified(5)).toBe(true);
  });

  it('does not mark open, third-placed or eliminated teams as qualified', () => {
    [0, 3, 4, -1, null, undefined].forEach((s) => expect(isMathematicallyQualified(s)).toBe(false));
  });

  it('treats a locked fourth place as eliminated', () => {
    expect(isMathematicallyEliminated(4)).toBe(true);
    expect(isMathematicallyEliminated(-1)).toBe(true);
    [0, 1, 2, 3, 5].forEach((s) => expect(isMathematicallyEliminated(s)).toBe(false));
  });
});
