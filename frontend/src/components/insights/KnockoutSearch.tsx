import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import WhatsAppIcon from '../WhatsAppIcon';
import {
  favouriteTeams,
  passLabel,
  pickedTeams,
  roundPickers,
  teamRounds,
  teamSituation,
  type KnockoutEntry,
  type KnockoutField,
} from '../../utils/knockoutStats';
import { InsightsNotice } from './InsightCard';
import { KnockoutTeamIcon, type TeamLogos } from './KnockoutStats';
import PickFunnel from './PickFunnel';
import StagePickersList from './StagePickersList';
import SubjectPicker from './SubjectPicker';

interface KnockoutSearchProps {
  entries: KnockoutEntry[];
  field: KnockoutField;
  logos: TeamLogos;
  leagueName: string;
  groupId: string | null;
  avatarByUserId: Map<number, string>;
  onOpen: (predictionId: string) => void;
}

const teamOption = (team: string) => ({ value: team, label: team });

/**
 * Buscador de unas eliminatorias o de un cuadro propio: elige un equipo y mira cuántas predicciones
 * lo hacen pasar cada ronda, quién lo tiene y dónde lo deja fuera el resto.
 */
export default function KnockoutSearch({
  entries,
  field,
  logos,
  leagueName,
  groupId,
  avatarByUserId,
  onOpen,
}: KnockoutSearchProps) {
  const [params, setParams] = useSearchParams();
  const teams = useMemo(() => pickedTeams(entries), [entries]);
  const shortcuts = useMemo(() => favouriteTeams(entries, field, 6), [entries, field]);

  const requestedTeam = params.get('team') ?? '';
  const team = teams.includes(requestedTeam) ? requestedTeam : '';
  const rows = useMemo(
    () => (team ? teamRounds(entries, field, team) : []),
    [entries, field, team],
  );

  const requestedRound = Number(params.get('round') ?? Number.NaN);
  // Sin ronda pedida, la más lejana a la que alguien lleva al equipo.
  const furthest = [...rows].reverse().find((row) => row.count > 0);
  const row = rows.find((r) => r.round === requestedRound) ?? furthest ?? rows[0];
  const pickers = useMemo(
    () => (team && row ? roundPickers(entries, field, team, row.round) : null),
    [entries, field, team, row],
  );

  const update = (next: { team?: string; round?: number }) => {
    const nextTeam = next.team ?? team;
    const query = new URLSearchParams();
    if (groupId) query.set('group', groupId);
    if (nextTeam) query.set('team', nextTeam);
    if (next.round !== undefined && nextTeam) query.set('round', String(next.round));
    setParams(query, { replace: true });
  };

  const label = row ? passLabel(field.rounds[row.round]) : '';
  const share = () => {
    if (!row) return;
    const url = `${window.location.origin}/search?group=${encodeURIComponent(groupId ?? '')}&team=${encodeURIComponent(team)}&round=${row.round}`;
    const text = `${team} · ${label}: lo pone el ${row.percent} % de "${leagueName}". ¿Quién es quién?\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const situation = team ? teamSituation(field, team) : null;

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <SubjectPicker
        value={team}
        onChange={(next) => update({ team: next })}
        groups={[{ label: null, options: teams.map(teamOption) }]}
        shortcuts={shortcuts.map(teamOption)}
        icon={(name) => <KnockoutTeamIcon team={name} logos={logos} />}
        placeholder="Elige un equipo"
      />

      {!team || !row ? (
        <InsightsNotice title="Elige un equipo">
          Verás cuántas predicciones lo hacen pasar cada ronda o lo ponen campeón, y quién de la
          liga es.
        </InsightsNotice>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <section
            aria-labelledby="search-team-title"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <KnockoutTeamIcon team={team} logos={logos} />
              <h3 id="search-team-title" className="m-0 min-w-0 flex-1 truncate text-[1.2rem]">
                {team}
              </h3>
              {situation && (
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[0.78rem] font-semibold text-muted">
                  {situation}
                </span>
              )}
            </div>
            <PickFunnel
              rows={rows.map((r) => ({
                id: String(r.round),
                label: passLabel(field.rounds[r.round]),
                count: r.count,
                total: r.total,
                percent: r.percent,
                status: r.status,
              }))}
              total={entries.length}
              selected={String(row.round)}
              onSelect={(id) => update({ round: Number(id) })}
            />
          </section>

          <section
            aria-labelledby="search-pickers-title"
            aria-live="polite"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <h3 id="search-pickers-title" className="m-0 text-[1.05rem]">
              {team} · {label}
            </h3>
            <p className="mt-1 mb-3 text-[0.88rem] text-muted">
              {row.count} de {row.total} {row.total === 1 ? 'predicción' : 'predicciones'} (
              {row.percent} %). Toca a alguien para ver su predicción.
            </p>
            {pickers && (
              <StagePickersList pickers={pickers} avatarByUserId={avatarByUserId} onOpen={onOpen} />
            )}
            <button
              type="button"
              onClick={share}
              className="glass-btn primary-btn mt-4 inline-flex w-full items-center justify-center gap-2"
            >
              <WhatsAppIcon size={18} /> Compartir búsqueda
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
