import { useState } from 'react';
import { Check, X } from 'lucide-react';

// Jornada de ejemplo jugable en la portada: no se guarda nada ni se llama al servidor.

type Sign = '1' | 'X' | '2';

interface DemoMatch {
  home: string;
  away: string;
  score: [number, number];
}

const MATCHES: DemoMatch[] = [
  { home: 'Real Madrid', away: 'Barcelona', score: [2, 2] },
  { home: 'Betis', away: 'Sevilla', score: [1, 0] },
  { home: 'Athletic', away: 'Real Sociedad', score: [0, 1] },
  { home: 'Valencia', away: 'Villarreal', score: [3, 1] },
];

/** Puntos por acertar el signo, como en el baremo por defecto de una liga. */
const SIGN_POINTS = 3;

/** Predicciones fijas de dos amigos de ejemplo, para que la clasificación tenga con quién medirse. */
const FRIENDS: { name: string; picks: Sign[] }[] = [
  { name: 'Ana', picks: ['1', '1', '2', '1'] },
  { name: 'Luis', picks: ['X', 'X', '1', '2'] },
];

const signOf = ([home, away]: [number, number]): Sign =>
  home > away ? '1' : home < away ? '2' : 'X';

const pointsFor = (picks: (Sign | undefined)[]) =>
  picks.reduce((sum, pick, i) => sum + (pick === signOf(MATCHES[i].score) ? SIGN_POINTS : 0), 0);

export default function PredictionDemo() {
  const [picks, setPicks] = useState<(Sign | undefined)[]>(() => MATCHES.map(() => undefined));
  const [revealed, setRevealed] = useState(false);
  const pending = picks.filter((pick) => !pick).length;

  const ranking = [
    { name: 'Tú', points: pointsFor(picks), you: true },
    ...FRIENDS.map((friend) => ({
      name: friend.name,
      points: pointsFor(friend.picks),
      you: false,
    })),
  ].sort((a, b) => b.points - a.points || Number(b.you) - Number(a.you));

  const pick = (index: number, sign: Sign) =>
    setPicks((current) => current.map((value, i) => (i === index ? sign : value)));

  const reset = () => {
    setPicks(MATCHES.map(() => undefined));
    setRevealed(false);
  };

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
      <article className="try-panel" aria-labelledby="try-picks-title">
        <header className="try-panel__head">
          <h3 id="try-picks-title" className="fam-h3">
            Haz tu predicción
          </h3>
          <p className="try-panel__meta">Jornada de ejemplo · 1X2</p>
        </header>
        <ul className="try-matches">
          {MATCHES.map((match, index) => {
            const result = signOf(match.score);
            const hit = revealed && picks[index] === result;
            return (
              <li key={match.home} className="try-match">
                <span className="try-match__teams">
                  <span>{match.home}</span>
                  <span className="try-match__score" aria-live="polite">
                    {revealed ? `${match.score[0]} – ${match.score[1]}` : 'vs'}
                  </span>
                  <span>{match.away}</span>
                </span>
                <span
                  className="try-signs"
                  role="group"
                  aria-label={`Predicción ${match.home} contra ${match.away}`}
                >
                  {(['1', 'X', '2'] as const).map((sign) => (
                    <button
                      key={sign}
                      type="button"
                      className={`try-sign${revealed && sign === result ? ' is-result' : ''}`}
                      aria-pressed={picks[index] === sign}
                      disabled={revealed}
                      onClick={() => pick(index, sign)}
                    >
                      {sign}
                    </button>
                  ))}
                  {revealed && (
                    <span className={`try-verdict${hit ? ' is-hit' : ''}`}>
                      {hit ? (
                        <>
                          <Check size={16} aria-hidden="true" />+{SIGN_POINTS}
                        </>
                      ) : (
                        <>
                          <X size={16} aria-hidden="true" />
                          <span className="sr-only">Fallo</span>0
                        </>
                      )}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        {revealed ? (
          <button type="button" className="fam-btn fam-btn--block" onClick={reset}>
            Jugar otra vez
          </button>
        ) : (
          <button
            type="button"
            className="fam-btn fam-btn--ink fam-btn--block"
            disabled={pending > 0}
            onClick={() => setRevealed(true)}
          >
            {pending > 0
              ? `Te ${pending === 1 ? 'falta 1 partido' : `faltan ${pending} partidos`}`
              : 'Ver los resultados'}
          </button>
        )}
      </article>

      <article className="try-panel" aria-labelledby="try-table-title">
        <header className="try-panel__head">
          <h3 id="try-table-title" className="fam-h3">
            Clasificación
          </h3>
          <p className="try-panel__meta">{SIGN_POINTS} puntos por signo acertado</p>
        </header>
        {revealed ? (
          <ol className="try-table" aria-live="polite">
            {ranking.map((row, index) => (
              <li key={row.name} className={row.you ? 'is-you' : undefined}>
                <span className="try-table__pos">{index + 1}</span>
                <span>{row.name}</span>
                <span className="try-table__pts">{row.points} pts</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="try-empty">
            Elige 1, X o 2 en cada partido y mira cómo quedas frente a Ana y Luis. Así se vive cada
            jornada en tu liga: los puntos llegan solos con los resultados.
          </p>
        )}
        {revealed && ranking[0].you && (
          <p className="try-stamp" role="status">
            {ranking[0].points > ranking[1].points ? '¡Líder de la jornada!' : '¡Empate en cabeza!'}
          </p>
        )}
      </article>
    </div>
  );
}
