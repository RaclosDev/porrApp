import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientError, resetErrorReportingForTests } from '../../services/errorReporting';

const beacon = vi.fn<(url: string, data: Blob) => boolean>(() => true);

async function sentBodies() {
  return Promise.all(
    beacon.mock.calls.map(
      async ([, blob]) => JSON.parse(await blob.text()) as Record<string, string>,
    ),
  );
}

describe('reportClientError', () => {
  beforeEach(() => {
    beacon.mockClear();
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    window.history.pushState({}, '', '/ligas/7?code=SECRETO#detalle');
    resetErrorReportingForTests(true);
  });

  afterEach(() => resetErrorReportingForTests(false));

  it('envía tipo, mensaje, traza y la ruta sin consulta ni fragmento', async () => {
    reportClientError('render', new TypeError('x is undefined'), '\n    at Ranking');

    expect(beacon).toHaveBeenCalledWith('/api/client-errors', expect.any(Blob));
    const [body] = await sentBodies();
    expect(body.kind).toBe('render');
    expect(body.message).toBe('TypeError: x is undefined');
    expect(body.stack).toContain('at Ranking');
    expect(body.path).toBe('/ligas/7');
  });

  it('no repite el mismo error y envía como mucho cinco por página', () => {
    reportClientError('error', 'mismo');
    reportClientError('error', 'mismo');
    for (let i = 0; i < 10; i++) reportClientError('unhandledrejection', `fallo ${i}`);

    expect(beacon).toHaveBeenCalledTimes(5);
  });

  it('no envía nada si está desactivado', () => {
    resetErrorReportingForTests(false);
    reportClientError('error', new Error('boom'));

    expect(beacon).not.toHaveBeenCalled();
  });
});
