import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronRight, Lock } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { fetchFormulaOneStandings, fetchGrandPrixBoard } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { GrandPrix, RaceDriver } from '../../types/api';
import PaperLoading from '../PaperLoading';
import { MiniRow, PanelHeader } from '../Home/LeagueHomeDashboard';
import RaceClassificationSheet from './RaceClassificationSheet';
import { DriverFace } from './DriverFace';
import { driverShortName, formatWhen, placeLabel, splitGrandsPrix } from './grandPrix';

type Drivers = Map<number, RaceDriver>;

/** Próximas carreras en el inicio: la que está en juego y las dos siguientes. */
const NEXT_COUNT = 2;
/** Disputadas a la vista antes de «Ver todas». */
const DONE_COUNT = 4;
const TOP_COUNT = 5;

/**
 * Inicio de una liga de carreras, como el de las ligas por jornadas: las dos próximas carreras con tu
 * predicción, el ranking de la liga, el Mundial y las ya disputadas con su podio.
 */
export default function GrandPrixHome() {
  const {
    activeGroupId,
    activeGroupName,
    activeCompetitionName,
    isAuthenticated,
    leaderboardData,
    userId,
    userName,
  } = useAppContext();
  const navigate = useNavigate();
  const board = useQuery({
    queryKey: queryKeys.grandPrix(activeGroupId, userId),
    queryFn: () => fetchGrandPrixBoard(activeGroupId as string | number),
    enabled: Boolean(activeGroupId && isAuthenticated),
    staleTime: 60_000,
  });
  const standings = useQuery({
    queryKey: queryKeys.formulaOneStandings(activeGroupId),
    queryFn: () => fetchFormulaOneStandings(activeGroupId as string | number),
    enabled: Boolean(activeGroupId && isAuthenticated),
    staleTime: 5 * 60_000,
  });
  const [showAllDone, setShowAllDone] = useState(false);
  const [classificationOf, setClassificationOf] = useState<GrandPrix | null>(null);

  const drivers: Drivers = useMemo(
    () => new Map((board.data?.drivers ?? []).map((driver) => [driver.id, driver])),
    [board.data],
  );
  const { live, next, upcoming, done } = useMemo(
    () => splitGrandsPrix(board.data?.grandsPrix ?? []),
    [board.data],
  );

  if (!isAuthenticated) {
    return (
      <section className="gp-page md-page paper-panel album-sheet">
        <p className="gp-empty">Inicia sesión para ver las carreras y hacer tu predicción.</p>
      </section>
    );
  }
  if (board.isPending) return <PaperLoading label="Cargando las carreras" />;
  if (board.isError) {
    return (
      <section className="gp-page md-page paper-panel album-sheet">
        <p role="alert" className="gp-empty">
          No se pudieron cargar las carreras.{' '}
          <button type="button" className="glass-btn" onClick={() => board.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  const coming = [...live, ...(next ? [next] : []), ...upcoming].slice(
    0,
    Math.max(NEXT_COUNT, live.length),
  );
  const missing = [next, ...upcoming].filter(
    (gp): gp is GrandPrix => gp != null && !gp.pick && coming.includes(gp),
  );
  const season = (live[0] ?? next ?? done[0])?.raceAt?.slice(0, 4);
  const shownDone = showAllDone ? done : done.slice(0, DONE_COUNT);
  const ranking = (leaderboardData ?? []).slice(0, TOP_COUNT);
  const rankingTotals = [...new Set(ranking.map((p) => p.total || 0))];
  const topDrivers = (standings.data?.drivers ?? []).slice(0, TOP_COUNT);

  return (
    <section className="view-section active max-w-270 my-0 mx-auto pt-1 pb-6 px-0">
      <header className="home-hero paper-panel album-sheet">
        <div className="home-hero-info">
          <h1 className="home-hero-title">{activeGroupName || 'Carreras'}</h1>
          <div className="home-hero-pills">
            <span className="home-hero-pill">
              {activeCompetitionName || 'Fórmula 1'}
              {season ? ` · ${season}` : ''}
            </span>
            <span className="home-hero-pill muted">
              {done.filter((gp) => gp.status === 'FINISHED').length} de{' '}
              {board.data.grandsPrix.filter((gp) => gp.status !== 'CANCELLED').length} carreras
            </span>
          </div>
        </div>
      </header>

      {missing.length > 0 && (
        <button
          type="button"
          className="paper-panel album-sheet w-full flex items-center justify-between gap-3 px-4 py-3 mb-4.5 text-left cursor-pointer font-[inherit] border-0"
          onClick={() => navigate('/jornadas')}
        >
          <span className="font-bold text-[var(--stamp-red)]">
            Te falta la predicción{' '}
            {missing.length === 1 ? `del ${missing[0].name}` : 'de las próximas carreras'}
          </span>
          <span className="shrink-0 font-bold">Predecir →</span>
        </button>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,_minmax(300px,_1fr))] gap-4.5">
        <div className="flex flex-col gap-4.5 min-w-0">
          <div className="paper-panel album-sheet flex flex-col gap-2 min-w-0 p-4">
            <PanelHeader title="Próximas carreras" onSeeAll={() => navigate('/jornadas')} />
            {coming.length > 0 ? (
              coming.map((gp) => (
                <NextRaceCard
                  key={gp.id}
                  gp={gp}
                  drivers={drivers}
                  onOpen={() => navigate('/jornadas')}
                />
              ))
            ) : (
              <p className="gp-empty">
                {board.data.grandsPrix.length === 0
                  ? 'Aún no hay carreras cargadas. El calendario llega solo.'
                  : 'No quedan carreras por disputar esta temporada.'}
              </p>
            )}
          </div>

          {done.length > 0 && (
            <div className="paper-panel album-sheet flex flex-col gap-2 min-w-0 p-4">
              <PanelHeader title="Disputadas" onSeeAll={() => navigate('/jornadas')} />
              <ul className="gp-done-list">
                {shownDone.map((gp) => (
                  <DoneRaceRow
                    key={gp.id}
                    gp={gp}
                    drivers={drivers}
                    onOpen={gp.status === 'FINISHED' ? () => setClassificationOf(gp) : undefined}
                  />
                ))}
              </ul>
              {done.length > DONE_COUNT && (
                <button
                  type="button"
                  className="home-link-btn self-center"
                  aria-expanded={showAllDone}
                  onClick={() => setShowAllDone((value) => !value)}
                >
                  {showAllDone ? 'Ver menos' : `Ver las ${done.length} disputadas`}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4.5 min-w-0">
          <div className="paper-panel album-sheet p-4">
            <PanelHeader title="Ranking" onSeeAll={() => navigate('/ranking')} />
            {ranking.length > 0 ? (
              <ol className="flex flex-col gap-1.5 m-0 p-0 list-none" aria-label="Top del ranking">
                {ranking.map((p, index) => {
                  const isMe = p.userId?.toString() === userId?.toString() || p.name === userName;
                  return (
                    <MiniRow
                      key={p.id ?? `member-${p.userId ?? index}`}
                      rank={rankingTotals.indexOf(p.total || 0) + 1}
                      name={`${p.name}${isMe ? ' (Tú)' : ''}`}
                      value={`${p.total || 0} pts`}
                      highlighted={isMe}
                    />
                  );
                })}
              </ol>
            ) : (
              <div className="text-center text-muted text-[0.85rem] p-3">
                Aún no hay puntuaciones en esta liga.
              </div>
            )}
          </div>

          {topDrivers.length > 0 && (
            <div className="paper-panel album-sheet p-4">
              <PanelHeader title="Mundial de pilotos" onSeeAll={() => navigate('/tabla')} />
              <ol
                className="flex flex-col gap-1.5 m-0 p-0 list-none"
                aria-label="Mundial de pilotos"
              >
                {topDrivers.map((driver) => (
                  <MiniRow
                    key={`${driver.rank}-${driver.name}`}
                    rank={driver.rank}
                    name={driver.name}
                    detail={driver.team ?? undefined}
                    value={`${driver.points} pts`}
                    crest={
                      <DriverFace
                        name={driver.name}
                        url={driver.headshotUrl}
                        color={driver.teamColor}
                        size={26}
                      />
                    }
                  />
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>

      {classificationOf && activeGroupId && (
        <RaceClassificationSheet
          gp={classificationOf}
          groupId={activeGroupId}
          onClose={() => setClassificationOf(null)}
        />
      )}
    </section>
  );
}

const PODIUM = ['first', 'second', 'third'] as const;

/** Tus tres del podio, en pequeño, o lo que falta por hacer. */
function NextRaceCard({
  gp,
  drivers,
  onOpen,
}: {
  gp: GrandPrix;
  drivers: Drivers;
  onOpen: () => void;
}) {
  const place = placeLabel(gp);
  const pick = gp.pick;
  return (
    <button type="button" className="gp-next" onClick={onOpen}>
      <span className="gp-next-copy">
        <strong>{gp.name}</strong>
        <span className="gp-card-meta">
          {gp.raceAt ? formatWhen(gp.raceAt) : 'Fecha por confirmar'}
          {place ? ` · ${place}` : ''}
          {gp.sprint ? ' · Sprint' : ''}
        </span>
        <span className="gp-card-status">
          {gp.locked ? (
            <>
              <Lock size={12} aria-hidden="true" />
              {gp.status === 'LIVE' ? 'En marcha · predicción cerrada' : 'Predicción cerrada'}
            </>
          ) : (
            `Cierra ${formatWhen(gp.lockAt)}`
          )}
        </span>
      </span>
      <span className="gp-next-side">
        {pick ? (
          <>
            <span className="gp-face-stack" aria-label="Tu podio">
              {PODIUM.map((slot) => {
                const driver = pick[slot] != null ? drivers.get(pick[slot]) : undefined;
                return driver ? (
                  <DriverFace
                    key={slot}
                    name={driverShortName(driver)}
                    url={driver.headshotUrl}
                    color={driver.teamColor}
                    size={30}
                  />
                ) : null;
              })}
            </span>
            <span className="gp-badge">
              <Check size={12} aria-hidden="true" /> Predicho
            </span>
          </>
        ) : !gp.locked ? (
          <span className="gp-badge is-pending">Sin predecir</span>
        ) : null}
        <ChevronRight size={18} aria-hidden="true" />
      </span>
    </button>
  );
}

/** Carrera disputada: el podio con sus caras y tus puntos. */
function DoneRaceRow({
  gp,
  drivers,
  onOpen,
}: {
  gp: GrandPrix;
  drivers: Drivers;
  onOpen?: () => void;
}) {
  const podium = PODIUM.map((slot) => {
    const id = gp.result?.[slot];
    return id != null ? drivers.get(id) : undefined;
  });
  const body = (
    <>
      <span className="gp-done-copy">
        <strong>{gp.name}</strong>
        <span className="gp-card-meta">
          {gp.status === 'CANCELLED' ? 'Cancelada' : gp.raceAt ? formatWhen(gp.raceAt) : ''}
        </span>
      </span>
      {gp.status !== 'CANCELLED' && (
        <span className="gp-done-podium">
          {podium.map((driver, index) =>
            driver ? (
              <span key={driver.id} className="gp-done-driver">
                <DriverFace
                  name={driverShortName(driver)}
                  url={driver.headshotUrl}
                  color={driver.teamColor}
                  size={index === 0 ? 34 : 28}
                />
                <span>
                  <span className="sr-only">{index + 1}.º </span>
                  {driverShortName(driver)}
                </span>
              </span>
            ) : null,
          )}
        </span>
      )}
      {gp.points != null && <span className="gp-points">+{gp.points}</span>}
    </>
  );
  return (
    <li>
      {onOpen ? (
        <button type="button" className="gp-done" onClick={onOpen}>
          {body}
          <span className="sr-only">Ver la clasificación completa</span>
        </button>
      ) : (
        <div className="gp-done">{body}</div>
      )}
    </li>
  );
}
