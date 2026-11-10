import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { fetchFormulaOneStandings } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import PaperLoading from '../PaperLoading';
import { DriverFace, TeamCrest } from './DriverFace';

type Table = 'drivers' | 'constructors';

const TABLES: { value: Table; label: string }[] = [
  { value: 'drivers', label: 'Pilotos' },
  { value: 'constructors', label: 'Constructores' },
];

const stripe = (color: string | null) => (color ? { borderLeftColor: `#${color}` } : undefined);

/** Diferencia con el líder: «—» para quien va primero. */
const standingsGap = (points: number, leader: number) =>
  points >= leader ? '—' : `-${leader - points}`;

/** «Mundial»: clasificación de pilotos y de constructores de la temporada, según ESPN. */
export default function FormulaOneStandings() {
  const { activeGroupId, isAuthenticated } = useAppContext();
  const [table, setTable] = useState<Table>('drivers');
  const standings = useQuery({
    queryKey: queryKeys.formulaOneStandings(activeGroupId),
    queryFn: () => fetchFormulaOneStandings(activeGroupId as string | number),
    enabled: Boolean(activeGroupId && isAuthenticated),
    staleTime: 5 * 60_000,
  });

  if (!isAuthenticated) {
    return (
      <section className="gp-page md-page paper-panel album-sheet">
        <p className="gp-empty">Inicia sesión para ver el Mundial.</p>
      </section>
    );
  }
  if (standings.isPending) return <PaperLoading label="Cargando el Mundial" />;
  if (standings.isError) {
    return (
      <section className="gp-page md-page paper-panel album-sheet">
        <p role="alert" className="gp-empty">
          No se pudo cargar el Mundial.{' '}
          <button type="button" className="glass-btn" onClick={() => standings.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  const { season, drivers, constructors } = standings.data;
  const rows = table === 'drivers' ? drivers : constructors;
  const leader = rows[0]?.points ?? 0;

  return (
    <section className="gp-page md-page paper-panel album-sheet">
      <header className="gp-header">
        <span className="gp-eyebrow">
          <Trophy size={14} aria-hidden="true" /> Fórmula 1{season ? ` · ${season}` : ''}
        </span>
        <h1>Mundial</h1>
      </header>

      <div className="md-filters" role="group" aria-label="Clasificación">
        {TABLES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={table === value}
            className={`md-filter${table === value ? ' is-active' : ''}`}
            onClick={() => setTable(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="gp-empty">El Mundial empieza con la primera carrera de la temporada.</p>
      ) : (
        <table className="gp-table gp-standings">
          <caption className="sr-only">
            {table === 'drivers' ? 'Mundial de pilotos' : 'Mundial de constructores'}
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <abbr title="Posición">Pos</abbr>
              </th>
              <th scope="col">{table === 'drivers' ? 'Piloto' : 'Escudería'}</th>
              <th scope="col" className="gp-num">
                Pts
              </th>
              <th scope="col" className="gp-num">
                <abbr title="Diferencia con el líder">Dif</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {table === 'drivers'
              ? drivers.map((driver) => (
                  <tr key={`${driver.rank}-${driver.name}`}>
                    <th scope="row">{driver.rank}</th>
                    <td style={stripe(driver.teamColor)}>
                      <span className="gp-standings-name">
                        <DriverFace
                          name={driver.name}
                          url={driver.headshotUrl}
                          color={driver.teamColor}
                          size={34}
                        />
                        {driver.flagUrl && (
                          <img src={driver.flagUrl} alt="" width={18} height={12} loading="lazy" />
                        )}
                        <strong>{driver.name}</strong>
                      </span>
                      {driver.team && <span className="gp-standings-team">{driver.team}</span>}
                    </td>
                    <td className="gp-num">
                      <strong>{driver.points}</strong>
                    </td>
                    <td className="gp-num gp-standings-gap">
                      {standingsGap(driver.points, leader)}
                    </td>
                  </tr>
                ))
              : constructors.map((team) => (
                  <tr key={`${team.rank}-${team.name}`}>
                    <th scope="row">{team.rank}</th>
                    <td style={stripe(team.color)}>
                      <span className="gp-standings-name">
                        <TeamCrest name={team.name} color={team.color} size={32} />
                        <strong>{team.name}</strong>
                        <span className="gp-face-stack">
                          {drivers
                            .filter((driver) => driver.team === team.name)
                            .map((driver) => (
                              <DriverFace
                                key={driver.name}
                                name={driver.name}
                                url={driver.headshotUrl}
                                color={team.color}
                                size={28}
                              />
                            ))}
                        </span>
                      </span>
                    </td>
                    <td className="gp-num">
                      <strong>{team.points}</strong>
                    </td>
                    <td className="gp-num gp-standings-gap">{standingsGap(team.points, leader)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      )}
      <p className="gp-note">Puntos oficiales del campeonato, con los sprints. Fuente: ESPN.</p>
    </section>
  );
}
