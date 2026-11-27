import { Coins, HandCoins, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { PokerResultsEdit, PokerSession } from '../../services/endpoints/poker';
import { confirmAction } from '../../utils/confirmAction';
import SheetDialog from '../SheetDialog';
import { Purchases } from './PokerBadges';
import PokerEmpty from './PokerEmpty';
import { PokerAvatar } from './PokerFaces';
import { PokerPlayerName } from './PokerPlayerCard';
import PokerPodium from './PokerPodium';
import PokerResultEditor from './PokerResultEditor';
import { FullPrizesTip } from './PokerCloseDialog';
import {
  chips,
  euros,
  percent,
  pokerStandings,
  settlements,
  shortDate,
  signedEuros,
  pointsText,
  standingLabel,
  tournamentDate,
} from './pokerFormat';
import { pokerRoutes } from './pokerRoutes';
import SelectMenu from '../SelectMenu';

function Net({ cents, paidCents }: { cents: number; paidCents?: number }) {
  return (
    <td className={cents > 0 ? 'poker-net is-up' : cents < 0 ? 'poker-net is-down' : 'poker-net'}>
      {signedEuros(cents)}
      {/* En el móvil no cabe la columna de lo aportado: baja bajo el neto. */}
      {paidCents != null && <small className="poker-row-extra">aportó {euros(paidCents)}</small>}
    </td>
  );
}

interface HistoryProps {
  sessions: PokerSession[];
  /** Con `admin`, botones para corregir o borrar el torneo que se ve. */
  admin?: boolean;
  busy?: boolean;
  onEdit?: (session: PokerSession, changes: PokerResultsEdit) => Promise<boolean>;
  onDelete?: (session: PokerSession) => Promise<boolean>;
}

export function PokerHistory({
  sessions,
  admin = false,
  busy = false,
  onEdit,
  onDelete,
}: HistoryProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'payments' | 'edit' | null>(null);
  // Orden cronológico, como las jornadas: «anterior» lleva al torneo más antiguo.
  const ordered = [...sessions].reverse();
  const found = ordered.findIndex((session) => session.id === selectedId);
  const index = found === -1 ? ordered.length - 1 : found;
  const session = ordered[index];
  // Solo los torneos finalizados por fichas tienen esa columna; en móvil va bajo el nombre.
  const hasChips = session?.results.some((result) => result.finalChips != null) ?? false;
  const payments = session ? settlements(session.results) : [];

  async function remove(target: PokerSession) {
    const confirmed = await confirmAction({
      title: 'Borrar torneo',
      message: `Se quitará el torneo del ${tournamentDate(target.date)} del histórico y de las estadísticas. No se puede deshacer.`,
      confirmLabel: 'Borrar torneo',
    });
    if (confirmed && (await onDelete?.(target))) setSelectedId(null);
  }

  return (
    <section className="paper-panel album-sheet poker-panel">
      <h2>Histórico de torneos</h2>
      {!session ? (
        <PokerEmpty
          icon="history"
          title="Aún no hay torneos cerrados"
          action={{ to: pokerRoutes.table.to, label: 'Ir a la mesa' }}
        >
          Al cerrar cada torneo quedan aquí la clasificación, los premios y las recompras.
        </PokerEmpty>
      ) : (
        <>
          <div className="md-round-bar poker-round-bar">
            <button
              type="button"
              className="glass-btn md-round-step"
              onClick={() => setSelectedId(ordered[index - 1].id)}
              disabled={index === 0}
              aria-label="Torneo anterior"
            >
              ‹
            </button>
            <SelectMenu
              className="md-round-select"
              label="Seleccionar torneo"
              value={String(session.id)}
              onChange={(next) => setSelectedId(Number(next))}
              items={ordered.map((item, position) => ({
                value: String(item.id),
                label: `Torneo ${position + 1} · ${shortDate(item.date)}`,
              }))}
            />
            <button
              type="button"
              className="glass-btn md-round-step"
              onClick={() => setSelectedId(ordered[index + 1].id)}
              disabled={index === ordered.length - 1}
              aria-label="Torneo siguiente"
            >
              ›
            </button>
          </div>
          <dl className="poker-history-facts">
            <div>
              <dt>Jugadores</dt>
              <dd>{session.results.length}</dd>
            </div>
            <div>
              <dt>Bote</dt>
              <dd>{euros(session.potCents)}</dd>
            </div>
            <div>
              <dt>Entrada</dt>
              <dd>{euros(session.settings.buyInCents)}</dd>
            </div>
            <div>
              <dt>Fichas</dt>
              <dd>{chips(session.settings.startingChips)}</dd>
            </div>
          </dl>
          {(session.leftoverCents ?? 0) !== 0 && (
            <p className="poker-history-leftover">
              {(session.leftoverCents ?? 0) > 0 ? 'Sobran' : 'Repartido de más:'}{' '}
              <strong>{euros(Math.abs(session.leftoverCents ?? 0))}</strong>
              {(session.leftoverCents ?? 0) > 0 && ' sin repartir'}
              <FullPrizesTip rows={session.results} leftoverCents={session.leftoverCents ?? 0} />
            </p>
          )}
          {(payments.length > 0 || admin) && (
            <div className="poker-actions poker-history-actions">
              {payments.length > 0 && (
                <button
                  type="button"
                  className="glass-btn poker-history-payments-btn"
                  aria-haspopup="dialog"
                  aria-label={`Quién paga a quién · ${payments.length} ${payments.length === 1 ? 'pago' : 'pagos'}`}
                  onClick={() => setSheet('payments')}
                >
                  <HandCoins size={20} aria-hidden="true" />
                  <span>Quién paga a quién</span>
                  <span className="poker-history-payments-count">{payments.length}</span>
                </button>
              )}
              {admin && onEdit && (
                <button
                  type="button"
                  className="glass-btn poker-history-icon-btn"
                  aria-haspopup="dialog"
                  aria-label="Editar"
                  title="Editar el torneo"
                  disabled={busy}
                  onClick={() => setSheet('edit')}
                >
                  <Pencil size={18} aria-hidden="true" />
                </button>
              )}
              {admin && onDelete && (
                <button
                  type="button"
                  className="glass-btn poker-out-btn poker-history-icon-btn"
                  aria-label="Borrar"
                  title="Borrar el torneo"
                  disabled={busy}
                  onClick={() => void remove(session)}
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {sheet === 'payments' && (
            <SheetDialog
              title="Quién paga a quién"
              subtitle={tournamentDate(session.date)}
              onClose={() => setSheet(null)}
            >
              <div className="sheet-dialog-body">
                <ul className="poker-payments" aria-label="Pagos para saldar el torneo">
                  {payments.map((payment) => (
                    <li
                      key={`${payment.fromId}-${payment.toId}`}
                      className={payment.toId === null ? 'is-leftover' : undefined}
                    >
                      <PokerAvatar playerId={payment.fromId} name={payment.from} size={32} />
                      {payment.toId === null ? (
                        <span>
                          <strong>{payment.from}</strong> paga al <strong>sobrante</strong>
                        </span>
                      ) : (
                        <span>
                          <strong>{payment.from}</strong> paga a <strong>{payment.to}</strong>
                        </span>
                      )}
                      <strong className="poker-payment-amount">{euros(payment.cents)}</strong>
                      {payment.toId === null ? (
                        <span className="poker-payment-pot" aria-hidden="true">
                          <Coins size={18} />
                        </span>
                      ) : (
                        <PokerAvatar playerId={payment.toId} name={payment.to} size={32} />
                      )}
                    </li>
                  ))}
                </ul>
                {(session.leftoverCents ?? 0) > 0 && (
                  <p className="poker-payments-leftover">
                    Sobran <strong>{euros(session.leftoverCents ?? 0)}</strong> del bote sin
                    repartir: no tienen dueño, se quedan para lo que decida la mesa.
                    <FullPrizesTip
                      rows={session.results}
                      leftoverCents={session.leftoverCents ?? 0}
                    />
                  </p>
                )}
                <p className="poker-note">
                  Pagos mínimos según lo aportado y el premio de cada jugador. Si ya pagasteis en la
                  mesa, no hace falta nada.
                </p>
              </div>
            </SheetDialog>
          )}
          {sheet === 'edit' && onEdit && (
            <PokerResultEditor
              key={session.id}
              session={session}
              busy={busy}
              onSave={(changes) => onEdit(session, changes)}
              onClose={() => setSheet(null)}
            />
          )}
          <PokerPodium
            label="Podio del torneo"
            places={session.results.slice(0, 3).map((result) => ({
              playerId: result.playerId,
              place: result.place,
              name: result.name,
              rebuys: result.rebuys,
              addOns: result.addOns,
              value: result.prizeCents > 0 ? euros(result.prizeCents) : 'Sin premio',
            }))}
          />
          <div
            className="poker-table-scroll"
            role="region"
            aria-label={`Resultados del ${tournamentDate(session.date)}`}
            tabIndex={0}
          >
            <table className="poker-table poker-results-table">
              <thead>
                <tr>
                  <th scope="col">Puesto</th>
                  <th scope="col">Jugador</th>
                  {hasChips && (
                    <th scope="col" className="poker-col-chips">
                      Fichas finales
                    </th>
                  )}
                  <th scope="col" className="poker-col-paid">
                    Aportado
                  </th>
                  <th scope="col">Premio</th>
                  <th scope="col" className="poker-col-points">
                    Puntos
                  </th>
                  <th scope="col">Neto</th>
                </tr>
              </thead>
              <tbody>
                {session.results.map((result) => (
                  <tr key={result.playerId}>
                    <td>
                      <PlaceBadge place={result.place} />
                    </td>
                    <th scope="row">
                      <span className="poker-player">
                        <PokerAvatar
                          playerId={result.playerId}
                          name={result.name}
                          size={28}
                          zoomable
                        />
                        <span>
                          <PokerPlayerName playerId={result.playerId} name={result.name} />
                          {result.finalChips != null && (
                            <small className="poker-row-extra">
                              {chips(result.finalChips)} fichas
                            </small>
                          )}
                          {(result.rebuys > 0 || result.addOns > 0) && (
                            <Purchases rebuys={result.rebuys} addOns={result.addOns} inline />
                          )}
                        </span>
                      </span>
                    </th>
                    {hasChips && (
                      <td className="poker-col-chips">
                        {result.finalChips == null ? '—' : chips(result.finalChips)}
                      </td>
                    )}
                    <td className="poker-col-paid">{euros(result.paidCents)}</td>
                    <td className={result.prizeCents > 0 ? 'poker-strong' : undefined}>
                      {euros(result.prizeCents)}
                      <small className="poker-points-extra">
                        {pointsText(result.points ?? 0)} pts
                      </small>
                    </td>
                    <td className="poker-col-points">{pointsText(result.points ?? 0)}</td>
                    <Net
                      cents={result.prizeCents - result.paidCents}
                      paidCents={result.paidCents}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

type Standing = ReturnType<typeof pokerStandings>[number];
const statisticColumns: {
  label: string;
  value: (row: Standing) => number | string;
  /** Si sube cuanto más bajo es (el puesto medio): el primer clic ordena de menor a mayor. */
  lowFirst?: boolean;
}[] = [
  { label: 'Jugador', value: (row) => row.name, lowFirst: true },
  { label: 'Puntos', value: (row) => row.points },
  { label: 'Torneos', value: (row) => row.played },
  { label: 'Recompras', value: (row) => row.rebuys },
  { label: 'Add-ons', value: (row) => row.addOns },
  { label: 'Victorias', value: (row) => row.wins },
  { label: '% victorias', value: (row) => row.wins / row.played },
  { label: 'Podios', value: (row) => row.podiums },
  { label: 'Aplausos', value: (row) => row.applause },
  { label: '% con premio', value: (row) => row.cashes / row.played },
  { label: 'Puesto medio', value: (row) => row.places / row.played, lowFirst: true },
  { label: 'Premios', value: (row) => row.prizes },
  { label: 'Neto', value: (row) => row.prizes - row.paid },
  { label: 'ROI', value: (row) => roi(row) ?? -Infinity },
  { label: 'Racha', value: (row) => row.streak },
  { label: 'Mejor racha', value: (row) => row.bestStreak },
];

/** Grupos de columnas de la cabecera, en el orden de `statisticColumns` sin el jugador. */
const statisticGroups = [
  { label: 'Participación', span: 3 },
  { label: 'Resultados', span: 6 },
  { label: 'Dinero', span: 3 },
  { label: 'Rachas', span: 2 },
];

/** Flechas de ordenar: las dos tenues sin orden; la del sentido elegido, marcada. */
function SortIcon() {
  return (
    <svg className="poker-sort-icon" viewBox="0 0 12 16" width="10" height="14" aria-hidden="true">
      <path className="poker-sort-up" d="M2 6.5 6 2.5l4 4" />
      <path className="poker-sort-down" d="M2 9.5l4 4 4-4" />
    </svg>
  );
}

/** Puesto con medalla para los tres primeros. */
function PlaceBadge({ place }: { place: number }) {
  return (
    <span className={`poker-place-badge${place <= 3 ? ` is-podium-${place}` : ''}`}>{place}</span>
  );
}

/** Rentabilidad: neto entre lo aportado; no existe si el jugador nunca puso dinero. */
const roi = (row: Standing) => (row.paid > 0 ? (row.prizes - row.paid) / row.paid : null);

export function PokerStatistics({ sessions }: { sessions: PokerSession[] }) {
  const standings = pokerStandings(sessions);
  const rankOf = new Map(standings.map((row) => [row.playerId, row.rank]));
  const [sort, setSort] = useState<{ column: number; ascending: boolean } | null>(null);
  // Al desplazar la tabla en horizontal, la columna fija se queda en la foto y deja ver los datos.
  const [scrolled, setScrolled] = useState(false);
  const sorted = [...standings];
  if (sort) {
    const { value } = statisticColumns[sort.column];
    sorted.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const comparison =
        typeof left === 'string' && typeof right === 'string'
          ? left.localeCompare(right, 'es', { sensitivity: 'base' })
          : Number(left) - Number(right);
      return (
        (sort.ascending ? comparison : -comparison) ||
        a.name.localeCompare(b.name, 'es') ||
        a.playerId - b.playerId
      );
    });
  }
  const formatPlace = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  return (
    <section className="paper-panel album-sheet poker-panel">
      <h2>Estadísticas de la liga</h2>
      {standings.length === 0 ? (
        <PokerEmpty
          icon="stats"
          title="Sin estadísticas todavía"
          action={{ to: pokerRoutes.table.to, label: 'Ir a la mesa' }}
        >
          Con el primer torneo cerrado verás victorias, podios, aplausos y el neto de cada jugador.
        </PokerEmpty>
      ) : (
        <>
          <p className="poker-note">
            {sessions.length} {sessions.length === 1 ? 'torneo cerrado' : 'torneos cerrados'} ·{' '}
            {standings.length} jugadores
          </p>
          <PokerPodium
            label="Podio de la liga por puntos"
            places={standings.slice(0, 3).map((row) => ({
              playerId: row.playerId,
              name: row.name,
              value: standingLabel(row),
            }))}
          />
          <div
            className={`poker-table-scroll${scrolled ? ' is-scrolled' : ''}`}
            role="region"
            aria-label="Clasificación de la liga de póker"
            tabIndex={0}
            onScroll={(event) => {
              // Margen distinto para plegar y desplegar: al plegarse la columna, la tabla mengua.
              const left = event.currentTarget.scrollLeft;
              if (!scrolled && left > 24) setScrolled(true);
              else if (scrolled && left <= 4) setScrolled(false);
            }}
          >
            <table className="poker-table poker-stats-table">
              <thead>
                <tr className="poker-table-groups">
                  <td />
                  {statisticGroups.map((group) => (
                    <th key={group.label} scope="colgroup" colSpan={group.span}>
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {statisticColumns.map((column, index) => (
                    <th
                      key={column.label}
                      scope="col"
                      aria-sort={
                        sort?.column === index
                          ? sort.ascending
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        type="button"
                        className="poker-sort"
                        onClick={() =>
                          setSort((previous) => ({
                            column: index,
                            ascending:
                              previous?.column === index
                                ? !previous.ascending
                                : Boolean(column.lowFirst),
                          }))
                        }
                      >
                        <span>{column.label}</span>
                        <SortIcon />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.playerId}>
                    <th scope="row">
                      <span className="poker-player">
                        <PlaceBadge place={rankOf.get(row.playerId) ?? 0} />
                        <PokerAvatar playerId={row.playerId} name={row.name} size={28} zoomable />
                        <PokerPlayerName
                          playerId={row.playerId}
                          name={row.name}
                          className="poker-stats-name"
                        />
                      </span>
                    </th>
                    <td className="poker-strong">{pointsText(row.points)}</td>
                    <td>{row.played}</td>
                    <td>{row.rebuys}</td>
                    <td>{row.addOns}</td>
                    <td>{row.wins}</td>
                    <td>{percent(row.wins / row.played)}</td>
                    <td>{row.podiums}</td>
                    <td>{row.applause}</td>
                    <td>{percent(row.cashes / row.played)}</td>
                    <td>{formatPlace.format(row.places / row.played)}.º</td>
                    <td>{euros(row.prizes)}</td>
                    <Net cents={row.prizes - row.paid} />
                    <td>{roi(row) === null ? '—' : percent(roi(row)!)}</td>
                    <td>{row.streak}</td>
                    <td>{row.bestStreak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="poker-note">
            Los porcentajes se calculan sobre los torneos jugados por cada persona. El neto
            descuenta entradas, recompras y add-ons. Un aplauso es quedar en el primer puesto sin
            premio. Las recompras y los add-ons acumulan las compras de cada jugador en los torneos
            cerrados. El ROI es el neto dividido entre lo aportado. La racha son los podios seguidos
            hasta el último torneo que jugó cada persona.
          </p>
        </>
      )}
    </section>
  );
}
