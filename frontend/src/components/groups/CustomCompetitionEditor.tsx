import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  Shield,
  Trophy,
  TriangleAlert,
  X,
} from 'lucide-react';
import { fetchCustomMatches, fetchCustomTeams } from '../../services/api';
import type { Group } from '../../types/api';
import { errorMessage } from '../../utils/errors';
import { queryKeys } from '../../services/queryKeys';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { LeagueAvatar } from '../Avatar';
import CustomSummaryTab from './custom/CustomSummaryTab';
import CustomTeamsTab from './custom/CustomTeamsTab';
import CustomMatchesTab from './custom/CustomMatchesTab';
import CustomResultsTab from './custom/CustomResultsTab';
import { isBye, type CustomTab, type SaveAction } from './custom/customCompetition';

const TABS: { id: CustomTab; label: string; icon: typeof Shield }[] = [
  { id: 'summary', label: 'Resumen', icon: LayoutDashboard },
  { id: 'teams', label: 'Equipos', icon: Shield },
  { id: 'matches', label: 'Partidos', icon: CalendarClock },
  { id: 'results', label: 'Resultados', icon: Trophy },
];

/**
 * Gestión de una competición personalizada: equipos, partidos, cruces y resultados.
 * Mismo patrón que «Administrar»: diálogo centrado en escritorio y hoja completa en móvil.
 */
export default function CustomCompetitionEditor({
  group,
  onClose,
}: {
  group: Group;
  onClose: () => void;
}) {
  const groupKey = group.id.toString();
  const [tab, setTab] = useState<CustomTab>('summary');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lockDate, setLockDate] = useState(group.lockDate);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const teamsQuery = useQuery({
    queryKey: queryKeys.customTeams(groupKey),
    queryFn: () => fetchCustomTeams(group.id),
  });
  const matchesQuery = useQuery({
    queryKey: queryKeys.customMatches(groupKey),
    queryFn: () => fetchCustomMatches(group.id),
  });
  const teams = teamsQuery.data ?? [];
  const matches = matchesQuery.data ?? [];
  const loading = teamsQuery.isLoading || matchesQuery.isLoading;
  const loadError = teamsQuery.error ?? matchesQuery.error;
  const pendingResults = matches.filter((match) => !isBye(match) && !match.finished).length;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogFocus(panelRef, { onEscape: () => !busy && onClose() });

  const save: SaveAction = async (action, success) => {
    setBusy(true);
    setError('');
    try {
      await action();
      // Inicio, Resultados y Mi porra leen estas mismas consultas.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.customTeams(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customMatches(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customLockState(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.group(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboardMatchdays(groupKey) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.predictionScore() }),
      ]);
      toast.success(success);
      return true;
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudieron guardar los cambios'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const goTo = (next: CustomTab) => {
    setTab(next);
    setError('');
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % TABS.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + TABS.length) % TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? TABS.length - 1
              : -1;
    if (next === -1) return;
    event.preventDefault();
    goTo(TABS[next].id);
    document.getElementById(`custom-admin-tab-${TABS[next].id}`)?.focus();
  };

  const counts: Partial<Record<CustomTab, number>> = {
    teams: teams.length,
    matches: matches.length,
    results: pendingResults,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="custom-admin-title"
      className="league-admin-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="league-admin-panel paper-panel landing-tape paper-dialog"
      >
        <header className="league-admin-header">
          <LeagueAvatar url={group.imageUrl} name={group.name} size={46} />
          <div className="league-admin-heading">
            <span className="league-admin-eyebrow">
              <ClipboardList size={12} aria-hidden="true" />
              Gestionar competición
            </span>
            <h2 id="custom-admin-title" className="league-admin-title">
              {group.competitionName ?? group.name}
            </h2>
            <p className="league-admin-subtitle">
              {group.name} ·{' '}
              {group.poolFormat === 'MATCH_DAY'
                ? 'Por jornadas'
                : group.poolFormat === 'FULL_BRACKET'
                  ? 'Grupos y cuadro'
                  : 'Solo cuadro'}
            </p>
          </div>
          <button
            type="button"
            className="league-admin-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar gestión de la competición"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div
          className="league-admin-tabs custom-admin-tabs"
          role="tablist"
          aria-label="Secciones de la competición"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`custom-admin-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`custom-admin-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              className={`league-admin-tab ${tab === id ? 'is-active' : ''}`}
              onKeyDown={handleTabKeyDown}
              onClick={() => goTo(id)}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
              {counts[id] !== undefined && (
                <span
                  className={`league-admin-tab-count ${id === 'results' ? '' : 'is-total'}`}
                  aria-label={id === 'results' ? `${counts[id]} pendientes` : undefined}
                >
                  {counts[id]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="league-admin-body">
          {error && (
            <div className="league-admin-alert" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} aria-label="Descartar aviso">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="league-admin-member-list" aria-busy="true">
              {[0, 1, 2].map((row) => (
                <div key={row} className="league-admin-member-skeleton skeleton" />
              ))}
            </div>
          ) : loadError ? (
            <div className="league-admin-empty" role="alert">
              <TriangleAlert size={20} aria-hidden="true" />
              <strong>No se pudo cargar la competición</strong>
              <span>{errorMessage(loadError, 'Vuelve a abrirla para intentarlo de nuevo.')}</span>
            </div>
          ) : (
            <fieldset
              disabled={busy}
              id={`custom-admin-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`custom-admin-tab-${tab}`}
              className="league-admin-panel-section min-w-0 border-0 m-0 p-0"
            >
              {tab === 'summary' && (
                <CustomSummaryTab
                  group={group}
                  teams={teams}
                  matches={matches}
                  lockDate={lockDate}
                  onLockDateSaved={setLockDate}
                  save={save}
                  goTo={goTo}
                />
              )}
              {tab === 'teams' && <CustomTeamsTab group={group} teams={teams} save={save} />}
              {tab === 'matches' && (
                <CustomMatchesTab group={group} teams={teams} matches={matches} save={save} />
              )}
              {tab === 'results' && (
                <CustomResultsTab group={group} matches={matches} save={save} />
              )}
            </fieldset>
          )}
        </div>
      </div>
    </div>
  );
}
