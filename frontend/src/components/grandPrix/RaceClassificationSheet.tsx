import { useQuery } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import { fetchGrandPrixClassification } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { GrandPrix, RaceClassificationRow } from '../../types/api';
import PaperLoading from '../PaperLoading';
import SheetDialog from '../SheetDialog';

const stripe = (color: string | null) => (color ? { borderLeftColor: `#${color}` } : undefined);

const OUT = new Set<RaceClassificationRow['status']>(['RETIRED', 'DISQUALIFIED', 'DID_NOT_START']);

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Lo que se enseña en la columna de tiempo: tiempo del ganador, diferencia, vueltas o abandono. */
export function resultText(row: RaceClassificationRow): string {
  switch (row.status) {
    case 'RETIRED':
      return 'Abandono';
    case 'DISQUALIFIED':
      return 'Descalificado';
    case 'DID_NOT_START':
      return 'No salió';
    case 'FINISHED':
      if (row.time) return row.time;
      if (row.gap) return row.gap;
      if (row.lapsBehind) return `+${plural(row.lapsBehind, 'vuelta', 'vueltas')}`;
      return '—';
    default:
      return '—';
  }
}

/** Debajo del piloto: escudería, salida y, si no acabó, vueltas que dio. */
export function detailText(row: RaceClassificationRow): string {
  const parts: string[] = [];
  if (row.team) parts.push(row.team);
  if (row.grid != null) parts.push(`Salió ${row.grid}.º`);
  else if (row.status === 'FINISHED') parts.push('Salió del pit lane');
  if (row.status === 'RETIRED' && row.laps != null) {
    parts.push(plural(row.laps, 'vuelta', 'vueltas'));
  }
  return parts.join(' · ');
}

/** Clasificación completa de un Gran Premio: puesto, piloto, tiempo o diferencia y puntos. */
export default function RaceClassificationSheet({
  gp,
  groupId,
  onClose,
}: {
  gp: GrandPrix;
  groupId: string | number;
  onClose: () => void;
}) {
  const classification = useQuery({
    queryKey: queryKeys.grandPrixClassification(groupId, gp.id),
    queryFn: () => fetchGrandPrixClassification(groupId, gp.id),
    staleTime: 5 * 60_000,
  });
  const rows = classification.data?.rows ?? [];
  return (
    <SheetDialog title={gp.name} subtitle="Clasificación de la carrera" onClose={onClose}>
      <div className="sheet-dialog-body">
        {classification.isPending && <PaperLoading label="Cargando la clasificación" embedded />}
        {classification.isError && (
          <p role="alert" className="gp-note">
            No se pudo cargar la clasificación.{' '}
            <button type="button" className="glass-btn" onClick={() => classification.refetch()}>
              Reintentar
            </button>
          </p>
        )}
        {classification.data && rows.length === 0 && (
          <p className="gp-note">
            La clasificación completa aún no está publicada. Llega sola unos minutos después de la
            carrera.
          </p>
        )}
        {rows.length > 0 && (
          <table className="gp-table gp-classification">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Puesto</span>
                </th>
                <th scope="col">Piloto</th>
                <th scope="col" className="gp-num">
                  Tiempo
                </th>
                <th scope="col" className="gp-num">
                  Pts
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const out = OUT.has(row.status);
                return (
                  <tr key={`${row.position}-${row.name}`} className={out ? 'is-out' : undefined}>
                    <th scope="row">{out ? '—' : row.position}</th>
                    <td style={stripe(row.teamColor)}>
                      <span className="gp-standings-name">
                        {row.name}
                        {row.fastestLap && (
                          <Timer size={13} aria-label="Vuelta rápida" className="gp-fastest" />
                        )}
                      </span>
                      <span className="gp-standings-team">{detailText(row)}</span>
                    </td>
                    <td className="gp-num gp-classification-time">{resultText(row)}</td>
                    <td className="gp-num">{row.points ? row.points : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.some((row) => row.fastestLap) && (
          <p className="gp-note">
            <Timer size={12} aria-hidden="true" /> Vuelta rápida
          </p>
        )}
      </div>
    </SheetDialog>
  );
}
