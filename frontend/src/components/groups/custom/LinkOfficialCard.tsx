import { useState } from 'react';
import { Trophy } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCompetitions, linkOfficialCompetition } from '../../../services/api';
import { queryKeys } from '../../../services/queryKeys';
import type { Group } from '../../../types/api';
import type { SaveAction } from './customCompetition';

/**
 * Pasa una liga de cuadro personalizado a una competición oficial con cuadro propio (Worlds de LoL…):
 * las predicciones se conservan con los nombres oficiales y los resultados llegan solos.
 */
export default function LinkOfficialCard({ group, save }: { group: Group; save: SaveAction }) {
  const queryClient = useQueryClient();
  const competitions = useQuery({
    queryKey: queryKeys.competitions(),
    queryFn: fetchCompetitions,
    staleTime: 5 * 60_000,
  });
  const options = (competitions.data ?? []).filter(
    (item) => item.formatType === 'TOURNAMENT' && item.externalId !== 'fifa.world',
  );
  const [selected, setSelected] = useState('');
  const fallback = options.find((item) => item.externalId === 'lol.worlds') ?? options[0];
  const competitionId = Number(selected || fallback?.id);
  if (!options.length) return null;
  const name = options.find((item) => item.id === competitionId)?.name ?? '';

  return (
    <section className="league-admin-card">
      <div className="league-admin-card-head">
        <h3>
          <Trophy size={14} aria-hidden="true" />
          Pasar a competición oficial
        </h3>
      </div>
      <p className="league-admin-muted">
        La liga usará los cruces y resultados reales y dejarás de meterlos a mano. Las predicciones
        se conservan: cada equipo se empareja con su nombre oficial. Los cierres pasan a una fecha
        fija y no se puede deshacer.
      </p>
      <form
        className="custom-admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!window.confirm(`¿Pasar la liga a ${name}? No se puede deshacer.`)) return;
          void save(async () => {
            await linkOfficialCompetition(group.id, competitionId);
            await queryClient.invalidateQueries();
          }, `La liga ya juega ${name}`);
        }}
      >
        <div className="league-admin-field">
          <label htmlFor="custom-admin-official">Competición</label>
          <select
            id="custom-admin-official"
            className="glass-input"
            value={String(competitionId)}
            onChange={(event) => setSelected(event.target.value)}
          >
            {options.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="league-admin-btn is-primary">
          Pasar a {name}
        </button>
      </form>
    </section>
  );
}
