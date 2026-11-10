import type { TrackerSession } from '../../services/endpoints/trackers';

/** «jueves, 12 de noviembre» */
export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

/** Quién ha ganado una partida terminada: «Gana Berto», «Ganan Ana y Berto» o «Sin ganador». */
export const winnerLabel = (session: TrackerSession) => {
  const names = session.winners
    .map((id) => session.standings.find((row) => row.playerId === id)?.name)
    .filter(Boolean);
  if (names.length === 0) return 'Sin ganador';
  return `${names.length > 1 ? 'Ganan' : 'Gana'} ${names.join(' y ')}`;
};
