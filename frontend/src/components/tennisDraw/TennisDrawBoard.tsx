import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PaperLoading from '../PaperLoading';
import { TeamSlot } from '../BracketCanvas';
import { useAppContext } from '../../context/AppContext';
import { fetchMatchdayFixtures } from '../../services/api';
import { queryKeys } from '../../services/queryKeys';
import type { MatchdayFixture } from '../../types/api';
import { formatMatchDate, hasLiveMatch, isLiveFixture } from '../../utils/matchday';
import {
  GROUP_STAGE,
  qualifiedKeys,
  sideState,
  tennisDraws,
  type DrawGroup,
  type DrawRound,
  type DrawSlot,
  type DrawView,
} from '../../utils/tennisDraw';

const EMPTY: MatchdayFixture[] = [];

const VIEW_LABELS: Record<DrawView, string> = {
  results: 'Resultados',
  predictions: 'Mis predicciones',
};

/** Texto para el lector de pantalla del jugador elegido. */
const PICK_LABELS = {
  picked: ' · tu predicción',
  hit: ' · tu predicción, acertada',
  miss: ' · tu predicción, fallada',
} as const;

/** Sets de un jugador en la vista: los reales (también en directo) o los de la predicción. */
function setsShown(fixture: MatchdayFixture, side: 'home' | 'away', view: DrawView) {
  const value =
    view === 'results'
      ? side === 'home'
        ? fixture.actualHomeScore
        : fixture.actualAwayScore
      : side === 'home'
        ? fixture.predHomeScore
        : fixture.predAwayScore;
  if (view === 'results' && !fixture.finished && !isLiveFixture(fixture)) return null;
  return value;
}

