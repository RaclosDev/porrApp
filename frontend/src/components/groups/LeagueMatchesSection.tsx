import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ListChecks, TriangleAlert, X } from 'lucide-react';
import { fetchCompetitions, fetchMatchSelection, saveMatchSelection } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { Group, MatchSelectionView } from '../../types/api';
import { confirmAction } from '../../utils/confirmAction';
import { errorMessage } from '../../utils/errors';
import MatchSelectionPicker from '../matchSelection/MatchSelectionPicker';
import {
  addableCompetitions,
  describeCompetitions,
  describeSelection,
  fromView,
  leagueCompetitionIds,
  mergeCalendar,
  removedPredictions,
  selectionError,
  toRequest,
  type SelectionValue,
} from '../matchSelection/matchSelection';
import { useSelectableCalendar } from '../matchSelection/useSelectableCalendar';

/** Solo una liga por jornadas sobre una competición oficial elige sus partidos. */
export const hasMatchSelection = (group: Group) =>
  group.poolFormat === 'MATCH_DAY' && !group.customCompetition && group.competitionId != null;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const sameIds = (left: number[], right: number[]) =>
  left.length === right.length && left.every((id) => right.includes(id));

/**
 * Partidos que entran en la liga, en su administración. Quitar un partido aún abierto borra sus
 * predicciones (se pide confirmación); uno ya cerrado con predicciones no se puede quitar.
 */
export default function LeagueMatchesSection({ group }: { group: Group }) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.matchSelection(group.id);
  const selection = useQuery({ queryKey, queryFn: () => fetchMatchSelection(group.id) });
  const [editing, setEditing] = useState<SelectionValue | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const view = selection.data;
  const saved = view ? fromView(view) : null;
  const primaryId = view?.competitionIds[0] ?? group.competitionId;
  const editingIds = editing ? leagueCompetitionIds(editing, primaryId) : [];
  // Con otras competiciones que las guardadas, su calendario (por semanas si junta varias).
  const changedCompetitions =
    view != null && editing != null && !sameIds(editingIds, view.competitionIds);
  const calendar = useSelectableCalendar(editingIds, changedCompetitions);
  const competitions = useQuery({
    queryKey: queryKeys.competitions(),
    queryFn: fetchCompetitions,
    enabled: editing != null,
    staleTime: 5 * 60_000,
  });
  const matches =
    view && changedCompetitions
      ? mergeCalendar(view.matches, calendar.data?.matches)
      : view?.matches;
  const teams = changedCompetitions && calendar.data ? calendar.data.teams : view?.teams;
  const primary = view?.competitions[0];
  const others =
    view && primaryId != null && competitions.data
      ? addableCompetitions(competitions.data, primaryId, view.competitionIds).map((item) => ({
          id: item.id,
          name: item.name,
          locked: view.competitions.some((saved) => saved.id === item.id && saved.locked),
        }))
      : undefined;

  const save = async (value: SelectionValue, current: MatchSelectionView) => {
    const problem = selectionError(value);
    if (problem) {
      setError(problem);
      return;
    }
    const removed = removedPredictions(value, current.matches);
    if (
      removed > 0 &&
      !(await confirmAction({
        title: 'Quitar partidos con predicciones',
        message: `Se ${removed === 1 ? 'borrará' : 'borrarán'} ${plural(removed, 'predicción', 'predicciones')} de partidos que aún no han empezado. No da ni quita puntos a nadie, pero no se puede deshacer.`,
        confirmLabel: 'Quitar y borrar',
      }))
    ) {
      return;
    }
    setError('');
    setSaving(true);
    try {
      const result = await saveMatchSelection(
        group.id,
        toRequest(value, matches ?? current.matches),
      );
      queryClient.setQueryData(queryKey, result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.group(group.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboardMatchdays(group.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matchdayFixtures(group.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(group.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.matchdayStats(group.id) }),
      ]);
      setEditing(null);
      toast.success(
        result.keptMatches > 0
          ? `Partidos guardados. ${plural(result.keptMatches, 'partido ya cerrado sigue', 'partidos ya cerrados siguen')} en la liga porque tenían predicciones.`
          : 'Partidos guardados',
      );
    } catch (reason) {
      setError(errorMessage(reason, 'No se pudieron guardar los partidos'));
    } finally {
      setSaving(false);
    }
  };

  let status = 'Cargando…';
  if (selection.isError) status = 'No disponible';
  else if (view && saved) {
    status = describeSelection(saved, view.teams, view.matches);
    if (view.competitions.length > 1)
      status += ` · ${describeCompetitions(view.competitions.map((item) => item.name))}`;
  }

  return (
    <section className="league-admin-card">
      <div className="league-admin-card-head">
        <h3>
          <ListChecks size={14} aria-hidden="true" />
          Partidos de la liga
        </h3>
        <span className="league-admin-card-meta">{status}</span>
      </div>
      {error && (
        <div className="league-admin-alert" role="alert">
          <TriangleAlert size={16} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} aria-label="Descartar aviso">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
      {selection.isError && (
        <p className="league-admin-muted">
          {errorMessage(selection.error, 'No se pudo cargar el calendario.')}
        </p>
      )}
      {view && saved && editing === null && (
        <button
          type="button"
          className="league-admin-btn"
          onClick={() => {
            setError('');
            setEditing(saved);
          }}
        >
          Elegir partidos
        </button>
      )}
      {view && editing !== null && (
        <form
          className="custom-admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save(editing, view);
          }}
        >
          <MatchSelectionPicker
            teams={teams ?? view.teams}
            matches={matches ?? view.matches}
            value={editing}
            onChange={(value) => {
              setError('');
              setEditing(value);
            }}
            primaryCompetition={primary && { id: primary.id, name: primary.name }}
            otherCompetitions={others}
            loadingCalendar={
              changedCompetitions && (calendar.isPending || calendar.isPlaceholderData)
            }
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="league-admin-btn is-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar partidos'}
            </button>
            <button
              type="button"
              className="league-admin-btn is-ghost"
              disabled={saving}
              onClick={() => {
                setError('');
                setEditing(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
      <p className="league-admin-muted">
        Los partidos futuros de los equipos elegidos entran solos. Si quitas un partido que aún no
        ha empezado se borran sus predicciones en esta liga; uno ya cerrado con predicciones se
        queda, para no cambiar la clasificación. Si juntas varias competiciones, las jornadas pasan
        a ser semanas de lunes a domingo.
      </p>
    </section>
  );
}
