import StickerCard from './StickerCard';
import { UserAvatar } from './Avatar';
import type { LeaderboardRow } from '../hooks/useLeaderboard';

/** Agrupa los empates sin elegir un ganador arbitrario ni depender del orden de la tabla. */
export default function MatchdayPodium({ rows }: { rows: LeaderboardRow[] }) {
  const eligible = rows.filter((row) => row.paid && row.points.total > 0);
  const scores = [...new Set(eligible.map((row) => row.points.total))]
    .sort((a, b) => b - a)
    .slice(0, 3);
  if (scores.length === 0) return null;

  return (
    <section className="matchday-podium" aria-label="Podio de la clasificación general">
      <ul className="ranking-podium">
        {scores.map((score, index) => {
          const leaders = eligible.filter((row) => row.points.total === score);
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
