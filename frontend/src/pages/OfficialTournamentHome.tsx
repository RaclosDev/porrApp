import { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { splitCustomRounds } from '../utils/customBracket';
import {
  SWISS_LOSSES_TO_EXIT,
  SWISS_WINS_TO_ADVANCE,
  computeOfficialResultRounds,
  computeSwissStandings,
  nextOfficialBracketMatch,
  officialMatchWinner,
  swissMatchesByDay,
} from '../utils/officialTournament';
import PaperLoading from '../components/PaperLoading';
import Flag from '../components/Flag';
import InkStamp from '../components/InkStamp';
import OfficialBracketTabs from '../components/official/OfficialBracketTabs';
import FeaturedMatchBanner from '../components/official/FeaturedMatchBanner';
import BracketInfoPanel from '../components/official/BracketInfoPanel';
import ResultBracket from '../components/official/ResultBracket';
import SwissMatches from '../components/official/SwissMatches';
import LiveMatchesPanel from '../components/Home/LiveMatchesPanel';

/**
 * Portada de una competición oficial con cuadro propio (Worlds de LoL…): el cuadro se monta con las
 * series reales de la competición y la fase previa se muestra como balance de victorias y derrotas.
 */
export default function OfficialTournamentHome() {
  const { allGames, matchRadar, loading, activeCompetitionName, activeGroupName } = useAppContext();
  const [activeTab, setActiveTab] = useState<'cuadro' | 'grupos'>('cuadro');
  const [activePanel, setActivePanel] = useState<'live' | 'scorers' | null>(null);

  const logos = useMemo(() => {
    const result: Record<string, string> = {};
    for (const match of allGames) {
      const homeLogo = match.homeLogo || match.homeTeamLogo;
      const awayLogo = match.awayLogo || match.awayTeamLogo;
      if (homeLogo) result[match.home] = homeLogo;
      if (awayLogo) result[match.away] = awayLogo;
    }
    return result;
  }, [allGames]);
  const resultRounds = useMemo(() => computeOfficialResultRounds(allGames), [allGames]);
  const layout = useMemo(
    () => splitCustomRounds(resultRounds.map((round) => round.slots)),
    [resultRounds],
  );
  const swiss = useMemo(() => computeSwissStandings(allGames), [allGames]);
  const swissDays = useMemo(() => swissMatchesByDay(allGames), [allGames]);
  const featuredMatch = useMemo(() => nextOfficialBracketMatch(allGames), [allGames]);
  const featuredRound = resultRounds.find((round) =>
    round.slots.some((slot) => slot.match?.id === featuredMatch?.id),
  );
  const hasSwiss = swiss.length > 0;

  if (loading && !allGames.length) return <PaperLoading label="Cargando competición…" />;

  return (
    <section className="view-section active block pt-0 relative">
      <h1 className="sr-only">{activeCompetitionName || activeGroupName}</h1>
      <OfficialBracketTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        activeGroupPichichi={false}
        showGroups={hasSwiss}
        groupsLabel="Fase suiza"
        label="Vista de la competición"
      />

      {activeTab === 'grupos' && hasSwiss && (
        <div className="grid gap-4 max-w-245 mx-auto md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start">
          {swissDays.length > 0 && <SwissMatches days={swissDays} logos={logos} />}
          <div
            className={`paper-panel album-sheet p-4 ${swissDays.length ? '' : 'md:col-span-2 w-full max-w-145 mx-auto'}`}
          >
            <div className="flex justify-between items-center mb-2.5">
              <h2 className="album-sheet-title mb-0 text-left">Fase suiza</h2>
              <div className="flex gap-2 text-[0.75em] font-bold text-muted pr-1.5">
                <span className="w-6 text-center" title="Victorias">
                  V
                </span>
                <span className="w-6 text-center" title="Derrotas">
                  D
                </span>
              </div>
            </div>
            <ol className="m-0 p-0 list-none" aria-label="Clasificación de la fase suiza">
              {swiss.map((row, index) => {
                const through = row.wins >= SWISS_WINS_TO_ADVANCE;
                const out = row.losses >= SWISS_LOSSES_TO_EXIT;
                return (
                  <li
                    key={row.team}
                    className={`flex items-center py-1.5 px-2 mb-1 rounded-[6px] ${through ? 'bg-[rgba(17,_24,_39,_0.04)] bg-none' : ''}`}
                  >
                    <span className="w-5 font-bold text-muted text-[0.85em] shrink-0">
                      {index + 1}
                    </span>
                    <span className="inline-flex items-center mr-[5px] shrink-0">
                      <Flag team={row.team} logo={logos[row.team]} />
                    </span>
                    <span
                      className={`grow whitespace-nowrap overflow-hidden text-ellipsis mr-2 ${through ? 'font-bold' : ''} ${out ? 'text-muted' : ''}`}
                    >
                      {row.team}
                    </span>
                    {through && (
                      <InkStamp tone="ink" size="sm" label="Clasificado">
                        Pasa
                      </InkStamp>
                    )}
                    {out && (
                      <InkStamp size="sm" label="Eliminado">
                        Fuera
                      </InkStamp>
                    )}
                    <div className="flex gap-2 text-[0.85em] ml-2">
                      <span className="w-6 text-center font-bold text-[var(--hit)]">
                        {row.wins}
                      </span>
                      <span className="w-6 text-center text-[var(--miss)]">{row.losses}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {(activeTab === 'cuadro' || !hasSwiss) && (
        <>
          {featuredMatch && (
            <FeaturedMatchBanner
              featuredMatch={featuredMatch}
              roundTitle={featuredRound?.title}
              homeLogo={logos[featuredMatch.home]}
              awayLogo={logos[featuredMatch.away]}
            />
          )}

          {activePanel && (
            <div className="flex flex-col items-center mb-2.5 relative z-[50]">
              <BracketInfoPanel activePanel={activePanel} setActivePanel={setActivePanel}>
                <LiveMatchesPanel
                  liveMatches={matchRadar?.live || []}
                  matchRadar={matchRadar}
                  maxNext={3}
                  showStats={false}
                />
              </BracketInfoPanel>
            </div>
          )}

          {layout.final ? (
            <ResultBracket
              layout={layout}
              logos={logos}
              featuredMatchId={featuredMatch?.id}
              winnerOf={officialMatchWinner}
            />
          ) : (
            <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">
              Aún no hay cruces de eliminatorias.
            </p>
          )}
        </>
      )}
    </section>
  );
}
