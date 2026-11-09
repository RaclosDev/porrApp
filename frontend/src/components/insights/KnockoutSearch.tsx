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
  type RoundPickers,
} from '../../utils/knockoutStats';
import { InsightsNotice } from './InsightCard';
import { KnockoutTeamIcon, type TeamLogos } from './KnockoutStats';
import PickFunnel, { type FunnelRow } from './PickFunnel';
import StagePickersList from './StagePickersList';
import SubjectPicker from './SubjectPicker';

/** Filas del buscador que no son rondas del cuadro: los puestos de la fase de grupos. */
export interface ExtraRows {
  /** Van debajo de esta ronda. */
  after: number;
  rows: (team: string) => FunnelRow<string>[];
  pickers: (team: string, id: string) => RoundPickers;
}

interface KnockoutSearchProps {
  entries: KnockoutEntry[];
  field: KnockoutField;
  logos: TeamLogos;
  leagueName: string;
  groupId: string | null;
  avatarByUserId: Map<number, string>;
  onOpen: (predictionId: string) => void;
  /** Equipos del selector, agrupados; sin ellos, los que alguien ha puesto en alguna ronda. */
  teamGroups?: { label: string | null; teams: string[] }[];
  extra?: ExtraRows;
}

const teamOption = (team: string) => ({ value: team, label: team });

/**
 * Buscador de un cuadro: elige un equipo y mira cuántas predicciones lo hacen pasar cada ronda,
 * quién lo tiene y dónde lo deja fuera el resto.
 */
export default function KnockoutSearch({
  entries,
  field,
  logos,
  leagueName,
  groupId,
  avatarByUserId,
  onOpen,
  teamGroups,
  extra,
}: KnockoutSearchProps) {
  const [params, setParams] = useSearchParams();
  const groups = useMemo(
    () => teamGroups ?? [{ label: null, teams: pickedTeams(entries) }],
    [teamGroups, entries],
  );
  const shortcuts = useMemo(() => favouriteTeams(entries, field, 6), [entries, field]);

  const requestedTeam = params.get('team') ?? '';
  const team = groups.some((group) => group.teams.includes(requestedTeam)) ? requestedTeam : '';
  const rounds = useMemo(
    () => (team ? teamRounds(entries, field, team) : []),
    [entries, field, team],
  );
  const rows = useMemo(() => {
    const list = rounds.map((r): FunnelRow<string> & { extra?: boolean } => ({
      id: String(r.round),
      label: passLabel(field.rounds[r.round]),
      count: r.count,
      total: r.total,
      percent: r.percent,
      status: r.status,
    }));
    if (!extra || !team) return list;
    const added = extra.rows(team).map((r) => ({ ...r, sub: true, extra: true }));
    const at = list.findIndex((r) => r.id === String(extra.after)) + 1;
    return [...list.slice(0, at), ...added, ...list.slice(at)];
  }, [rounds, field, extra, team]);

  // Sin ronda pedida, la más lejana a la que alguien lleva al equipo.
  const furthest = [...rounds].reverse().find((r) => r.count > 0);
  const row =
    rows.find((r) => r.id === params.get('round')) ??
    rows.find((r) => !r.extra && r.id === String(furthest?.round)) ??
    rows[0];
  const pickers = useMemo(() => {
    if (!team || !row) return null;
    return row.extra && extra
      ? extra.pickers(team, row.id)
      : roundPickers(entries, field, team, Number(row.id));
  }, [entries, field, team, row, extra]);
  const total = row?.total ?? entries.length;

  const update = (next: { team?: string; round?: string }) => {
    const nextTeam = next.team ?? team;
    const query = new URLSearchParams();
    if (groupId) query.set('group', groupId);
    if (nextTeam) query.set('team', nextTeam);
    if (next.round !== undefined && nextTeam) query.set('round', next.round);
    setParams(query, { replace: true });
  };

  const share = () => {
    if (!row) return;
    const url = `${window.location.origin}/search?group=${encodeURIComponent(groupId ?? '')}&team=${encodeURIComponent(team)}&round=${row.id}`;
    const text = `${team} · ${row.label}: lo pone el ${row.percent} % de "${leagueName}". ¿Quién es quién?\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const situation = team ? teamSituation(field, team) : null;

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <SubjectPicker
        value={team}
        onChange={(next) => update({ team: next })}
        groups={groups.map((group) => ({
          label: group.label,
          options: group.teams.map(teamOption),
        }))}
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
              rows={rows}
              total={entries.length}
              selected={row.id}
              onSelect={(id) => update({ round: id })}
            />
          </section>

          <section
            aria-labelledby="search-pickers-title"
            aria-live="polite"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <h3 id="search-pickers-title" className="m-0 text-[1.05rem]">
              {team} · {row.label}
            </h3>
            <p className="mt-1 mb-3 text-[0.88rem] text-muted">
              {row.count} de {total} {total === 1 ? 'predicción' : 'predicciones'} ({row.percent}{' '}
              %). Toca a alguien para ver su predicción.
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
