/**
 * Envía al backend los errores no controlados del navegador, que solo los escribe en su log. Sin esto, un
 * fallo en el móvil de un usuario es invisible. No se manda nada que identifique al usuario: solo el tipo,
 * el mensaje, la traza y la ruta sin consulta ni fragmento.
 */
const ENDPOINT = '/api/client-errors';
const MAX_REPORTS_PER_PAGE = 5;

type ErrorKind = 'error' | 'unhandledrejection' | 'render';

const sent = new Set<string>();
// En desarrollo y en los tests los errores ya se ven en la consola.
let enabled = import.meta.env.PROD;

function describe(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error)
    return { message: `${reason.name}: ${reason.message}`, stack: reason.stack };
  if (typeof reason === 'string') return { message: reason };
  try {
    return { message: JSON.stringify(reason) ?? String(reason) };
  } catch {
    return { message: String(reason) };
  }
}

export function reportClientError(kind: ErrorKind, reason: unknown, extraStack?: string): void {
  if (!enabled) return;
  const { message, stack } = describe(reason);
  const key = `${kind}:${message}`;
  if (sent.has(key) || sent.size >= MAX_REPORTS_PER_PAGE) return;
  sent.add(key);

  const body = JSON.stringify({
    kind,
    message: message.slice(0, 500),
    stack: [stack, extraStack].filter(Boolean).join('\n').slice(0, 2000),
    path: window.location.pathname,
  });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
    void fetch(ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Informar de un error nunca debe provocar otro.
  }
}

/** Escucha los errores y promesas rechazadas que no captura nadie. */
export function installErrorReporting(): void {
  window.addEventListener('error', (event) => {
    // Los fallos al cargar un recurso (imagen, script) no traen error y no interesan aquí.
    if (event.error === undefined && !event.message) return;
    reportClientError('error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError('unhandledrejection', event.reason);
  });
}

/** Solo para tests. */
export function resetErrorReportingForTests(enable: boolean): void {
  sent.clear();
  enabled = enable;
}
