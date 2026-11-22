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

/** Caras que caben en la pila de un empate; el resto se cuenta en un «+N». */
const TIE_FACES = 3;

/** «Ana y Luis», «Ana, Luis y Sara» o, si son más, «Ana, Luis y 3 más». */
export function tieNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  const shown = names.length > TIE_FACES ? names.slice(0, 2) : names.slice(0, -1);
  const rest = names.length > TIE_FACES ? `${names.length - 2} más` : names[names.length - 1];
  return `${shown.join(', ')} y ${rest}`;
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
          const tied = leaders.length > 1;
          const hidden = leaders.length - TIE_FACES;
          const faceSize = index === 0 ? 52 : 40;
          return (
            <li key={score} className={`ranking-podium-place ranking-podium-place-${index + 1}`}>
              <StickerCard
                leader={{
                  rank: index + 1,
                  name: tied ? tieNames(leaders.map((row) => row.name)) : leaders[0].name,
                  userId: leaders[0].userId,
                  avatarUrl: leaders[0].avatarUrl,
                  total: score,
                }}
                featured={index === 0}
                compact
                avatar={
                  tied ? (
                    <div
                      className="matchday-podium-faces"
                      title={leaders.map((row) => row.name).join(', ')}
                    >
                      {leaders.slice(0, hidden > 0 ? TIE_FACES - 1 : TIE_FACES).map((row) => (
                        <UserAvatar
                          key={row.key}
                          url={row.avatarUrl}
                          userId={row.userId}
                          name={row.name}
                          size={faceSize}
                        />
                      ))}
                      {hidden > 0 && (
                        <span
                          className="matchday-podium-more"
                          style={{ width: faceSize, height: faceSize }}
                          aria-hidden="true"
                        >
                          +{hidden + 1}
                        </span>
                      )}
                    </div>
                  ) : undefined
                }
              >
                {tied && <span className="matchday-podium-tie">Empate · {leaders.length}</span>}
              </StickerCard>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
