import { useState } from 'react';
import Flag from '../Flag';
import InkStamp from '../InkStamp';
import { formatMatchDate } from '../../utils/matchday';
import { VoterStack } from '../voters/SignVoters';
import MatchVotersModal from '../voters/MatchVotersModal';
import { useMatchVoters } from '../../hooks/useMatchVoters';
import type { Match, MatchVoter } from '../../types/api';

interface FeaturedMatchBannerProps {
  featuredMatch: Match;
  /** Nombre de la ronda del cruce («Cuartos de final»…). */
  roundTitle?: string | null;
  /** Escudos que no vienen en el partido (equipos de competiciones personalizadas). */
  homeLogo?: string | null;
  awayLogo?: string | null;
  /** Las competiciones personalizadas esperan a que el administrador introduzca el resultado. */
  manualResults?: boolean;
  /** Liga cuyos pronósticos se muestran: con el cruce cerrado, quién da por ganador a cada equipo. */
  groupId?: string | number | null;
}

/** Escudo un poco mayor que en las casillas; las banderas conservan su proporción. */
const emblemStyle = (logo: string | null | undefined) => ({
  width: '32px',
  height: logo ? '32px' : '24px',
});

/** Aviso del próximo partido de eliminatorias. */
export default function FeaturedMatchBanner({
  featuredMatch,
  roundTitle,
  homeLogo,
  awayLogo,
  manualResults = false,
  groupId = null,
}: FeaturedMatchBannerProps) {
  const [showVoters, setShowVoters] = useState(false);
  const voters = useMatchVoters(groupId, featuredMatch.id ? [featuredMatch.id] : []).get(
    featuredMatch.id,
  );
  const home = featuredMatch.home || 'Por definir';
  const away = featuredMatch.away || 'Por definir';
  const resolvedHomeLogo = homeLogo || featuredMatch.homeLogo || featuredMatch.homeTeamLogo;
  const resolvedAwayLogo = awayLogo || featuredMatch.awayLogo || featuredMatch.awayTeamLogo;
  const hasScore = featuredMatch.homeScore != null && featuredMatch.awayScore != null;
  const started = Boolean(featuredMatch.date && new Date(featuredMatch.date) <= new Date());

  const live = started && !featuredMatch.finished;
  let heading = 'Próximo partido del cuadro';
  if (live) heading = manualResults ? 'Partido pendiente de resultado' : 'En directo en el cuadro';
  // El título ya dice si está en juego; solo se añade el minuto real si lo hay, o «Final».
  const clock = live && !manualResults ? featuredMatch.displayClock : null;

  const renderTeam = (
    name: string,
    logo: string | null | undefined,
    list: MatchVoter[] | undefined,
  ) => (
    <div className="flex flex-col items-center gap-1.5 min-w-0 text-center">
      <Flag team={name} logo={logo} style={emblemStyle(logo)} />
      <span
        title={name}
        className="text-main font-bold text-[0.95rem] leading-tight line-clamp-2 break-words max-w-full"
      >
        {name}
      </span>
      {voters && (
        <VoterStack
          list={list ?? []}
          label={name}
          matchName={`${home} - ${away}`}
          onOpen={() => setShowVoters(true)}
        />
      )}
    </div>
  );

  return (
    <section
      aria-label={heading}
      className="paper-panel album-sheet w-full max-w-145 mt-0 mb-3 mx-auto py-3 px-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-x-3 gap-y-1 flex-wrap">
        <h2 className="album-sheet-title m-0 text-[1.05rem]">{heading}</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end text-muted font-bold text-[0.8rem]">
          {featuredMatch.finished && (
            <InkStamp tone="ink" size="sm">
              Final
            </InkStamp>
          )}
          {clock && <InkStamp size="sm">{clock}</InkStamp>}
          <span className="first-letter:uppercase">
            {[roundTitle, formatMatchDate(featuredMatch.date)].filter(Boolean).join(' · ')}
          </span>
        </div>
      </div>

      <div className="last-match-teams">
        {renderTeam(home, resolvedHomeLogo, voters?.home)}
        {hasScore ? (
          <span className="last-match-score min-w-0">
            {featuredMatch.homeScore} - {featuredMatch.awayScore}
          </span>
        ) : (
          <span className="text-[0.9em] text-muted font-bold">VS</span>
        )}
        {renderTeam(away, resolvedAwayLogo, voters?.away)}
      </div>

      {voters && (
        <MatchVotersModal
          twoWay
          voters={showVoters ? voters : null}
          homeTeam={home}
          awayTeam={away}
          homeLogo={resolvedHomeLogo}
          awayLogo={resolvedAwayLogo}
          homeScore={featuredMatch.homeScore}
          awayScore={featuredMatch.awayScore}
          live={live}
          status={featuredMatch.finished ? 'Final' : live ? clock || 'En directo' : undefined}
          onClose={() => setShowVoters(false)}
        />
      )}
    </section>
  );
}
