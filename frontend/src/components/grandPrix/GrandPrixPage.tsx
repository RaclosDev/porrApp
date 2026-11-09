import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Flag, ListOrdered, Lock, Users } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import {
  fetchGrandPrixBoard,
  fetchGrandPrixMemberPicks,
  saveGrandPrixPick,
} from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { GrandPrix, GrandPrixBoard, GrandPrixPicks, RaceDriver } from '../../types/api';
import { errorMessage } from '../../utils/errors';
import PaperLoading from '../PaperLoading';
import SheetDialog from '../SheetDialog';
import RaceClassificationSheet from './RaceClassificationSheet';
import { UserAvatar } from '../Avatar';
import {
  EMPTY_PICK,
  PICK_SLOTS,
  driverLabel,
  driverShortName as shortName,
  formatWhen,
  gridDrivers,
  pickError,
  placeLabel,
  samePick,
  splitGrandsPrix,
} from './grandPrix';

type Drivers = Map<number, RaceDriver>;

/**
 * Liga de Fórmula 1: el próximo Gran Premio con su predicción (podio, pole y vuelta rápida), los
 * siguientes y los ya disputados con el resultado y los puntos de cada uno.
 */
export default function GrandPrixPage() {
  const { activeGroupId, activeGroupName, isAuthenticated, userId } = useAppContext();
  const board = useQuery({
    queryKey: queryKeys.grandPrix(activeGroupId, userId),
    queryFn: () => fetchGrandPrixBoard(activeGroupId as string | number),
    enabled: Boolean(activeGroupId && isAuthenticated),
    staleTime: 60_000,
  });
  const [picksOf, setPicksOf] = useState<GrandPrix | null>(null);
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
        <p className="gp-empty">
          Inicia sesión para ver los Grandes Premios y hacer tu predicción.
        </p>
      </section>
    );
  }
  if (board.isPending) return <PaperLoading label="Cargando los Grandes Premios" />;
  if (board.isError) {
    return (
      <section className="gp-page md-page paper-panel album-sheet">
        <p role="alert" className="gp-empty">
          No se pudieron cargar los Grandes Premios.{' '}
          <button type="button" className="glass-btn" onClick={() => board.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  const { rules } = board.data;
  const season = (live[0] ?? next ?? done[0])?.raceAt?.slice(0, 4);

  return (
    <section className="gp-page md-page paper-panel album-sheet">
      <header className="gp-header">
        <span className="gp-eyebrow">
          <Flag size={14} aria-hidden="true" /> Fórmula 1{season ? ` · ${season}` : ''}
        </span>
        <h1>{activeGroupName || 'Grandes Premios'}</h1>
        <p className="gp-rules">
          Podio exacto {rules.exactPosition} · En el podio {rules.podium} · Pole {rules.pole} ·
          Vuelta rápida {rules.fastestLap}
        </p>
      </header>

      {board.data.grandsPrix.length === 0 && (
        <p className="gp-empty">
          Aún no hay Grandes Premios cargados. El calendario llega solo desde ESPN.
        </p>
      )}

      {board.data.grandsPrix.length > 0 && !next && live.length === 0 && (
        <p className="gp-empty">No quedan Grandes Premios por disputar esta temporada.</p>
      )}

      {live.length > 0 && (
        <>
          <h2 className="gp-section-title">En juego</h2>
          {live.map((gp) => (
            <GrandPrixCard
              key={gp.id}
              gp={gp}
              drivers={drivers}
              groupId={activeGroupId}
              userId={userId}
              defaultOpen
              onShowPicks={setPicksOf}
              onShowClassification={setClassificationOf}
            />
          ))}
        </>
      )}

      {next && (
        <>
          <h2 className="gp-section-title">
            {live.length > 0 ? 'Próximo para predecir' : 'Próximo Gran Premio'}
          </h2>
          <GrandPrixCard
            gp={next}
            drivers={drivers}
            groupId={activeGroupId}
            userId={userId}
            defaultOpen
            onShowPicks={setPicksOf}
            onShowClassification={setClassificationOf}
          />
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="gp-section-title">Siguientes</h2>
          {upcoming.map((gp) => (
            <GrandPrixCard
              key={gp.id}
              gp={gp}
              drivers={drivers}
              groupId={activeGroupId}
              userId={userId}
              onShowPicks={setPicksOf}
              onShowClassification={setClassificationOf}
            />
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <h2 className="gp-section-title">Disputados</h2>
          {done.map((gp) => (
            <GrandPrixCard
              key={gp.id}
              gp={gp}
              drivers={drivers}
              groupId={activeGroupId}
              userId={userId}
              onShowPicks={setPicksOf}
              onShowClassification={setClassificationOf}
            />
          ))}
        </>
      )}

      {picksOf && activeGroupId && (
        <MemberPicksSheet
          gp={picksOf}
          groupId={activeGroupId}
          drivers={drivers}
          onClose={() => setPicksOf(null)}
        />
      )}

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

function statusText(gp: GrandPrix, drivers: Drivers): string {
  if (gp.status === 'CANCELLED') return 'Cancelado';
  if (gp.status === 'FINISHED') {
    const winner = gp.result?.first;
    return winner != null ? `Ganó ${shortName(drivers.get(winner))}` : 'Disputado';
  }
  if (gp.locked)
    return gp.status === 'LIVE' ? 'En marcha · predicción cerrada' : 'Predicción cerrada';
  return `Cierra ${formatWhen(gp.lockAt)}, al empezar la clasificación`;
}

function GrandPrixCard({
  gp,
  drivers,
  groupId,
  userId,
  defaultOpen = false,
  onShowPicks,
  onShowClassification,
}: {
  gp: GrandPrix;
  drivers: Drivers;
  groupId: string | number | null;
  userId: string | number | null;
  defaultOpen?: boolean;
  onShowPicks: (gp: GrandPrix) => void;
  onShowClassification: (gp: GrandPrix) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = `gp-body-${gp.id}`;
  const place = placeLabel(gp);
  return (
    <article className={`gp-card ${gp.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>
      <button
        type="button"
        className="gp-card-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="gp-card-title">
          <strong>{gp.name}</strong>
          <span className="gp-card-meta">
            {gp.raceAt ? `Carrera ${formatWhen(gp.raceAt)}` : ''}
            {place ? ` · ${place}` : ''}
            {gp.sprint ? ' · Sprint' : ''}
          </span>
          <span className="gp-card-status">
            {gp.locked && gp.status !== 'FINISHED' && <Lock size={12} aria-hidden="true" />}
            {statusText(gp, drivers)}
          </span>
        </span>
        <span className="gp-card-side">
          {gp.points != null ? (
            <span className="gp-points">+{gp.points}</span>
          ) : gp.pick ? (
            <span className="gp-badge">
              <Check size={12} aria-hidden="true" /> Predicho
            </span>
          ) : !gp.locked ? (
            <span className="gp-badge is-pending">Sin predecir</span>
          ) : null}
          <ChevronDown size={18} aria-hidden="true" className={open ? 'is-open' : ''} />
        </span>
      </button>

      {open && (
        <div id={bodyId} className="gp-card-body">
          {gp.status === 'CANCELLED' ? (
            <p className="gp-note">Este Gran Premio se ha cancelado: no cuenta para la liga.</p>
          ) : gp.locked ? (
            <LockedView
              gp={gp}
              drivers={drivers}
              onShowPicks={onShowPicks}
              onShowClassification={onShowClassification}
            />
          ) : (
            <PickForm gp={gp} drivers={drivers} groupId={groupId} userId={userId} />
          )}
        </div>
      )}
    </article>
  );
}

function PickForm({
  gp,
  drivers,
  groupId,
  userId,
}: {
  gp: GrandPrix;
  drivers: Drivers;
  groupId: string | number | null;
  userId: string | number | null;
}) {
  const queryClient = useQueryClient();
  const [pick, setPick] = useState<GrandPrixPicks>(gp.pick ?? EMPTY_PICK);
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => gridDrivers(gp, drivers), [gp, drivers]);
  const save = useMutation({
    mutationFn: (value: GrandPrixPicks) =>
      saveGrandPrixPick(groupId as string | number, gp.id, value),
    onSuccess: (board: GrandPrixBoard) => {
      queryClient.setQueryData(queryKeys.grandPrix(groupId, userId), board);
      toast.success(`Predicción del ${gp.name} guardada`);
    },
    onError: (reason) => setError(errorMessage(reason, 'No se pudo guardar la predicción')),
  });

  if (options.length === 0) {
    return (
      <p className="gp-note">
        ESPN aún no ha publicado los pilotos. En cuanto lleguen podrás hacer tu predicción.
      </p>
    );
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = pickError(pick);
    setError(problem);
    if (!problem) save.mutate(pick);
  };
  const saved = gp.pick != null && samePick(gp.pick, pick);

  return (
    <form className="gp-form" onSubmit={submit} noValidate>
      {PICK_SLOTS.map((slot) => {
        const id = `gp-${gp.id}-${slot.key}`;
        const value = pick[slot.key];
        const takenOnPodium =
          slot.key === 'first' || slot.key === 'second' || slot.key === 'third'
            ? new Set(
                (['first', 'second', 'third'] as const)
                  .filter((other) => other !== slot.key)
                  .map((other) => pick[other]),
              )
            : new Set<number | null>();
        return (
          <div key={slot.key} className={`gp-field gp-field-${slot.key}`}>
            <label htmlFor={id}>
              {slot.label}
              {slot.optional && <span className="gp-optional"> (opcional)</span>}
            </label>
            <select
              id={id}
              className="gp-select"
              value={value ?? ''}
              style={teamStripe(value != null ? drivers.get(value) : undefined)}
              onChange={(event) =>
                setPick((current) => ({
                  ...current,
                  [slot.key]: event.target.value ? Number(event.target.value) : null,
                }))
              }
            >
              <option value="">{slot.optional ? 'Sin elegir' : 'Elige piloto'}</option>
              {options.map((driver) => (
                <option key={driver.id} value={driver.id} disabled={takenOnPodium.has(driver.id)}>
                  {driverLabel(driver)}
                </option>
              ))}
            </select>
          </div>
        );
      })}
      {error && (
        <p className="gp-error" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="glass-btn primary-btn gp-save"
        disabled={save.isPending || saved}
      >
        {save.isPending
          ? 'Guardando…'
          : saved
            ? 'Predicción guardada'
            : gp.pick
              ? 'Cambiar predicción'
              : 'Guardar predicción'}
      </button>
      <p className="gp-note">Puedes cambiarla hasta {formatWhen(gp.lockAt)}.</p>
    </form>
  );
}

const teamStripe = (driver: RaceDriver | undefined) =>
  driver?.teamColor ? { borderLeftColor: `#${driver.teamColor}` } : undefined;

/** Resultado del Gran Premio frente a la predicción del usuario. */
function LockedView({
  gp,
  drivers,
  onShowPicks,
  onShowClassification,
}: {
  gp: GrandPrix;
  drivers: Drivers;
  onShowPicks: (gp: GrandPrix) => void;
  onShowClassification: (gp: GrandPrix) => void;
}) {
  return (
    <>
      <table className="gp-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Puesto</span>
            </th>
            <th scope="col">Resultado</th>
            <th scope="col">Tu predicción</th>
          </tr>
        </thead>
        <tbody>
          {PICK_SLOTS.map((slot) => {
            const actual = gp.result?.[slot.key] ?? null;
            const mine = gp.pick?.[slot.key] ?? null;
            const hit = actual != null && mine === actual;
            return (
              <tr key={slot.key}>
                <th scope="row">{slot.label}</th>
                <td style={teamStripe(actual != null ? drivers.get(actual) : undefined)}>
                  {actual != null ? shortName(drivers.get(actual)) : '—'}
                </td>
                <td className={hit ? 'is-hit' : ''}>
                  {mine != null ? shortName(drivers.get(mine)) : '—'}
                  {hit && <Check size={13} aria-label="Acierto" />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {gp.details && <p className="gp-note">{gp.details.replace(`${gp.name}: `, '')}</p>}
      {!gp.result && <p className="gp-note">Los resultados llegan solos al acabar cada sesión.</p>}
      <div className="gp-actions">
        {gp.status === 'FINISHED' && (
          <button
            type="button"
            className="glass-btn gp-picks-btn"
            onClick={() => onShowClassification(gp)}
          >
            <ListOrdered size={15} aria-hidden="true" /> Clasificación completa
          </button>
        )}
        <button type="button" className="glass-btn gp-picks-btn" onClick={() => onShowPicks(gp)}>
          <Users size={15} aria-hidden="true" /> Predicciones de la liga
        </button>
      </div>
    </>
  );
}

function MemberPicksSheet({
  gp,
  groupId,
  drivers,
  onClose,
}: {
  gp: GrandPrix;
  groupId: string | number;
  drivers: Drivers;
  onClose: () => void;
}) {
  const picks = useQuery({
    queryKey: queryKeys.grandPrixPicks(groupId, gp.id),
    queryFn: () => fetchGrandPrixMemberPicks(groupId, gp.id),
  });
  const name = (id: number | null) => (id == null ? '—' : shortName(drivers.get(id)));
  return (
    <SheetDialog title={gp.name} subtitle="Predicciones de la liga" onClose={onClose}>
      <div className="sheet-dialog-body gp-member-list">
        {picks.isPending && <PaperLoading label="Cargando predicciones" embedded />}
        {picks.isError && <p role="alert">No se pudieron cargar las predicciones.</p>}
        {picks.data?.length === 0 && (
          <p className="gp-note">Nadie hizo predicción en este Gran Premio.</p>
        )}
        {picks.data?.map((member) => (
          <div key={`${member.userId}-${member.name}`} className="gp-member">
            <UserAvatar
              url={member.avatarUrl}
              name={member.name}
              userId={member.userId}
              size={34}
            />
            <div className="gp-member-copy">
              <strong>
                {member.name}
                {member.mine ? ' (tú)' : ''}
              </strong>
              <span>
                {name(member.pick.first)}, {name(member.pick.second)}, {name(member.pick.third)} ·
                Pole {name(member.pick.pole)}
                {member.pick.fastestLap != null ? ` · VR ${name(member.pick.fastestLap)}` : ''}
              </span>
            </div>
            {member.points != null && <span className="gp-points">+{member.points}</span>}
          </div>
        ))}
      </div>
    </SheetDialog>
  );
}
