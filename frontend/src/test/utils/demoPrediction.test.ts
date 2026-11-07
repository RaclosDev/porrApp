import { describe, expect, it } from 'vitest';
import { leaderPredictionId } from '../../utils/demoPrediction';
import type { ParticipantScore } from '../../types/api';

const row = (id: number, total: number) => ({ id, total }) as ParticipantScore;

describe('leaderPredictionId', () => {
  it('picks the prediction with the most points, whatever the order', () => {
    expect(leaderPredictionId([row(3, 1500), row(7, 1905), row(1, 1680)])).toBe('7');
  });

  it('keeps the first one the server lists on a tie', () => {
    expect(leaderPredictionId([row(4, 1800), row(9, 1800)])).toBe('4');
  });

  it('returns null without a ranking', () => {
    expect(leaderPredictionId([])).toBeNull();
  });
});
