import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PaperLoading from '../components/PaperLoading';
import TrackerInvite from '../components/tracker/TrackerInvite';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import PokerRegistration from '../components/poker/PokerRegistration';
import PokerSettingsForm from '../components/poker/PokerSettingsForm';
import PokerLive from '../components/poker/PokerLive';
import { PokerHistory, PokerStatistics } from '../components/poker/PokerHistory';
import { defaultSettings, today, tournamentDate } from '../components/poker/pokerFormat';
import { deleteGroup, leaveGroup } from '../services/endpoints/leagues';
import {
  fetchPokerHistory,
  fetchPokerLeague,
  pokerCommand,
  savePokerSession,
  type PokerLeagueData,
} from '../services/endpoints/poker';
import { queryKeys } from '../services/queryKeys';
import { confirmAction } from '../utils/confirmAction';
import { errorMessage } from '../utils/errors';
import '../styles/poker.css';

const views = ['Mesa', 'Histórico', 'Estadísticas'] as const;
type View = (typeof views)[number];

export default function PokerLeague({ leagueId }: { leagueId: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('Mesa');
  const [invite, setInvite] = useState(false);
  const [form, setForm] = useState<'new' | 'edit' | null>(null);
  const [removing, setRemoving] = useState(false);
  const key = queryKeys.poker(leagueId);
  const historyKey = queryKeys.pokerHistory(leagueId);
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchPokerLeague(leagueId),
    refetchInterval: (active) => (active.state.data?.current ? 5000 : 10000),
  });
  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => fetchPokerHistory(leagueId),
    enabled: Boolean(query.data) && (view !== 'Mesa' || form === 'new'),
    refetchInterval: view === 'Mesa' ? false : 15000,
  });
  const mutation = useMutation({
    mutationFn: (request: () => Promise<PokerLeagueData>) => request(),
    onMutate: () => client.cancelQueries({ queryKey: key, exact: true }),
    onSuccess: (data) => {
      const previous = client.getQueryData<PokerLeagueData>(key);
      client.setQueryData(key, data);
      if (previous?.current && !data.current) {
        void client.invalidateQueries({ queryKey: historyKey });
      }
    },
    onError: (reason) => {
      toast.error(errorMessage(reason, 'No se pudo guardar el cambio.'));
      void client.invalidateQueries({ queryKey: key, exact: true });
    },
  });

  if (query.isPending) return <PaperLoading label="Cargando la liga de póker" />;
  if (!query.data) return <TrackerUnavailable error={query.error} />;

  const league = query.data;
  const { current } = league;
  const busy = mutation.isPending || removing;

  async function change(request: () => Promise<PokerLeagueData>) {
    if (busy) return false;
    try {
      await mutation.mutateAsync(request);
      return true;
    } catch {
      return false;
    }
  }

  async function remove() {
    const confirmed = await confirmAction({
      title: league.owner ? '¿Borrar la liga de póker?' : '¿Salir de la liga?',
      message: league.owner
        ? 'Se borrarán la mesa y todos los resultados de la liga.'
        : 'Puedes volver a entrar con el enlace de invitación.',
      confirmLabel: league.owner ? 'Borrar liga' : 'Salir de la liga',
    });
    if (!confirmed) return;
    setRemoving(true);
    try {
      await (league.owner ? deleteGroup(league.id) : leaveGroup(league.id));
      await client.invalidateQueries({ queryKey: queryKeys.myGroups() });
      navigate('/mis-ligas', { replace: true });
      client.removeQueries({ queryKey: key });
    } catch (reason) {
      toast.error(errorMessage(reason, 'No se pudo completar el cambio.'));
      setRemoving(false);
    }
  }

  return (
    <section className="view-section active create-league tracker poker">
      <header className="create-league-header poker-header">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">{league.name}</h1>
          <p className="create-league-progress">Liga de póker · Texas Hold’em</p>
        </div>
        <button
          type="button"
          className="glass-btn"
          aria-expanded={invite}
          onClick={() => setInvite(!invite)}
        >
          {invite ? 'Cerrar invitación' : 'Invitar con enlace'}
        </button>
      </header>
      {invite && <TrackerInvite tracker={league} />}
      <nav className="poker-nav" aria-label="Liga de póker">
        {views.map((label) => (
          <button
            key={label}
            type="button"
            className="glass-btn"
            aria-pressed={view === label}
            onClick={() => {
              setView(label);
              setForm(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {view === 'Mesa' && (
        <>
          {league.owner &&
          ((form === 'new' && !current) || (form === 'edit' && current?.startedAt === null)) ? (
            form === 'new' && history.isPending ? (
              <PaperLoading label="Cargando la configuración" />
            ) : (
              <PokerSettingsForm
                key={form}
                editing={form === 'edit'}
                date={current?.date ?? today()}
                settings={current?.settings ?? history.data?.[0]?.settings ?? defaultSettings}
                busy={busy}
                onCancel={() => setForm(null)}
                onSave={async (date, settings) => {
                  const saved = await change(() =>
                    savePokerSession(league.id, date, settings, current ?? undefined),
                  );
                  if (saved) setForm(null);
                  return saved;
                }}
              />
            )
          ) : current ? (
            current.startedAt === null ? (
              <PokerRegistration
                league={league}
                session={current}
                busy={busy}
                change={change}
                onEdit={() => setForm('edit')}
              />
            ) : (
              <PokerLive
                session={current}
                owner={league.owner}
                busy={busy}
                serverNow={league.serverNow}
                receivedAt={query.dataUpdatedAt}
                onCommand={async (action, playerId) => {
                  const saved = await change(() =>
                    pokerCommand(league.id, current, action, playerId),
                  );
                  if (saved && action === 'CLOSE') setView('Histórico');
                }}
              />
            )
          ) : (
            <section className="paper-panel album-sheet poker-panel">
              <h2>Próximo torneo</h2>
              <p>
                {league.owner
                  ? 'Elige la fecha y las reglas para abrir las inscripciones.'
                  : 'El organizador abrirá las inscripciones del próximo torneo aquí.'}
              </p>
              {league.owner && (
                <button
                  type="button"
                  className="glass-btn primary-btn"
                  onClick={() => setForm('new')}
                >
                  Preparar torneo
                </button>
              )}
            </section>
          )}
        </>
      )}
      {view !== 'Mesa' &&
        (history.isPending ? (
          <PaperLoading label="Cargando los resultados" />
        ) : history.isError && !history.data ? (
          <section className="paper-panel album-sheet poker-panel">
            <h2>No se pudieron cargar los resultados</h2>
            <button type="button" className="glass-btn" onClick={() => void history.refetch()}>
              Reintentar
            </button>
          </section>
        ) : view === 'Histórico' ? (
          <PokerHistory sessions={history.data ?? []} />
        ) : (
          <PokerStatistics sessions={history.data ?? []} />
        ))}
      {view === 'Mesa' && (
        <footer className="poker-footer">
          {current && <span>{tournamentDate(current.date)}</span>}
          <button type="button" className="glass-btn" disabled={busy} onClick={() => void remove()}>
            {league.owner ? 'Borrar liga' : 'Salir de la liga'}
          </button>
        </footer>
      )}
    </section>
  );
}
