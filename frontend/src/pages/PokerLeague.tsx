import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PaperLoading from '../components/PaperLoading';
import SupportDialog from '../components/SupportDialog';
import TrackerInvite from '../components/tracker/TrackerInvite';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import PokerRegistration from '../components/poker/PokerRegistration';
import PokerSettingsForm from '../components/poker/PokerSettingsForm';
import PokerLive from '../components/poker/PokerLive';
import PokerLateEntry from '../components/poker/PokerLateEntry';
import PokerHome from '../components/poker/PokerHome';
import PokerSessionTabs from '../components/poker/PokerSessionTabs';
import { lastWinnerIds } from '../components/poker/PokerBadges';
import { PokerFaces } from '../components/poker/PokerFaces';
import { PokerHistory, PokerStatistics } from '../components/poker/PokerHistory';
import { defaultSettings, today } from '../components/poker/pokerFormat';
import { pokerRoutes, type PokerSection } from '../components/poker/pokerRoutes';
import {
  deletePokerResult,
  editPokerResult,
  fetchPokerHistory,
  fetchPokerLeague,
  pokerCommand,
  savePokerSession,
  type PokerLeagueData,
  type PokerSession,
} from '../services/endpoints/poker';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import '../styles/poker.css';

/** Igual que en el backend: torneos abiertos a la vez por liga. */
const MAX_OPEN_SESSIONS = 5;

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
  const [form, setForm] = useState<'new' | 'edit' | null>(null);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedSession = searchParams.get('torneo');
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
      <SupportDialog variant="tip" open={showTip} onClose={closeTip} />
      <section className="poker">
        {view === 'home' ? (
          <>
            <header className="home-hero paper-panel album-sheet">
              <div className="home-hero-info">
                <h1 className="home-hero-title">{league.name}</h1>
                <div className="home-hero-pills is-spread">
                  <span className="home-hero-pill">Póker · Texas Hold’em</span>
                  <button
                    type="button"
                    className="home-rules-btn home-hero-invite"
                    aria-expanded={invite}
                    onClick={() => setInvite(!invite)}
                  >
                    {invite ? 'Cerrar' : 'Invitar'}
                  </button>
                </div>
              </div>
            </header>
            {invite && <TrackerInvite tracker={league} />}
            <PokerHome
              league={league}
              current={current}
              sessions={history.data}
              loading={history.isPending}
              onRetry={() => void history.refetch()}
              onInvite={() => {
                setInvite(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
            {form === null && league.owner && current && upcoming.length < MAX_OPEN_SESSIONS && (
              <button
                type="button"
                className="glass-btn poker-schedule-another"
                onClick={() => setForm('new')}
              >
                Programar otro torneo
              </button>
            )}
            {league.owner &&
            (form === 'new' || (form === 'edit' && current?.startedAt === null)) ? (
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
                  date={(form === 'edit' && current?.date) || today()}
                  settings={
                    (form === 'edit' ? current?.settings : undefined) ??
                    history.data?.reduce<PokerSession | undefined>(
                      (latest, session) => (!latest || session.id > latest.id ? session : latest),
                      undefined,
                    )?.settings ??
                    defaultSettings
                  }
                  busy={busy}
                  onCancel={() => setForm(null)}
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
                    leagueId={league.id}
                    session={current}
                    owner={league.owner}
                    busy={busy}
                    serverNow={league.serverNow}
                    receivedAt={query.dataUpdatedAt}
                    lastWinnerIds={lastWinnerIds(history.data)}
                    onCommand={async (action, playerId, extra) => {
                      const saved = await change(() =>
                        pokerCommand(league.id, current, action, playerId, extra),
                      );
                      if (saved && action === 'CLOSE') {
                        navigate(pokerRoutes.history.to, { state: { pokerTip: true } });
                      }
                    }}
                  />
                  <PokerLateEntry league={league} session={current} busy={busy} change={change} />
                </>
              )
            ) : (
              <section className="poker-felt poker-empty" aria-labelledby="poker-empty-title">
                <span className="poker-empty-suits" aria-hidden="true">
                  ♠ ♥ ♣ ♦
                </span>
                <h2 id="poker-empty-title">Próximo torneo</h2>
                <p className="poster-title poker-empty-title">La mesa está libre</p>
                <p className="poker-empty-text">
                  {league.owner
                    ? 'Elige la fecha y las reglas para abrir las inscripciones.'
                    : 'El organizador abrirá las inscripciones del próximo torneo aquí.'}
                </p>
                {league.owner && (
                  <button
                    type="button"
                    className="glass-btn primary-btn poker-empty-cta"
                    onClick={() => setForm('new')}
                  >
                    Preparar torneo
                  </button>
                )}
                <ol className="poker-steps">
                  <li>
                    <strong>Inscripciones</strong>
                    <span>
                      {league.owner
                        ? 'Fijas fecha, entrada y ciegas, y cada jugador confirma si viene.'
                        : 'Verás la fecha y la entrada, y podrás confirmar si vienes.'}
                    </span>
                  </li>
                  <li>
                    <strong>Partida</strong>
                    <span>
                      El reloj de ciegas, las eliminaciones y el bote se siguen desde aquí.
                    </span>
                  </li>
                  <li>
                    <strong>Cierre</strong>
                    <span>Los premios y los puestos quedan guardados en el histórico.</span>
                  </li>
                </ol>
              </section>
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
              onEdit={(session, date, standings) =>
                changeHistory(() => editPokerResult(league.id, session, date, standings))
              }
              onDelete={(session) => changeHistory(() => deletePokerResult(league.id, session.id))}
            />
          ) : (
            <PokerStatistics sessions={history.data ?? []} />
          ))}
      </section>
    </PokerFaces>
  );
}
