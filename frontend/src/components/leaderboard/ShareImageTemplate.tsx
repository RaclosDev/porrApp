import { useMemo } from 'react';
import { UserAvatar } from '../Avatar';
import StickerCard from '../StickerCard';
import { podiumPlaces } from '../MatchdayPodium';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { isOwnRow, rankLabel } from './leaderboardColumns';

interface ShareImageTemplateProps {
  /** Filas pagadas: las que aparecen en la imagen. */
  rows: LeaderboardRow[];
  competitionName: string | null;
  leagueName: string;
  lowestPaidRank: number;
  userId: string | number | null | undefined;
  userName: string | null | undefined;
}

/**
 * Plantilla de la imagen que se comparte (html2canvas la lee por su id). Queda fuera de la
 * pantalla: no la ve nadie ni la leen los lectores de pantalla.
 */
export default function ShareImageTemplate({
  rows,
  competitionName,
  leagueName,
  lowestPaidRank,
  userId,
  userName,
}: ShareImageTemplateProps) {
  // Mismo podio en todos los formatos: los empates comparten cromo en vez de ocultar el podio.
  const podium = useMemo(
    () =>
      podiumPlaces(rows).map(({ score, leaders: members }, index) => {
        const first = members[0];
        return {
          leader: {
            rank: index + 1,
            name: members.length === 1 ? first.name : 'Empate',
            userId: first.userId,
            avatarUrl: first.avatarUrl,
            total: score,
          },
          members,
        };
      }),
    [rows],
  );
  const rest = rows.filter(
    (row) => !podium.some(({ leader }) => leader.total === row.points.total),
  );
  const half = Math.ceil(rest.length / 2);

  const shareRow = (r: LeaderboardRow) => {
    const isMe = isOwnRow(r, userId, userName);
    return (
      <div
        data-share-row
        className={`share-image-ranking-row flex items-center justify-between py-2 px-3 rounded-[8px] ${isMe ? 'bg-[rgba(11,_95,_116,_0.08)] bg-none border border-accent' : 'bg-panel bg-none border border-line'}`}
        key={r.key}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[1.2rem] font-bold w-7.5 text-center text-accent-text">
            {rankLabel(r.rank, lowestPaidRank, r.points.total)}
          </span>
          <span className="text-[1.1rem] font-bold text-main">{r.name}</span>
        </div>
        <span className="text-[1.2rem] font-bold text-accent-text">{r.points.total} pts</span>
      </div>
    );
  };

  return (
    <div
      className="absolute -top-[9999px] -left-[9999px] w-200 p-7.5 paper-panel bg-[var(--paper)] bg-none text-main box-border rounded-[4px]"
      id="share-image-template"
      aria-hidden="true"
      style={{ fontFamily: "'Outfit', sans-serif" }}
    >
      <div className="text-center mb-5 border-b-2 border-b-[var(--ink)] pb-2.5">
        <h1 className="text-accent-text m-0 text-[28px] uppercase">
          {competitionName ? `Porra ${competitionName}` : 'PorrApp'}
        </h1>
        <p className="text-muted mt-[5px] mb-0 mx-0 text-[18px] font-bold">
          Clasificación: {leagueName}
        </p>
      </div>
      {podium.length > 0 && (
        <ul className="ranking-podium share-image-podium" aria-label="Podio de la clasificación">
          {podium.map(({ leader, members }) => (
            <li
              className={`ranking-podium-place ranking-podium-place-${leader.rank}`}
              key={`${leader.rank}-${leader.total}`}
            >
              <StickerCard
                leader={leader}
                featured={leader.rank === 1}
                compact
                staticCard
                className="share-image-podium-card"
              >
                {members.length > 1 && (
                  <div className="share-image-podium-tie">
                    <div className="matchday-podium-avatars" aria-hidden="true">
                      {members.slice(0, 3).map((member) => (
                        <UserAvatar
                          key={member.key}
                          url={member.avatarUrl}
                          name={member.name}
                          size={32}
                        />
                      ))}
                    </div>
                    <span>{members.map((member) => member.name).join(' · ')}</span>
                  </div>
                )}
              </StickerCard>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-5 justify-between" id="share-image-columns">
        <div className="flex-1 flex flex-col gap-2" id="share-col-left">
          {rest.slice(0, half).map(shareRow)}
        </div>
        <div className="flex-1 flex flex-col gap-2" id="share-col-right">
          {rest.slice(half).map(shareRow)}
        </div>
      </div>
    </div>
  );
}
