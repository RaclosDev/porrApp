/** Formatos compartidos del panel de gestión. */
export const dateTime = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

export const timeOnly = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Madrid',
});

export const shortDay = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

export const KIND_LABELS: Record<string, string> = {
  POOL: 'Porras',
  SCOREBOARD: 'Marcadores',
  TOURNAMENT: 'Torneos',
  POKER: 'Póker',
};

export const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind;

export const METHOD_LABELS: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  email: 'Email',
};

/** Busca sin distinguir mayúsculas ni tildes. */
export const normalize = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
