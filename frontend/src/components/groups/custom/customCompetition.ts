import type { Match } from '../../../types/api';

export type CustomTab = 'summary' | 'teams' | 'matches' | 'results';

/** Ejecuta un cambio contra la API, refresca los datos y avisa; devuelve si se ha guardado. */
export type SaveAction = (action: () => Promise<unknown>, success: string) => Promise<boolean>;

/** Un cruce con un solo equipo: pasa de ronda sin jugar. */
export const isBye = (match: Match) => match.round?.startsWith('bracket-') && !match.away_team_id;

export const isKnockout = (match: Match) => Boolean(match.round?.startsWith('bracket-'));

export const roundNumber = (match: Match) =>
  isKnockout(match) ? Number(match.round.substring(8)) : 0;

/** Título de la fase de un partido: grupo, ronda del cuadro o jornada. */
export const phaseLabel = (match: Match) => {
  if (isKnockout(match)) return `Ronda ${roundNumber(match)}`;
  if (match.groupName) return `Grupo ${match.groupName}`;
  return 'Jornadas';
};

/** Fecha corta para listas: «sáb 12 oct, 18:00». */
export const formatMatchDate = (date: string | null) => {
  if (!date) return 'Sin fecha';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Agrupa partidos por fase en orden: grupos, luego rondas del cuadro, cada uno por fecha. */
export const groupByPhase = (matches: Match[]) => {
  const sorted = [...matches].sort(
    (a, b) =>
      Number(isKnockout(a)) - Number(isKnockout(b)) ||
      roundNumber(a) - roundNumber(b) ||
      (a.groupName ?? '').localeCompare(b.groupName ?? '') ||
      (a.date ?? '').localeCompare(b.date ?? '') ||
      a.id - b.id,
  );
  const phases: { label: string; matches: Match[] }[] = [];
  for (const match of sorted) {
    const label = phaseLabel(match);
    const last = phases[phases.length - 1];
    if (last?.label === label) last.matches.push(match);
    else phases.push({ label, matches: [match] });
  }
  return phases;
};
