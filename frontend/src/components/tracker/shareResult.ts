import toast from 'react-hot-toast';
import type { TrackerSession, TrackerStanding } from '../../services/endpoints/trackers';
import { standingsFrom } from './seasonStandings';
import { winnerLabel } from './trackerFormat';

export interface ResultCard {
  /** Liga o juego, arriba y pequeño. */
  title: string;
  /** Qué se comparte: la partida o el día. */
  subtitle: string;
  /** Quién ha ganado, en grande. */
  headline: string;
  rows: { rank: number; name: string; value: string }[];
}

const WIDTH = 1080;
const ROW = 84;
const PAPER = '#f3ecdc';
const INK = '#1f2a1f';
const ACCENT = '#b5412b';

/** Tarjeta de una partida terminada: ganador y puntos de cada uno. */
export const sessionCard = (
  league: string,
  game: string,
  unit: string,
  session: TrackerSession,
): ResultCard => ({
  title: league,
  subtitle: `${game} · partida ${session.number}`,
  headline: winnerLabel(session),
  rows: session.standings.map((row) => ({
    rank: row.rank,
    name: row.name,
    value: `${row.total} ${unit}`,
  })),
});

/** Tarjeta de un día de juego: quién ganó más partidas ese día. */
export const dayCard = (league: string, day: string, sessions: TrackerSession[]): ResultCard => {
  const standings: TrackerStanding[] = standingsFrom(sessions.filter((session) => session.endedAt));
  const leaders = standings.filter((row) => row.rank === 1 && row.sessionsWon > 0);
  return {
    title: league,
    subtitle: `Día de juego · ${day}`,
    headline:
      leaders.length === 0
        ? `${sessions.length} ${sessions.length === 1 ? 'partida' : 'partidas'}`
        : `Gana ${leaders.map((row) => row.name).join(' y ')}`,
    rows: standings.map((row) => ({
      rank: row.rank,
      name: row.name,
      value: `${row.sessionsWon} de ${row.sessionsPlayed ?? 0} ganadas`,
    })),
  };
};

function draw(card: ResultCard): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = 380 + card.rows.length * ROW;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no puede crear la imagen');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 36px system-ui, sans-serif';
  ctx.fillText(card.title, 72, 100, WIDTH - 144);
  ctx.font = '400 32px system-ui, sans-serif';
  ctx.fillText(card.subtitle, 72, 150, WIDTH - 144);
  ctx.fillStyle = ACCENT;
  ctx.font = '800 64px system-ui, sans-serif';
  ctx.fillText(card.headline, 72, 240, WIDTH - 144);
  card.rows.forEach((row, index) => {
    const y = 330 + index * ROW;
    ctx.fillStyle = INK;
    ctx.font = `${row.rank === 1 ? 800 : 500} 40px system-ui, sans-serif`;
    ctx.fillText(`${row.rank}.`, 72, y);
    ctx.fillText(row.name, 160, y, 520);
    ctx.textAlign = 'right';
    ctx.fillText(row.value, WIDTH - 72, y);
    ctx.textAlign = 'left';
  });
  ctx.font = '400 26px system-ui, sans-serif';
  ctx.fillText('Apuntado con porrApp', 72, canvas.height - 40);
  return canvas;
}

/** Comparte la tarjeta como imagen; si el navegador no comparte archivos, la descarga. */
export async function shareResult(card: ResultCard): Promise<void> {
  try {
    const canvas = draw(card);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo generar la imagen');
    const fileName = `${card.subtitle.replace(/[^\p{L}\p{N}]+/gu, '_')}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${card.title}: ${card.headline}` });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = fileName;
    link.href = url;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    toast.error('No se pudo crear la imagen del resultado');
  }
}
