import StickerCard from './StickerCard';
import { UserAvatar } from './Avatar';
import type { LeaderboardRow } from '../hooks/useLeaderboard';

/** Puntos que cuentan para el podio: el total o los de la jornada elegida. */
export type PodiumScore = 'total' | 'matchday';

/**
 * Tres primeros puestos por puntos entre los que han pagado, con los empates juntos. Igual que
 * las medallas de la tabla: cuenta también quien va tercero con 0 puntos. Sin podio mientras
 * nadie ha puntuado, para no mostrar un empate de toda la liga a cero.
 */
export function podiumPlaces(rows: LeaderboardRow[], by: PodiumScore = 'total') {
  const eligible = rows.filter((row) => row.paid);
  const scoreOf = (row: LeaderboardRow) => Number(row.points[by]) || 0;
  const scores = [...new Set(eligible.map(scoreOf))].sort((a, b) => b - a).slice(0, 3);
  if (!scores.length || scores[0] <= 0) return [];
  return scores.map((score) => ({
    score,
    leaders: eligible.filter((row) => scoreOf(row) === score),
  }));
}

/** Podio de la clasificación, el mismo en todos los formatos de liga. */
export default function MatchdayPodium({
  rows,
  by = 'total',
  label = 'Podio de la clasificación general',
}: {
  rows: LeaderboardRow[];
  by?: PodiumScore;
  label?: string;
}) {
  const places = podiumPlaces(rows, by);
  if (places.length === 0) return null;

  return (
    <section className="matchday-podium" aria-label={label}>
      <ul className="ranking-podium">
        {places.map(({ score, leaders }, index) => {
          return (
            <li key={score} className={`ranking-podium-place ranking-podium-place-${index + 1}`}>
              <StickerCard
                leader={{
                  rank: index + 1,
                  name: leaders.length === 1 ? leaders[0].name : 'Empate',
                  userId: leaders[0].userId,
                  avatarUrl: leaders[0].avatarUrl,
                  total: score,
                }}
                featured={index === 0}
                compact
                avatar={
                  leaders.length > 1 ? (
                    <div className="matchday-podium-avatars" aria-hidden="true">
                      {leaders.slice(0, 3).map((row) => (
                        <UserAvatar
                          key={row.key}
                          url={row.avatarUrl}
                          userId={row.userId}
                          name={row.name}
                          size={36}
                        />
                      ))}
                    </div>
                  ) : undefined
                }
              >
                {leaders.length > 1 && (
                  <details className="matchday-podium-ties">
                    <summary>{leaders.length} empatados</summary>
                    <ul>
                      {leaders.map((row) => (
                        <li key={row.key}>{row.name}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </StickerCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
