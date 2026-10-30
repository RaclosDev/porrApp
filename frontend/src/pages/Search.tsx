import { useMemo } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useBracketInsights } from '../hooks/useBracketInsights';
import InsightsHeader from '../components/insights/InsightsHeader';
import { InsightsNotice, TeamFlag } from '../components/insights/InsightCard';
import BracketInsightsGate from '../components/insights/BracketInsightsGate';
import TeamPicker from '../components/insights/TeamPicker';
import TeamFunnel from '../components/insights/TeamFunnel';
import StagePickersList from '../components/insights/StagePickersList';
import WhatsAppIcon from '../components/WhatsAppIcon';
import {
  GROUP_POSITIONS,
  KNOCKOUT_PATH,
  STAGE_LABEL,
  rankPicks,
  reachLabel,
  searchableTeams,
  stagePickers,
  teamFunnel,
  type OfficialState,
  type StageId,
} from '../utils/bracketStats';

const FULL_STAGES: StageId[] = [
  'groups',
  ...GROUP_POSITIONS,
  'r16',
  'qf',
  'sf',
  'final',
  'champion',
];
const KNOCKOUT_STAGES: StageId[] = ['r16', 'qf', 'sf', 'final', 'champion'];

/** Condiciones de los enlaces que se compartían con el buscador anterior. */
const LEGACY_CONDITIONS: Record<string, StageId> = {
  passes_groups: 'groups',
  first_group: 'first',
  second_group: 'second',
  passes_as_third: 'third',
  reaches_r16: 'r16',
  reaches_qf: 'qf',
  reaches_sf: 'sf',
  reaches_final: 'final',
  is_champion: 'champion',
};

/** Situación real del equipo en una frase: campeón, eliminado en una ronda o aún en juego. */
function realSituation(official: OfficialState, team: string): string | null {
  if (!official.started) return null;
  const { stage, out } = official.reach(team);
  if (out || stage === 'champion') return reachLabel(stage, 'real');
  switch (stage) {
    case 'final':
      return 'Juega la final';
    case 'sf':
      return 'En semifinales';
    case 'qf':
      return 'En cuartos';
    case 'r16':
      return 'En octavos';
    case 'groups':
      return 'En dieciseisavos';
    default:
      return 'En fase de grupos';
  }
}

/**
 * Buscador de las ligas de cuadro: elige un equipo y mira cuántos cuadros lo llevan a cada
 * ronda, quién lo pone y hasta dónde lo lleva el resto.
 */
function Search() {
  const { activeGroupPoolFormat, activeCompetitionFormatType } = useAppContext();
  if (activeGroupPoolFormat === 'MATCH_DAY' || activeCompetitionFormatType === 'LEAGUE') {
    return <Navigate to="/stats" replace />;
  }
  return <BracketSearch />;
}

function BracketSearch() {
  const insights = useBracketInsights();
  const { entries, official, knockoutsOnly } = insights;
  const [params, setParams] = useSearchParams();

  const stages = knockoutsOnly ? KNOCKOUT_STAGES : FULL_STAGES;
  const teamGroups = useMemo(
    () => searchableTeams(entries, insights.officialBracket, knockoutsOnly),
    [entries, insights.officialBracket, knockoutsOnly],
  );
  const allTeams = useMemo(() => teamGroups.flatMap((g) => g.teams), [teamGroups]);
  const shortcuts = useMemo(
    () =>
      rankPicks(entries, 'champion')
        .slice(0, 6)
        .map((p) => p.team),
    [entries],
  );

  const requestedTeam = params.get('team') ?? '';
  const team = allTeams.includes(requestedTeam) ? requestedTeam : '';
  const rows = useMemo(
    () => (team ? teamFunnel(entries, team, stages, official) : []),
    [entries, team, stages, official],
  );

  const requestedStage = (params.get('stage') ??
    LEGACY_CONDITIONS[params.get('condition') ?? ''] ??
    '') as StageId;
  // Sin ronda pedida, la más lejana a la que alguien lleva al equipo.
  const furthest = [...rows]
    .reverse()
    .find((r) => r.count > 0 && KNOCKOUT_PATH.some((s) => s === r.stage));
  const stage: StageId = stages.includes(requestedStage)
    ? requestedStage
    : (furthest?.stage ?? stages[0]);
  const pickers = useMemo(
    () => (team ? stagePickers(entries, team, stage) : null),
    [entries, team, stage],
  );

  const update = (next: { team?: string; stage?: StageId }) => {
    const nextTeam = next.team ?? team;
    const query = new URLSearchParams();
    if (nextTeam) query.set('team', nextTeam);
    if (next.stage && nextTeam) query.set('stage', next.stage);
    setParams(query, { replace: true });
  };

  const share = () => {
    const url = `${window.location.origin}/search?team=${encodeURIComponent(team)}&stage=${stage}`;
    const row = rows.find((r) => r.stage === stage);
    const text = `${team} · ${STAGE_LABEL[stage]}: lo pone el ${row?.percent ?? 0} % de "${insights.leagueName}". ¿Quién es quién?\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const situation = team ? realSituation(official, team) : null;
  const selectedRow = rows.find((r) => r.stage === stage);

  return (
    <section id="view-search" className="view-section block">
      <InsightsHeader
        leagueName={insights.leagueName}
        summary={entries.length > 0 ? `${entries.length} cuadros` : undefined}
        withSearch
      />
      <BracketInsightsGate insights={insights}>
        <div className="mx-auto flex max-w-245 flex-col gap-4">
          <TeamPicker
            value={team}
            onChange={(t) => update({ team: t })}
            groups={teamGroups}
            shortcuts={shortcuts}
          />

          {!team ? (
            <InsightsNotice title="Elige un equipo">
              Verás cuántos cuadros lo pasan de grupos, lo meten en cada ronda o lo hacen campeón, y
              quién de la liga es.
            </InsightsNotice>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
              <section
                aria-labelledby="search-team-title"
                className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <TeamFlag team={team} />
                  <h3 id="search-team-title" className="m-0 min-w-0 flex-1 truncate text-[1.2rem]">
                    {team}
                  </h3>
                  {situation && (
                    <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[0.78rem] font-semibold text-muted">
                      {situation}
                    </span>
                  )}
                </div>
                <TeamFunnel
                  rows={rows}
                  total={entries.length}
                  selected={stage}
                  onSelect={(s) => update({ stage: s })}
                />
              </section>

              <section
                aria-labelledby="search-pickers-title"
                aria-live="polite"
                className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
              >
                <h3 id="search-pickers-title" className="m-0 text-[1.05rem]">
                  {team} · {STAGE_LABEL[stage]}
                </h3>
                <p className="mt-1 mb-3 text-[0.88rem] text-muted">
                  {selectedRow?.count ?? 0} de {entries.length} cuadros ({selectedRow?.percent ?? 0}{' '}
                  %). Toca a alguien para ver su cuadro.
                </p>
                {pickers && (
                  <StagePickersList
                    pickers={pickers}
                    avatarByUserId={insights.avatarByUserId}
                    onOpen={insights.openPrediction}
                  />
                )}
                <button
                  type="button"
                  onClick={share}
                  className="glass-btn mt-4 inline-flex w-full items-center justify-center gap-2 border-[#25D366] bg-[#25D366] font-bold text-[#0f172a]"
                >
                  <WhatsAppIcon size={18} /> Compartir búsqueda
                </button>
              </section>
            </div>
          )}
        </div>
      </BracketInsightsGate>
    </section>
  );
}

export default Search;
