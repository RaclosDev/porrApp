import { describe, expect, it } from 'vitest';
import { ApiError } from '../../services/apiError';
import { featuredGroupQuery } from '../../services/queries';

const retry = featuredGroupQuery().retry as (failureCount: number, error: Error) => boolean;

describe('featuredGroupQuery', () => {
  it('no reintenta cuando no hay liga pública destacada', () => {
    expect(retry(0, new ApiError(404, 'Not found'))).toBe(false);
  });

  it('reintenta fallos transitorios hasta tres veces', () => {
    expect(retry(0, new ApiError(502, 'Bad gateway'))).toBe(true);
    expect(retry(2, new TypeError('Failed to fetch'))).toBe(true);
    expect(retry(3, new ApiError(502, 'Bad gateway'))).toBe(false);
  });
});
