import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { applyAdminIncident, dismissAdminIncident } from '../../services/endpoints/admin';
import type { AdminIncident, AdminIncidentSide } from '../../types/api';
import { confirmAction } from '../../utils/confirmAction';
import { errorMessage } from '../../utils/errors';
import { dateTime } from './adminFormat';

export const ADMIN_INCIDENTS_KEY = ['admin', 'incidents'] as const;

export const isOpenIncident = (incident: AdminIncident) =>
  incident.status === 'BLOCKED' || incident.status === 'PENDING';

const KIND_TITLES: Record<AdminIncident['kind'], string> = {
  REGRESSION: 'Un partido terminado vuelve atrás',
  SCORE_CHANGE: 'Otro marcador final',
  FIGHT_MISSING: 'La pelea ya no sale en la cartelera',
};

const STATUS_LABELS: Record<AdminIncident['status'], string> = {
  BLOCKED: 'Retenida',
  PENDING: 'Pendiente de confirmar',
  APPLIED: 'Aplicada',
  DISMISSED: 'Descartada',
};

/** Qué hace la sincronización con cada clase mientras nadie la revisa. */
const KIND_HINTS: Record<AdminIncident['kind'], string> = {
  REGRESSION:
    'Se mantiene el resultado guardado. Un partido terminado no vuelve atrás solo: si de verdad se ha anulado o aplazado, aplícalo tú.',
  SCORE_CHANGE:
    'Si el proveedor lo sigue mandando, se aplica solo. Descártalo si el resultado guardado es el bueno.',
  FIGHT_MISSING:
    'Si sigue sin salir, se cancela sola y se devuelven sus predicciones. Descártala si es un fallo de la cartelera.',
};

const score = (side: AdminIncidentSide) =>
  side.homeScore === null && side.awayScore === null
    ? 'sin marcador'
    : `${side.homeScore ?? '–'}-${side.awayScore ?? '–'}`;

function SideText({ label, side }: { label: string; side: AdminIncidentSide }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {score(side)} · {side.status}
        {side.winner ? ` · gana ${side.winner}` : ''}
      </dd>
    </div>
  );
}

function IncidentCard({ incident }: { incident: AdminIncident }) {
  const queryClient = useQueryClient();
  const open = isOpenIncident(incident);
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: ADMIN_INCIDENTS_KEY });
  const apply = useMutation({ mutationFn: applyAdminIncident, onSuccess });
  const dismiss = useMutation({ mutationFn: dismissAdminIncident, onSuccess });
  const busy = apply.isPending || dismiss.isPending;
  const failed = apply.error ?? dismiss.error;

  const confirmApply = async () => {
    const fight = incident.kind === 'FIGHT_MISSING';
    const confirmed = await confirmAction({
      title: fight ? '¿Cancelar la pelea?' : '¿Aplicar lo que manda el proveedor?',
      message: fight
        ? 'Se cancela la pelea y sus predicciones dejan de puntuar.'
        : 'Se sustituye el resultado guardado y se recalculan los puntos de las ligas que lo juegan.',
      details: [incident.match, `Ahora: ${score(incident.previous)} · ${incident.previous.status}`],
      confirmLabel: fight ? 'Cancelar la pelea' : 'Aplicar',
      cancelLabel: 'Volver',
    });
    if (confirmed) apply.mutate(incident.id);
  };

  return (
    <li className={`league-admin-card admin-incident ${open ? 'is-open' : ''}`}>
      <div className="league-admin-card-head">
        <h3 className="admin-section-title">{incident.match}</h3>
        <span className={`admin-pill ${open ? 'is-accent' : ''}`}>
          {STATUS_LABELS[incident.status]}
        </span>
      </div>
      <p className="admin-section-hint">
        {KIND_TITLES[incident.kind]}
        {incident.competition ? ` · ${incident.competition}` : ''}
        {incident.matchDate ? ` · ${dateTime.format(new Date(incident.matchDate))}` : ''}
      </p>
      <dl className="admin-incident-sides">
        <SideText label="Guardado" side={incident.previous} />
        <SideText label="Proveedor" side={incident.received} />
      </dl>
      <p className="admin-section-hint">
        Visto {incident.seenCount} {incident.seenCount === 1 ? 'vez' : 'veces'}, la última a las{' '}
        {dateTime.format(new Date(incident.lastSeenAt))}
        {open && incident.autoApplyAt
          ? `. Se aplica sola desde las ${dateTime.format(new Date(incident.autoApplyAt))} si se repite`
          : ''}
        {!open && incident.resolvedAt
          ? `. ${incident.resolvedBy === 'auto' ? 'Resuelta sola' : 'Resuelta por ti'} el ${dateTime.format(
              new Date(incident.resolvedAt),
            )}`
          : ''}
        .
      </p>
      {open && (
        <>
          <p className="admin-section-hint">{KIND_HINTS[incident.kind]}</p>
          <div className="admin-picker-actions">
            <button
              type="button"
              className="league-admin-btn is-primary"
              onClick={() => void confirmApply()}
              disabled={busy}
            >
              <Check size={15} aria-hidden="true" />
              {apply.isPending ? 'Aplicando…' : 'Aplicar'}
            </button>
            <button
              type="button"
              className="league-admin-btn is-ghost"
              onClick={() => dismiss.mutate(incident.id)}
              disabled={busy}
            >
              <X size={15} aria-hidden="true" />
              {dismiss.isPending ? 'Descartando…' : 'Descartar'}
            </button>
          </div>
        </>
      )}
      {failed && (
        <p className="admin-error" role="alert">
          {errorMessage(failed, 'No se pudo resolver la incidencia')}
        </p>
      )}
    </li>
  );
}

/**
 * Pestaña «Incidencias»: los resultados que la sincronización no ha querido aplicar sola porque
 * contradicen uno que ya estaba terminado. Solo la ven las cuentas de administrador de porrApp.
 */
export default function AdminIncidents({
  incidents,
  isError,
}: {
  incidents: AdminIncident[] | undefined;
  isError: boolean;
}) {
  if (isError) {
    return (
      <p className="admin-error" role="alert">
        No se pudieron cargar las incidencias.
      </p>
    );
  }
  if (!incidents) {
    return <p role="status">Cargando…</p>;
  }
  const open = incidents.filter(isOpenIncident);
  const resolved = incidents.filter((incident) => !isOpenIncident(incident));
  return (
    <div className="admin-incidents">
      <section aria-labelledby="admin-incidents-open">
        <h2 className="admin-section-title" id="admin-incidents-open">
          Por revisar
        </h2>
        {open.length === 0 ? (
          <p className="admin-table-empty">Ningún resultado retenido.</p>
        ) : (
          <ul className="admin-incident-list">
            {open.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </ul>
        )}
      </section>
      {resolved.length > 0 && (
        <section aria-labelledby="admin-incidents-resolved">
          <h2 className="admin-section-title" id="admin-incidents-resolved">
            Resueltas hace poco
          </h2>
          <ul className="admin-incident-list">
            {resolved.map((incident) => (
              <IncidentCard key={incident.id} incident={incident} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
