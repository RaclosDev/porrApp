import PaperLoading from '../components/PaperLoading';
import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { openStats } from '../utils/navigation';
import Flag from '../components/Flag';
import type { Match, MatchRadar } from '../types/api';

type Kind = 'live' | 'next' | 'last';
type Tab = 'next' | 'last';

const pad = (value: number) => value.toString().padStart(2, '0');
const timeOf = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** «Hoy», «Mañana», «Ayer» o el día con su fecha («Sábado, 7 nov»). */
export function dayLabel(date: Date, now = new Date()) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  const label = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1).replace('.', '');
}

/** Partidos agrupados por día, en el orden en que llegan. */
function byDay(matches: Match[]) {
  const groups: { key: string; label: string; matches: Match[] }[] = [];
  for (const match of matches) {
    const date = new Date(match.date ?? 0);
    const key = dayKey(date);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.matches.push(match);
    else groups.push({ key, label: dayLabel(date), matches: [match] });
  }
  return groups;
}

const hasScore = (m: Match) => m.homeScore !== null && m.awayScore !== null;

function MatchRow({ match, kind }: { match: Match; kind: Kind }) {
  const date = new Date(match.date ?? 0);
  const started = kind === 'live' && date <= new Date();
  const showScore = kind === 'last' || (kind === 'live' && hasScore(match));
  const home = match.homeScore ?? 0;
  const away = match.awayScore ?? 0;
  const outcome = (side: 'home' | 'away') => {
    if (kind !== 'last' || home === away) return '';
    return (side === 'home') === home > away ? ' is-winner' : ' is-loser';
  };

  const status =
    kind === 'last' ? 'Final' : started ? match.displayClock || 'En juego' : timeOf(date);

  return (
    <li className={`radar-match${started ? ' is-live' : ''}`}>
      <span className="radar-match-status">{status}</span>
      <span className="radar-match-teams">
        <span className={`radar-match-team${outcome('home')}`}>
          <span className="radar-match-crest">
            <Flag team={match.home} logo={match.homeLogo || match.homeTeamLogo} />
          </span>
          <span className="radar-match-name">{match.home}</span>
          {showScore && <span className="radar-match-score">{match.homeScore}</span>}
        </span>
        <span className={`radar-match-team${outcome('away')}`}>
          <span className="radar-match-crest">
            <Flag team={match.away} logo={match.awayLogo || match.awayTeamLogo} />
          </span>
          <span className="radar-match-name">{match.away}</span>
          {showScore && <span className="radar-match-score">{match.awayScore}</span>}
        </span>
      </span>
    </li>
  );
}

function MatchDays({ matches, kind }: { matches: Match[]; kind: Kind }) {
  return byDay(matches).map((group) => (
    <section key={group.key} className="radar-day" aria-label={group.label}>
      <h4 className="radar-day-title">{group.label}</h4>
      <ul className="radar-day-list">
        {group.matches.map((match) => (
          <MatchRow key={match.id} match={match} kind={kind} />
        ))}
      </ul>
    </section>
  ));
}

/** Partidos en directo, próximos y últimos resultados de la competición. */
function Radar() {
  const { matchRadar, loading } = useAppContext();
  if (loading) return <PaperLoading label="Cargando partidos" />;
  return <RadarView matchRadar={matchRadar} />;
}

export function RadarView({ matchRadar }: { matchRadar: MatchRadar | null | undefined }) {
  const [activeTab, setActiveTab] = useState<Tab>('next');

  const liveMatches = matchRadar?.live || [];
  const lastMatches = (matchRadar?.last || []).slice(0, 10);
  const nextMatches = (matchRadar?.next || []).slice(0, 10);
  const isActuallyLive = liveMatches.some((m) => new Date(m.date ?? 0) <= new Date());

  const columns: { tab: Tab; title: string; matches: Match[]; empty: string }[] = [
    {
      tab: 'next',
      title: 'Próximos',
      matches: nextMatches,
      empty:
        lastMatches.length > 0
          ? 'No hay próximos partidos programados. Si ya se han disputado todos, la competición ha terminado.'
          : 'No hay próximos partidos programados. Es posible que el calendario aún no esté disponible.',
    },
    {
      tab: 'last',
      title: 'Resultados',
      matches: lastMatches,
      empty: 'No hay partidos finalizados recientemente.',
    },
  ];

  return (
    <section
      id="view-radar"
      className="view-section active block paper-panel album-sheet landing-tape"
    >
      <div className="section-header mb-5 text-center">
        <h2 className="m-0 poster-title">Partidos</h2>
      </div>

      <div className="radar">
        {liveMatches.length > 0 && (
          <div className="radar-block radar-live">
            <h3 className="radar-block-title">
              {isActuallyLive && <span className="radar-live-dot" aria-hidden="true" />}
              {isActuallyLive ? 'En directo' : 'A punto de comenzar'}
            </h3>
            <ul className="radar-day-list">
              {liveMatches.map((match) => (
                <MatchRow key={match.id} match={match} kind="live" />
              ))}
            </ul>
          </div>
        )}

        <div className="md-filters radar-tabs" role="tablist" aria-label="Partidos">
          {columns.map(({ tab, title }) => (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`radar-tab-${tab}`}
              aria-controls={`radar-panel-${tab}`}
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`md-filter${activeTab === tab ? ' is-active' : ''}`}
            >
              {title}
            </button>
          ))}
        </div>

        <div className="radar-columns">
          {columns.map(({ tab, title, matches, empty }) => (
            <div
              key={tab}
              id={`radar-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`radar-tab-${tab}`}
              className={`radar-block${activeTab === tab ? ' is-active' : ''}`}
            >
              <h3 className="radar-block-title radar-column-title">{title}</h3>
              {matches.length === 0 ? (
                <p className="radar-empty">{empty}</p>
              ) : (
                <MatchDays matches={matches} kind={tab} />
              )}
            </div>
          ))}
        </div>

        <button type="button" className="radar-stats-link" onClick={() => openStats()}>
          Estadísticas en Sofascore
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path
              d="M7 17L17 7M9 7h8v8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </section>
  );
}

export default Radar;
