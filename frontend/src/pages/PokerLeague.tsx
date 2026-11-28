import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import ActiveLeagueDropdown from '../components/ActiveLeagueDropdown';
import PaperLoading from '../components/PaperLoading';
import SupportDialog from '../components/SupportDialog';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import PokerRegistration from '../components/poker/PokerRegistration';
import PokerSettingsForm from '../components/poker/PokerSettingsForm';
import PokerLive from '../components/poker/PokerLive';
import PokerLateEntry from '../components/poker/PokerLateEntry';
import PokerHome from '../components/poker/PokerHome';
import PokerInviteDialog from '../components/poker/PokerInviteDialog';
import PokerPlayersDialog from '../components/poker/PokerPlayersDialog';
import PokerSessionTabs from '../components/poker/PokerSessionTabs';
import { lastWinnerIds } from '../components/poker/PokerBadges';
import { PokerFaces } from '../components/poker/PokerFaces';
import { PokerProfiles } from '../components/poker/PokerPlayerCard';
import { PokerHistory, PokerStatistics } from '../components/poker/PokerHistory';
import { defaultSettings, today } from '../components/poker/pokerFormat';
import { pokerRoutes, type PokerSection } from '../components/poker/pokerRoutes';
import PokerFreeTable from '../components/poker/PokerFreeTable';
import PokerLivePlayers from '../components/poker/PokerLivePlayers';
import {
  deletePokerResult,
  editPokerResult,
  fetchPokerHistory,
  fetchPokerLeague,
  pokerCommand,
  savePokerSession,
  setPokerAttendance,
  setPokerOrganizing,
  type PokerLeagueData,
  type PokerSession,
} from '../services/endpoints/poker';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import '../styles/poker.css';

/** Torneos abiertos; si el servidor aún no envía la lista, al menos el actual. */
const openSessions = (data: PokerLeagueData | undefined) =>
  data?.upcoming ?? (data?.current ? [data.current] : []);

