/** Mensaje de un error capturado (`catch` recibe `unknown`), o el texto por defecto. */
export const errorMessage = (err: unknown, fallback: string): string =>
  (err instanceof Error && err.message) || fallback;
