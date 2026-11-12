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
import PokerHome from '../components/poker/PokerHome';
import { PokerHistory, PokerStatistics } from '../components/poker/PokerHistory';
import { defaultSettings, today } from '../components/poker/pokerFormat';
import { pokerRoutes, type PokerSection } from '../components/poker/pokerRoutes';
import {
  fetchPokerHistory,
  fetchPokerLeague,
  pokerCommand,
  savePokerSession,
  type PokerLeagueData,
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
    enabled: Boolean(query.data) && (view !== 'table' || form === 'new'),
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
    <section className="poker">
      {view === 'home' ? (
        <>
          <header className="home-hero paper-panel album-sheet">
            <div className="home-hero-info">
              <h1 className="home-hero-title">{league.name}</h1>
              <div className="home-hero-pills">
                <span className="home-hero-pill">Póker · Texas Hold’em</span>
              </div>
            </div>
            <button
              type="button"
              className="home-rules-btn"
              aria-expanded={invite}
              onClick={() => setInvite(!invite)}
            >
              {invite ? 'Cerrar invitación' : 'Invitar con enlace'}
            </button>
          </header>
          {invite && <TrackerInvite tracker={league} />}
          <PokerHome
            league={league}
            sessions={history.data}
            loading={history.isPending}
            onRetry={() => void history.refetch()}
          />
        </>
      ) : (
        <h1 className="poster-title mt-0 mb-4 text-[1.8rem] text-white">
          {pokerRoutes[view].label}
        </h1>
      )}
      {view === 'table' && (
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
                  if (saved && action === 'CLOSE') navigate(pokerRoutes.history.to);
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
  );
}
