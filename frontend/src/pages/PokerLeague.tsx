import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PaperLoading from '../components/PaperLoading';
import SupportDialog from '../components/SupportDialog';
import TrackerInvite from '../components/tracker/TrackerInvite';
import TrackerUnavailable from '../components/tracker/TrackerUnavailable';
import PokerRegistration from '../components/poker/PokerRegistration';
import PokerSettingsForm from '../components/poker/PokerSettingsForm';
import PokerLive from '../components/poker/PokerLive';
import PokerHome from '../components/poker/PokerHome';
import { lastWinnerIds } from '../components/poker/PokerBadges';
import { PokerFaces } from '../components/poker/PokerFaces';
import { PokerHistory, PokerStatistics } from '../components/poker/PokerHistory';
import { defaultSettings, today } from '../components/poker/pokerFormat';
import { pokerRoutes, type PokerSection } from '../components/poker/pokerRoutes';
import {
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
      (view !== 'table' || form === 'new' || Boolean(query.data?.current?.startedAt)),
    refetchInterval: view === 'table' ? false : 15000,
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
            {league.owner &&
            ((form === 'new' && !current) || (form === 'edit' && current?.startedAt === null)) ? (
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
                  date={current?.date ?? today()}
                  settings={
                    current?.settings ??
                    history.data?.reduce<PokerSession | undefined>(
                      (latest, session) => (!latest || session.id > latest.id ? session : latest),
                      undefined,
                    )?.settings ??
                    defaultSettings
                  }
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
            <PokerHistory sessions={history.data ?? []} />
          ) : (
            <PokerStatistics sessions={history.data ?? []} />
          ))}
      </section>
    </PokerFaces>
  );
}
