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
      <ul className="matchday-podium-places">
        {scores.map((score, index) => {
          const leaders = eligible.filter((row) => row.points.total === score);
          return (
            <li key={score} className={`matchday-podium-card matchday-podium-card-${index + 1}`}>
              <span className="matchday-podium-rank" aria-label={`Puesto ${index + 1}`}>
                {['🥇', '🥈', '🥉'][index]}
              </span>
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
              {leaders.length === 1 ? (
                <strong className="matchday-podium-name">{leaders[0].name}</strong>
              ) : (
                <details className="matchday-podium-ties">
                  <summary>{leaders.length} empatados</summary>
                  <ul>
                    {leaders.map((row) => (
                      <li key={row.key}>{row.name}</li>
                    ))}
                  </ul>
                </details>
              )}
              <span className="matchday-podium-points">
                {score} <small>pts</small>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
