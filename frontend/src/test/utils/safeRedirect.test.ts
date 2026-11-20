import { expect, it } from 'vitest';
import { safeRedirect } from '../../utils/safeRedirect';

it('accepts internal paths with query and hash', () => {
  expect(safeRedirect('/crear-liga')).toBe('/crear-liga');
  expect(safeRedirect('/mis-ligas?group=3#top')).toBe('/mis-ligas?group=3#top');
});

it.each([
  null,
  undefined,
  '',
  'crear-liga',
  '//evil.com',
  'https://evil.com',
  '/' + String.fromCharCode(92) + 'evil.com',
  '/a\nb',
])('rejects %s', (value) => {
  expect(safeRedirect(value)).toBeUndefined();
});

it('rejects /login to avoid loops', () => {
  expect(safeRedirect('/login')).toBeUndefined();
  expect(safeRedirect('/login?redirect=/x')).toBeUndefined();
});
