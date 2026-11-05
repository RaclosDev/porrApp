import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { fetchCustomTeams, fetchCustomMatches } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import {
  computeCustomGroupTables,
  computeCustomResultRounds,
  customMatchRadar,
  customMatchWinner,
  nextCustomBracketMatch,
  splitCustomRounds,
} from '../utils/customBracket';
import PaperLoading from '../components/PaperLoading';
import ResultBracket from '../components/official/ResultBracket';
import OfficialBracketTabs from '../components/official/OfficialBracketTabs';
import FeaturedMatchBanner from '../components/official/FeaturedMatchBanner';
import BracketInfoPanel from '../components/official/BracketInfoPanel';
import LiveMatchesPanel from '../components/Home/LiveMatchesPanel';
import GroupStandingsCard from '../components/Home/GroupStandingsCard';
import GroupMatchesModal, { type SelectedGroup } from '../components/GroupMatchesModal';

/**
 * Portada de una competición personalizada con el aspecto del cuadro oficial: pestañas de cuadro y
 * grupos, el cuadro real con sus resultados y la clasificación de cada grupo.
 */
export default function CustomTournamentHome() {
  const { activeGroupId, activeGroupName, activeCompetitionName } = useAppContext();
  const groupId = activeGroupId ? Number(activeGroupId) : null;
  const [activeTab, setActiveTab] = useState<'cuadro' | 'grupos'>('cuadro');
  const [activePanel, setActivePanel] = useState<'live' | 'scorers' | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);

  const teamsQuery = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(groupId!),
    enabled: groupId != null,
  });
  const matchesQuery = useQuery({
    queryKey: queryKeys.customMatches(activeGroupId),
    queryFn: () => fetchCustomMatches(groupId!),
    enabled: groupId != null,
  });

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const matches = useMemo(() => matchesQuery.data ?? [], [matchesQuery.data]);
  const logos = useMemo(() => {
    const result: Record<string, string> = {};
    for (const match of matches) {
      if (match.homeLogo) result[match.home] = match.homeLogo;
      if (match.awayLogo) result[match.away] = match.awayLogo;
    }
    for (const team of teams) if (team.logoUrl) result[team.name] = team.logoUrl;
    return result;
  }, [teams, matches]);
  const groupTables = useMemo(() => computeCustomGroupTables(teams, matches), [teams, matches]);
  const resultRounds = useMemo(() => computeCustomResultRounds(matches), [matches]);
  const layout = useMemo(
    () => splitCustomRounds(resultRounds.map((round) => round.slots)),
    [resultRounds],
  );
  const radar = useMemo(() => customMatchRadar(matches), [matches]);
  const featuredMatch = useMemo(() => nextCustomBracketMatch(matches), [matches]);
  const featuredRound = resultRounds.find((round) =>
    round.slots.some((slot) => slot.match?.id === featuredMatch?.id),
  );
  const groupMatches = useMemo(() => matches.filter((match) => match.round === 'group'), [matches]);

  const loading = teamsQuery.isPending || matchesQuery.isPending;
  const loadError = teamsQuery.error ?? matchesQuery.error;
  const hasGroups = Object.keys(groupTables).length > 0;
  const groupRows = (group: string) =>
    (groupTables[group] ?? []).map((row) => ({
      name: row.team,
      logo: logos[row.team],
      diff: row.goalsFor - row.goalsAgainst,
      gls: row.goalsFor,
      pts: row.points,
    }));

  return (
    <section className="view-section active block pt-0 relative">
      <h1 className="sr-only">{activeCompetitionName || activeGroupName}</h1>
      <OfficialBracketTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        activeGroupPichichi={false}
        showGroups={hasGroups}
        label="Vista de la competición"
      />

      {loadError && (
        <p role="alert" className="paper-panel album-sheet p-4 text-[var(--miss)]">
          {errorMessage(loadError, 'No se pudo cargar la competición')}
        </p>
      )}
      {loading && <PaperLoading label="Cargando competición…" />}

      {!loading && !loadError && activeTab === 'grupos' && hasGroups && (
        <div className="w-full">
          <div className="flex justify-center mb-7.5 w-full">
            <LiveMatchesPanel
              liveMatches={[]}
              matchRadar={customMatchRadar(groupMatches)}
              maxNext={1}
              showStats={false}
            />
          </div>
          <div id="home-standings-grid" className="groups-grid">
            {Object.keys(groupTables).map((group) => (
              <GroupStandingsCard
                key={group}
                groupName={group}
                rows={groupRows(group)}
                selected={selectedGroup?.name === group}
                onToggle={() =>
                  setSelectedGroup(
                    selectedGroup?.name === group ? null : { name: group, teams: groupRows(group) },
                  )
                }
              />
            ))}
          </div>
          <GroupMatchesModal
            selectedGroup={selectedGroup}
            allGames={groupMatches.filter((match) => match.groupName === selectedGroup?.name)}
            onClose={() => setSelectedGroup(null)}
            linkToStats={false}
          />
        </div>
      )}

      {!loading && !loadError && (activeTab === 'cuadro' || !hasGroups) && (
        <>
          {featuredMatch && (
            <FeaturedMatchBanner
              featuredMatch={featuredMatch}
              manualResults
              roundTitle={featuredRound?.title}
              groupId={activeGroupId}
              homeLogo={logos[featuredMatch.home]}
              awayLogo={logos[featuredMatch.away]}
            />
          )}

          {activePanel && (
            <div className="flex flex-col items-center mb-2.5 relative z-[50]">
              <BracketInfoPanel activePanel={activePanel} setActivePanel={setActivePanel}>
                <LiveMatchesPanel
                  liveMatches={[]}
                  matchRadar={radar}
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
              winnerOf={customMatchWinner}
            />
          ) : (
            <p className="paper-panel album-sheet p-5 text-center max-w-145 mx-auto">
              El administrador aún no ha configurado los cruces.
            </p>
          )}
        </>
      )}
    </section>
  );
}