function MatchCard({ slot, view }: { slot: DrawSlot; view: DrawView }) {
  const { fixture, projected } = slot;
  if (!fixture) {
    return (
      <div className="knockout-tie tennis-draw-match is-pending">
        <p className="knockout-tie-legs">{projected ? 'Según tu predicción' : 'Por decidir'}</p>
        <div className="knockout-tie-teams">
          {(['home', 'away'] as const).map((side) => (
            <TeamSlot
              key={side}
              name={projected?.[side] ?? 'Por decidir'}
              placeholder
              className={projected?.[side] ? 'is-projected' : ''}
            />
          ))}
        </div>
      </div>
    );
  }
  const live = isLiveFixture(fixture);
  const note = fixture.finished
    ? fixture.winnerSign && fixture.actualHomeScore == null
      ? 'Terminado sin completar'
      : 'Terminado'
    : live
      ? 'En juego'
      : formatMatchDate(fixture.matchDate);
  const missing =
    view === 'predictions' && !fixture.predSign && fixture.predHomeScore == null
      ? fixture.locked || fixture.finished
        ? 'Sin predicción'
        : 'Aún sin predicción'
      : null;
  return (
    <div className={`knockout-tie tennis-draw-match${live ? ' is-live' : ''}`}>
      <p className="knockout-tie-legs">
        <span>{note}</span>
        {missing && <span className="knockout-tie-closed">{missing}</span>}
      </p>
      <div className="knockout-tie-teams">
        {(['home', 'away'] as const).map((side) => {
          const name = side === 'home' ? fixture.homeTeam : fixture.awayTeam;
          const logo = side === 'home' ? fixture.homeTeamLogo : fixture.awayTeamLogo;
          const state = sideState(fixture, side, view);
          const sets = setsShown(fixture, side, view);
          const placeholder = !name || name === 'Por definir';
          return (
            <TeamSlot
              key={side}
              name={placeholder ? 'Por decidir' : name}
              logo={logo}
              placeholder={placeholder}
              className={[
                state.outcome ? `is-${state.outcome}` : '',
                state.advances && view === 'results' ? 'is-won' : '',
                state.out ? 'is-out' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              rightContent={
                <>
                  {state.outcome && <span className="sr-only">{PICK_LABELS[state.outcome]}</span>}
                  {view === 'results' && state.advances && <span className="sr-only"> · pasa</span>}
                  {sets != null && <span className="knockout-tie-goals">{sets}</span>}
                </>
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function Bracket({ rounds, view }: { rounds: DrawRound[]; view: DrawView }) {
  return (
    <div className="tennis-draw-scroll" role="region" aria-label="Cuadro">
      <ol className="tennis-draw-rounds">
        {rounds.map((round) => (
          <li key={round.label} className="tennis-draw-round">
            <h2 className="tennis-draw-round-title">{round.label}</h2>
            <ol className="tennis-draw-slots">
              {round.slots.map((slot, index) => (
                <li key={slot.fixture?.matchId ?? `slot-${index}`} className="tennis-draw-slot">
                  <MatchCard slot={slot} view={view} />
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GroupTable({
  group,
  qualified,
  view,
}: {
  group: DrawGroup;
  qualified: Set<string>;
  view: DrawView;
}) {
  const merged = group.name === GROUP_STAGE;
  return (
    <section className="standings-card tennis-draw-group" aria-label={group.name}>
      <h2 className="tennis-draw-round-title">{group.name}</h2>
      {merged && (
        <p className="tennis-draw-note">
          ESPN no indica el grupo de cada jugador: los dos grupos se separan en cuanto se crucen los
          rivales de cada uno.
        </p>
      )}
      <div className="standings-table-wrap">
        <table className="standings-table tennis-draw-table">
          <caption className="sr-only">
            Clasificación de {group.name}
            {view === 'predictions' ? ' según tus predicciones' : ''}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="standings-pos-col">
                #
              </th>
              <th scope="col">Jugador</th>
              <th scope="col">
                <abbr title="Partidos ganados">V</abbr>
              </th>
              <th scope="col">
                <abbr title="Partidos perdidos">D</abbr>
              </th>
              <th scope="col">Sets</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, index) => {
              const through = qualified.has(row.key);
              return (
                <tr key={row.key} className={through ? 'is-qualified' : undefined}>
                  <td className="standings-pos-col">{index + 1}</td>
                  <td>
                    <span className="tennis-draw-player">
                      {row.logo && <img src={row.logo} alt="" width={18} height={13} />}
                      {row.name}
                      {through && (
                        <span className="tennis-draw-badge">
                          {view === 'predictions' ? 'Pasaría' : 'Pasa'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td>{row.won}</td>
                  <td>{row.lost}</td>
                  <td>
                    {row.setsWon}-{row.setsLost}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ol className="tennis-draw-group-matches">
        {group.fixtures.map((fixture) => (
          <li key={fixture.matchId}>
            <MatchCard slot={{ fixture }} view={view} />
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Pestaña Cuadro de una liga de tenis: las rondas desde octavos, ronda a ronda y con quién pasa, y en
 * las ATP Finals los dos grupos con su clasificación y debajo semifinales y final. Se ve con el
 * ganador real o con lo que ha predicho el usuario.
 */
export default function TennisDrawBoard() {
  const { activeGroupId, activeCompetitionName, userId, userName } = useAppContext();
  const [view, setView] = useState<DrawView>('results');
  const [selected, setSelected] = useState<string | null>(null);
  const groupId = activeGroupId ?? '';

  const fixturesQuery = useQuery({
    // Todos los partidos de la liga (sin jornada): cuelga de matchdayFixtures, que se refresca al guardar.
    queryKey: queryKeys.matchdayFixtures(groupId, userId || userName, ''),
    queryFn: () => fetchMatchdayFixtures(groupId),
    enabled: Boolean(activeGroupId),
    refetchInterval: (query) => (hasLiveMatch(query.state.data) ? 30_000 : false),
  });
  const fixtures = fixturesQuery.data ?? EMPTY;
  const draws = useMemo(() => tennisDraws(fixtures, view), [fixtures, view]);
  const draw = draws.find((d) => (d.name ?? '') === selected) ?? draws[0];
  // Quién está ya en semifinales: en las ATP Finals, los que pasan de cada grupo.
  const semifinals = (draw?.rounds.find((round) => round.label === 'Semifinales')?.slots ?? [])
    .map((slot) => slot.fixture)
    .filter((fixture): fixture is MatchdayFixture => fixture != null);

  return (
    <section className="standings-page paper-panel album-sheet tennis-draw-page">
      <header className="standings-head">
        <div className="standings-head-copy">
          <span className="standings-eyebrow">Cuadro</span>
          <h1 className="standings-title">{activeCompetitionName || 'Tenis'}</h1>
        </div>
        {draws.length > 0 && (
          <div className="standings-toggle" role="group" aria-label="Qué enseña el cuadro">
            {(Object.keys(VIEW_LABELS) as DrawView[]).map((option) => (
              <button
                key={option}
                type="button"
                className={view === option ? 'is-active' : ''}
                aria-pressed={view === option}
                onClick={() => setView(option)}
              >
                {VIEW_LABELS[option]}
              </button>
            ))}
          </div>
        )}
      </header>

      {draws.length > 1 && (
        <div className="standings-toggle tennis-draw-picker" role="group" aria-label="Cuadro">
          {draws.map((option) => (
            <button
              key={option.name ?? ''}
              type="button"
              className={option === draw ? 'is-active' : ''}
              aria-pressed={option === draw}
              onClick={() => setSelected(option.name ?? '')}
            >
              {option.name ?? 'Cuadro'}
            </button>
          ))}
        </div>
      )}

      {fixturesQuery.isPending && activeGroupId ? (
        <PaperLoading label="Cargando el cuadro" embedded />
      ) : fixturesQuery.isError ? (
        <div className="standings-empty" role="alert">
          <p>No se pudo cargar el cuadro. Inténtalo de nuevo.</p>
          <button type="button" className="glass-btn" onClick={() => void fixturesQuery.refetch()}>
            Reintentar
          </button>
        </div>
      ) : !draw ? (
        <div className="paper-panel album-sheet landing-tape standings-empty">
          <p className="standings-empty-title">El cuadro aún no está publicado.</p>
          <p className="standings-empty-copy">
            Los partidos aparecerán aquí en cuanto ESPN publique el cuadro del torneo: desde octavos
            o, en las ATP Finals, desde la fase de grupos.
          </p>
        </div>
      ) : (
        <>
          {view === 'predictions' && (
            <p className="tennis-draw-note">
              Cada partido muestra a quién has dado como ganador.{' '}
              <Link to="/jornadas" className="standings-link">
                Hacer predicciones →
              </Link>
            </p>
          )}
          {draw.groups.length > 0 && (
            <div className="tennis-draw-groups">
              {draw.groups.map((group) => (
                <GroupTable
                  key={group.name}
                  group={group}
                  view={view}
                  qualified={qualifiedKeys(group, semifinals, view)}
                />
              ))}
            </div>
          )}
          {draw.rounds.length > 0 ? (
            <Bracket rounds={draw.rounds} view={view} />
          ) : (
            draw.groups.length > 0 && (
              <p className="tennis-draw-note">
                Las semifinales y la final aparecerán al terminar la fase de grupos.
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}