export default function PokerLeague({
  leagueId,
  view,
}: {
  leagueId: string;
  view: 'home' | PokerSection;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(false);
  const [showPlayers, setShowPlayers] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedSession = searchParams.get('torneo');
  // Desde Inicio, «Programar otro torneo» llega a la mesa con el formulario ya abierto.
  const [form, setForm] = useState<'new' | 'edit' | null>(() =>
    searchParams.get('nuevo') === '1' ? 'new' : null,
  );
  /**
   * Tras cerrar un torneo, ventana de propina para el crupier (apoyar el proyecto). Llega en el
   * estado de la navegación porque el historial monta la página de nuevo.
   */
  const [showTip, setShowTip] = useState(
    () => (location.state as { pokerTip?: boolean } | null)?.pokerTip === true,
  );
  const closeTip = () => {
    setShowTip(false);
    navigate(location.pathname, { replace: true, state: null });
  };
  const key = queryKeys.poker(leagueId);
  const historyKey = queryKeys.pokerHistory(leagueId);
  /** Con varios torneos abiertos, el elegido en la dirección; si no, el primero (en juego o el más próximo). */
  const pick = (data: PokerLeagueData | undefined) => {
    const open = openSessions(data);
    return open.find((session) => String(session.id) === requestedSession) ?? open[0] ?? null;
  };
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchPokerLeague(leagueId),
    refetchInterval: (active) => (active.state.data?.current ? 5000 : 10000),
  });
  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => fetchPokerHistory(leagueId),
    enabled:
      Boolean(query.data) &&
      (view !== 'table' || form === 'new' || Boolean(pick(query.data)?.startedAt)),
    refetchInterval: view === 'table' ? false : 15000,
  });
  const mutation = useMutation({
    mutationFn: (request: () => Promise<PokerLeagueData>) => request(),
    onMutate: () => client.cancelQueries({ queryKey: key, exact: true }),
    onSuccess: (data) => {
      const previous = client.getQueryData<PokerLeagueData>(key);
      client.setQueryData(key, data);
      // Un torneo que desaparece de los abiertos se ha cerrado (o cancelado): refresca el histórico.
      const open = new Set(openSessions(data).map((session) => session.id));
      if (openSessions(previous).some((session) => !open.has(session.id))) {
        void client.invalidateQueries({ queryKey: historyKey });
      }
    },
    onError: (reason) => {
      toast.error(errorMessage(reason, 'No se pudo guardar el cambio.'));
      void client.invalidateQueries({ queryKey: key, exact: true });
    },
  });

  const historyMutation = useMutation({
    mutationFn: (request: () => Promise<PokerSession[]>) => request(),
    onSuccess: (data) => client.setQueryData(historyKey, data),
    onError: (reason) => {
      toast.error(errorMessage(reason, 'No se pudo cambiar el histórico.'));
      void client.invalidateQueries({ queryKey: historyKey });
    },
  });

  async function changeHistory(request: () => Promise<PokerSession[]>) {
    if (historyMutation.isPending) return false;
    try {
      await historyMutation.mutateAsync(request);
      return true;
    } catch {
      return false;
    }
  }

  if (query.isPending) return <PaperLoading label="Cargando la liga de póker" />;
  if (!query.data) return <TrackerUnavailable error={query.error} />;

  /** El último torneo creado entre los cerrados: de él parte el formato de uno nuevo. */
  const lastPlayed = history.data?.reduce<PokerSession | undefined>(
    (latest, session) => (!latest || session.id > latest.id ? session : latest),
    undefined,
  );
  const league = query.data;
  const upcoming = openSessions(league);
  const current = pick(league);
  const busy = mutation.isPending;

  async function change(request: () => Promise<PokerLeagueData>) {
    if (busy) return false;
    try {
      await mutation.mutateAsync(request);
      return true;
    } catch {
      return false;
    }
  }

  return (
    <PokerFaces players={league.players}>
      <PokerProfiles sessions={history.data}>
        <SupportDialog
          variant="tip"
          open={showTip}
          onClose={closeTip}
          leftoverCents={history.data?.[0]?.leftoverCents}
        />
        <section className="poker">
          {view === 'home' ? (
            <>
              <header className="home-hero flat-panel">
                <div className="home-hero-info">
                  <ActiveLeagueDropdown variant="title" fallbackName={league.name} />
                  <div className="home-hero-pills is-meta">
                    <span className="home-hero-pill">Póker · Texas Hold’em</span>
                    {league.players.length > 0 && (
                      <button
                        type="button"
                        className="home-hero-pill-btn"
                        onClick={() => setShowPlayers(true)}
                        aria-haspopup="dialog"
                        aria-label={`${league.players.length} ${league.players.length === 1 ? 'jugador' : 'jugadores'}: ver la lista`}
                      >
                        <span className="home-hero-pill muted is-count">
                          {league.players.length}
                          <Users size={13} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="home-hero-rules"
                      aria-haspopup="dialog"
                      onClick={() => setInvite(true)}
                    >
                      <UserPlus size={15} strokeWidth={2.25} aria-hidden="true" />
                      Invitar
                    </button>
                  </div>
                </div>
              </header>
              {showPlayers && (
                <PokerPlayersDialog
                  players={league.players}
                  leagueName={league.name}
                  onClose={() => setShowPlayers(false)}
                />
              )}
              {invite && (
                <PokerInviteDialog
                  league={league}
                  busy={busy}
                  onEveryoneOrganizes={(everyone) =>
                    void change(() => setPokerOrganizing(league.id, everyone))
                  }
                  onClose={() => setInvite(false)}
                />
              )}
              <PokerHome
                league={league}
                current={current}
                sessions={history.data}
                loading={history.isPending}
                busy={busy}
                onAttend={(session, attending) =>
                  void change(() => setPokerAttendance(league.id, session.id, attending))
                }
                onRetry={() => void history.refetch()}
                onInvite={() => setInvite(true)}
              />
            </>
          ) : view !== 'table' ? (
            <h1 className="sr-only">{pokerRoutes[view].label}</h1>
          ) : null}
          {view === 'table' && (
            <>
              {form === null && (
                <PokerSessionTabs
                  sessions={upcoming}
                  selectedId={current?.id}
                  myPlayerId={league.myPlayerId}
                />
              )}
              {league.owner && (form === 'new' || (form === 'edit' && current)) ? (
                form === 'new' && history.isPending ? (
                  <PaperLoading label="Cargando la configuración" />
                ) : form === 'new' && history.isError ? (
                  <section className="paper-panel album-sheet poker-panel">
                    <p>No se pudo cargar la configuración del último torneo.</p>
                    <button
                      type="button"
                      className="glass-btn"
                      onClick={() => void history.refetch()}
                    >
                      Reintentar
                    </button>
                  </section>
                ) : (
                  <PokerSettingsForm
                    key={form}
                    editing={form === 'edit'}
                    live={
                      form === 'edit' && current?.startedAt != null ? (
                        <PokerLivePlayers
                          league={league}
                          session={current}
                          busy={busy}
                          change={change}
                        />
                      ) : undefined
                    }
                    date={(form === 'edit' && current?.date) || today()}
                    templates={form === 'new' ? history.data : undefined}
                    settings={
                      (form === 'edit' ? current?.settings : undefined) ??
                      lastPlayed?.settings ??
                      defaultSettings
                    }
                    busy={busy}
                    onCancel={() => {
                      setForm(null);
                      if (searchParams.has('nuevo')) navigate(location.pathname, { replace: true });
                    }}
                    onSave={async (date, settings) => {
                      const before = new Set(upcoming.map((session) => session.id));
                      const saved = await change(() =>
                        savePokerSession(
                          league.id,
                          date,
                          settings,
                          form === 'edit' ? (current ?? undefined) : undefined,
                        ),
                      );
                      if (saved) {
                        setForm(null);
                        // Tras programar otro, la mesa pasa a mostrar el nuevo.
                        const created = client
                          .getQueryData<PokerLeagueData>(key)
                          ?.upcoming?.find((session) => !before.has(session.id));
                        if (created)
                          navigate(`${location.pathname}?torneo=${created.id}`, { replace: true });
                      }
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
                  <>
                    <PokerLive
                      // Un torneo nuevo empieza con el estado limpio: sin borradores ni diálogos del anterior.
                      key={current.id}
                      leagueId={league.id}
                      session={current}
                      owner={league.owner}
                      busy={busy}
                      serverNow={league.serverNow}
                      receivedAt={query.dataUpdatedAt}
                      lastWinnerIds={lastWinnerIds(history.data)}
                      onEdit={() => setForm('edit')}
                      onCommand={async (action, playerId, extra) => {
                        const saved = await change(() =>
                          pokerCommand(league.id, current, action, playerId, extra),
                        );
                        if (saved && action === 'CLOSE') {
                          navigate(pokerRoutes.history.to, { state: { pokerTip: true } });
                        }
                        return saved;
                      }}
                    >
                      <PokerLateEntry
                        league={league}
                        session={current}
                        busy={busy}
                        change={change}
                      />
                    </PokerLive>
                  </>
                )
              ) : (
                <PokerFreeTable heading="Próximo torneo">
                  {league.owner ? (
                    <button
                      type="button"
                      className="glass-btn primary-btn poker-empty-cta"
                      onClick={() => setForm('new')}
                    >
                      Preparar torneo
                    </button>
                  ) : (
                    <p className="poker-empty-text">
                      El organizador abrirá aquí las inscripciones.
                    </p>
                  )}
                </PokerFreeTable>
              )}
            </>
          )}
          {(view === 'history' || view === 'statistics') &&
            (history.isPending ? (
              <PaperLoading label="Cargando los resultados" />
            ) : history.isError && !history.data ? (
              <section className="paper-panel album-sheet poker-panel">
                <h2>No se pudieron cargar los resultados</h2>
                <button type="button" className="glass-btn" onClick={() => void history.refetch()}>
                  Reintentar
                </button>
              </section>
            ) : view === 'history' ? (
              <PokerHistory
                sessions={history.data ?? []}
                admin={league.admin}
                busy={historyMutation.isPending}
                onEdit={(session, changes) =>
                  changeHistory(() => editPokerResult(league.id, session, changes))
                }
                onDelete={(session) =>
                  changeHistory(() => deletePokerResult(league.id, session.id))
                }
              />
            ) : (
              <PokerStatistics sessions={history.data ?? []} />
            ))}
        </section>
      </PokerProfiles>
    </PokerFaces>
  );
}
