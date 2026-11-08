import { useState } from 'react';
import type { LeagueStanding } from '../../types/api';
import {
  gamesBehind,
  nbaStandingsGroups,
  nbaZone,
  winPercentage,
  type NbaStandingsView,
} from '../../utils/nbaStandings';

interface Props {
  standings: LeagueStanding[];
  showComplete: boolean;
  competitionName: string;
}

const VIEWS: { view: NbaStandingsView; label: string }[] = [
  { view: 'conference', label: 'Conferencias' },
  { view: 'division', label: 'Divisiones' },
];

/**
 * Tabla de la temporada regular de la NBA: por conferencias (con las zonas de playoffs y play-in) o por
 * divisiones, con el balance de victorias y derrotas, el porcentaje y los partidos por detrás. En la
 * completa, también la racha y la diferencia de puntos.
 */
export default function NbaStandingsTables({ standings, showComplete, competitionName }: Props) {
  const [view, setView] = useState<NbaStandingsView>('conference');
  const groups = nbaStandingsGroups(standings, view);
  const zones = view === 'conference';

  return (
    <div className="standings-card">
      <div
        className="standings-toggle standings-subtoggle"
        role="group"
        aria-label="Agrupar la tabla"
      >
        {VIEWS.map((option) => (
          <button
            key={option.view}
            type="button"
            className={view === option.view ? 'is-active' : ''}
            aria-pressed={view === option.view}
            onClick={() => setView(option.view)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {groups.map((group) => (
        <div key={group.title ?? 'tabla'} className="standings-group">
          {group.title && <h2 className="standings-group-title">{group.title}</h2>}
          <div className="standings-table-wrap">
            <table className={`standings-table is-nba${showComplete ? ' is-complete' : ''}`}>
              <caption className="sr-only">{`${group.title ?? 'Clasificación'} de ${competitionName}`}</caption>
              <colgroup>
                <col className="standings-nba-pos-column" />
                <col />
                {Array.from({ length: showComplete ? 5 : 3 }, (_, i) => (
                  <col key={i} className="standings-nba-stat-column" />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="standings-pos-col">
                    #
                  </th>
                  <th scope="col">Equipo</th>
                  <th scope="col" className="standings-points-col">
                    <abbr title="Victorias y derrotas">V-D</abbr>
                  </th>
                  <th scope="col">
                    <abbr title="Porcentaje de victorias">%</abbr>
                  </th>
                  <th scope="col">
                    <abbr title="Partidos por detrás del primero">PD</abbr>
                  </th>
                  {showComplete && (
                    <>
                      <th scope="col">Racha</th>
                      <th scope="col">
                        <abbr title="Diferencia de puntos">Dif</abbr>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const zone = zones ? nbaZone(row.rank) : null;
                  return (
                    <tr key={row.teamName} className={`standings-row${zone ? ` is-${zone}` : ''}`}>
                      <td className="standings-rank-cell">
                        <span className="standings-rank">{row.rank}</span>
                      </td>
                      <td className="standings-team-cell">
                        <div className="standings-team">
                          {row.teamLogo ? (
                            <img
                              src={row.teamLogo}
                              alt=""
                              width={28}
                              height={28}
                              className="standings-team-logo"
                              loading="lazy"
                            />
                          ) : (
                            <span className="standings-team-placeholder" aria-hidden="true">
                              {row.teamName.trim().charAt(0).toLocaleUpperCase('es')}
                            </span>
                          )}
                          <span className="standings-team-name">
                            {row.teamShortName ? (
                              <>
                                <span className="standings-team-full">{row.teamName}</span>
                                <span className="standings-team-short">{row.teamShortName}</span>
                              </>
                            ) : (
                              row.teamName
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="standings-points-cell">{`${row.wins}-${row.losses}`}</td>
                      <td className="standings-muted-cell">{winPercentage(row)}</td>
                      <td className="standings-muted-cell">{gamesBehind(row, group.rows)}</td>
                      {showComplete && (
                        <>
                          <td
                            className={
                              row.streak?.startsWith('V')
                                ? 'standings-win-cell'
                                : row.streak?.startsWith('D')
                                  ? 'standings-loss-cell'
                                  : 'standings-muted-cell'
                            }
                          >
                            {row.streak ?? '–'}
                          </td>
                          <td
                            className={`standings-diff-cell${
                              row.goalDiff > 0
                                ? ' is-positive'
                                : row.goalDiff < 0
                                  ? ' is-negative'
                                  : ''
                            }`}
                          >
                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="standings-legend">
        {zones && (
          <span className="standings-legend-zones">
            <span className="standings-zone is-playoff">1-6 playoffs</span>
            <span className="standings-zone is-playin">7-10 play-in</span>
          </span>
        )}
        <span className="standings-legend-note">
          V-D victorias y derrotas · PD partidos por detrás del primero
          {showComplete ? ' · Dif diferencia de puntos' : ''}
        </span>
      </div>
    </div>
  );
}
