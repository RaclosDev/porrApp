import Flag from '../Flag';
import InkStamp from '../InkStamp';
import { formatMatchDate } from '../../utils/matchday';
import type { Match } from '../../types/api';

interface FeaturedMatchBannerProps {
  featuredMatch: Match;
  /** Nombre de la ronda del cruce («Cuartos de final»…). */
  roundTitle?: string | null;
  /** Escudos que no vienen en el partido (equipos de competiciones personalizadas). */
  homeLogo?: string | null;
  awayLogo?: string | null;
  /** Las competiciones personalizadas esperan a que el administrador introduzca el resultado. */
  manualResults?: boolean;
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
}: FeaturedMatchBannerProps) {
  const home = featuredMatch.home || 'Por definir';
  const away = featuredMatch.away || 'Por definir';
  const resolvedHomeLogo = homeLogo || featuredMatch.homeLogo || featuredMatch.homeTeamLogo;
  const resolvedAwayLogo = awayLogo || featuredMatch.awayLogo || featuredMatch.awayTeamLogo;
  const hasScore = featuredMatch.homeScore != null && featuredMatch.awayScore != null;
  const started = Boolean(featuredMatch.date && new Date(featuredMatch.date) <= new Date());

  let status: string | null = null;
  if (featuredMatch.finished) status = 'Final';
  else if (started)
    status = manualResults ? 'Resultado pendiente' : featuredMatch.displayClock || 'En juego';

  const live = started && !featuredMatch.finished;
  let heading = 'Próximo partido del cuadro';
  if (live) heading = manualResults ? 'Partido pendiente de resultado' : 'En directo en el cuadro';

  const renderTeam = (name: string, logo: string | null | undefined) => (
    <div className="flex flex-col items-center gap-1.5 min-w-0 text-center">
      <Flag team={name} logo={logo} style={emblemStyle(logo)} />
      <span
        title={name}
        className="text-main font-bold text-[0.95rem] leading-tight line-clamp-2 break-words max-w-full"
      >
        {name}
      </span>
    </div>
  );

  return (
    <section
      aria-label={heading}
      className="paper-panel album-sheet w-full max-w-145 mt-0 mb-3 mx-auto py-3 px-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="album-sheet-title m-0 text-[1.05rem]">{heading}</h2>
        {roundTitle && <span className="text-muted font-bold text-[0.8rem]">{roundTitle}</span>}
      </div>

      <div className="last-match-teams">
        {renderTeam(home, resolvedHomeLogo)}
        {hasScore ? (
          <span className="last-match-score min-w-0">
            {featuredMatch.homeScore} - {featuredMatch.awayScore}
          </span>
        ) : (
          <span className="text-[0.9em] text-muted font-bold">VS</span>
        )}
        {renderTeam(away, resolvedAwayLogo)}
      </div>

      <div className="flex items-center justify-center gap-2 flex-wrap text-muted text-[0.85rem] font-bold">
        {status && (
          <InkStamp tone={featuredMatch.finished ? 'ink' : 'red'} size="sm">
            {status}
          </InkStamp>
        )}
        <span className="inline-block first-letter:uppercase">
          {formatMatchDate(featuredMatch.date)}
        </span>
      </div>
    </section>
  );
}
