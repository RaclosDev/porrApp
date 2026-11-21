import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import FixtureCard from '../matchday/FixtureCard';
import FightCard from '../matchday/FightCard';
import SelectMenu from '../SelectMenu';
import { DriverFace } from '../grandPrix/DriverFace';
import {
  EMPTY_PICK,
  PICK_SLOTS,
  driverLabel,
  driverShortName,
  formatWhen,
  pickError,
} from '../grandPrix/grandPrix';
import { fetchMatches } from '../../services/api';
import type { GrandPrixPicks, Match, MatchdayFixture, RaceDriver, Sport } from '../../types/api';
import {
  EMPTY_PREDICTION,
  withSign,
  type Draft,
  type DraftPrediction,
  type MatchSign,
} from '../../utils/matchday';
import { SIGNUP_TO_CREATE_LEAGUE } from '../../utils/authRoutes';
import snapshot from './predictionDemoSnapshot.json';

/*
 * Prueba del hero de la portada: la jornada en curso de LaLiga, el próximo Gran Premio y la cartelera
 * estelar de la próxima UFC, con las mismas tarjetas que la app. Los partidos salen de la API pública;
 * si no responde, de una copia guardada. No se guarda nada.
 */

type DemoTab = 'liga' | 'gp' | 'ufc';

const TABS: { id: DemoTab; label: string; competitionId: number }[] = [
  { id: 'liga', label: 'LaLiga', competitionId: 4 },
  { id: 'gp', label: 'Fórmula 1', competitionId: 46 },
  { id: 'ufc', label: 'UFC', competitionId: 47 },
];

interface DemoData {
  liga: Match[];
  gp: Match;
  ufc: Match[];
}

const FALLBACK = snapshot as unknown as DemoData;

const byDate = (a: Match, b: Match) => (a.date ?? '').localeCompare(b.date ?? '');
const isUpcoming = (match: Match, now: number) =>
  !match.finished &&
  match.status !== 'CANCELLED' &&
  match.date != null &&
  Date.parse(match.date) > now;

/** La jornada en curso: la del primer partido sin terminar, entera. */
function currentRound(matches: Match[]): Match[] {
  const pending = matches.filter((m) => !m.finished && m.status !== 'CANCELLED').sort(byDate);
  const round = pending[0]?.round;
  return round ? matches.filter((m) => m.round === round) : [];
}

const isOpen = (match: Match) => !match.finished && match.status === 'SCHEDULED';

/** Primero lo que aún se puede predecir; después lo ya jugado, con su resultado. */
const playableFirst = (matches: Match[]) =>
  [...matches].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || byDate(a, b));

/** El próximo Gran Premio que aún no ha empezado. */
const nextGrandPrix = (matches: Match[], now = Date.now()): Match | undefined =>
  matches.filter((m) => isUpcoming(m, now)).sort(byDate)[0];

/** La cartelera estelar (main card) del próximo evento de la UFC, de la pelea estelar hacia abajo. */
function nextMainCard(matches: Match[], now = Date.now()): Match[] {
  const event = matches.filter((m) => m.fight && isUpcoming(m, now)).sort(byDate)[0]
    ?.fight?.eventId;
  if (!event) return [];
  return matches
    .filter(
      (m) => m.fight?.eventId === event && m.fight.segment === 'MAIN' && m.status !== 'CANCELLED',
    )
    .sort((a, b) => (a.fight?.order ?? 99) - (b.fight?.order ?? 99));
}

const PICKERS: { [K in DemoTab]: (matches: Match[]) => DemoData[K] | undefined } = {
  liga: (matches) => {
    const round = currentRound(matches);
    return round.length ? round : undefined;
  },
  gp: (matches) => nextGrandPrix(matches),
  ufc: (matches) => {
    const card = nextMainCard(matches);
    return card.length ? card : undefined;
  },
};

/** Los datos de una pestaña: los de la API en cuanto se abre y, si fallan, la copia guardada. */
function useDemoData(tab: DemoTab) {
  const [data, setData] = useState<Partial<DemoData>>({});
  const loaded = data[tab] !== undefined;
  const competitionId = TABS.find((t) => t.id === tab)!.competitionId;

  useEffect(() => {
    if (loaded) return;
    let active = true;
    const keep = <K extends DemoTab>(key: K, value: DemoData[K] | undefined) => {
      if (active) setData((current) => ({ ...current, [key]: value ?? FALLBACK[key] }));
    };
    fetchMatches(competitionId)
      .then((matches) => keep(tab, PICKERS[tab](matches)))
      .catch(() => keep(tab, undefined));
    return () => {
      active = false;
    };
  }, [tab, loaded, competitionId]);

  return data;
}

function toFixture(match: Match, sport: Sport, prediction?: DraftPrediction): MatchdayFixture {
  // Sin depender del reloj: se cierra lo que ya ha empezado o terminado.
  const locked = match.finished || match.status !== 'SCHEDULED';
  return {
    matchId: match.id,
    homeTeam: match.home,
    awayTeam: match.away,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    homeTeamLogo: match.homeTeamLogo ?? match.homeLogo ?? null,
    awayTeamLogo: match.awayTeamLogo ?? match.awayLogo ?? null,
    matchDate: match.date,
    round: match.round,
    groupName: match.groupName,
    sport,
    finished: match.finished,
    status: match.status,
    actualHomeScore: match.homeScore,
    actualAwayScore: match.awayScore,
    displayClock: match.displayClock,
    predHomeScore: null,
    predAwayScore: null,
    predSign: prediction?.sign || null,
    predMethod: prediction?.method || null,
    predRound: prediction?.round ? Number(prediction.round) : null,
    fight: match.fight ?? null,
    locked,
    lockReason: null,
    pointsAwarded: null,
    isExactScore: null,
    isCorrectSign: null,
    scoringDetails: null,
  };
}

/** Parrilla de 2026 por escudería (la de la app sale de ESPN y solo la ven los miembros de una liga). */
const TEAMS: [team: string, color: string, drivers: [string, string][]][] = [
  [
    'McLaren',
    'FF8000',
    [
      ['Lando Norris', 'L. Norris'],
      ['Oscar Piastri', 'O. Piastri'],
    ],
  ],
  [
    'Ferrari',
    'E8002D',
    [
      ['Charles Leclerc', 'C. Leclerc'],
      ['Lewis Hamilton', 'L. Hamilton'],
    ],
  ],
  [
    'Red Bull',
    '3671C6',
    [
      ['Max Verstappen', 'M. Verstappen'],
      ['Isack Hadjar', 'I. Hadjar'],
    ],
  ],
  [
    'Mercedes',
    '27F4D2',
    [
      ['George Russell', 'G. Russell'],
      ['Kimi Antonelli', 'K. Antonelli'],
    ],
  ],
  [
    'Aston Martin',
    '229971',
    [
      ['Fernando Alonso', 'F. Alonso'],
      ['Lance Stroll', 'L. Stroll'],
    ],
  ],
  [
    'Alpine',
    '0093CC',
    [
      ['Pierre Gasly', 'P. Gasly'],
      ['Franco Colapinto', 'F. Colapinto'],
    ],
  ],
  [
    'Williams',
    '64C4FF',
    [
      ['Carlos Sainz', 'C. Sainz'],
      ['Alexander Albon', 'A. Albon'],
    ],
  ],
  [
    'Racing Bulls',
    '6692FF',
    [
      ['Liam Lawson', 'L. Lawson'],
      ['Arvid Lindblad', 'A. Lindblad'],
    ],
  ],
  [
    'Haas',
    'B6BABD',
    [
      ['Esteban Ocon', 'E. Ocon'],
      ['Oliver Bearman', 'O. Bearman'],
    ],
  ],
  [
    'Audi',
    'BB0A30',
    [
      ['Nico Hülkenberg', 'N. Hülkenberg'],
      ['Gabriel Bortoleto', 'G. Bortoleto'],
    ],
  ],
  [
    'Cadillac',
    '1E3D2F',
    [
      ['Sergio Pérez', 'S. Pérez'],
      ['Valtteri Bottas', 'V. Bottas'],
    ],
  ],
];

const DRIVERS: RaceDriver[] = TEAMS.flatMap(([team, teamColor, drivers], t) =>
  drivers.map(([name, shortName], d) => ({
    id: t * 2 + d + 1,
    name,
    shortName,
    country: null,
    flagUrl: null,
    team,
    teamColor,
    number: null,
    headshotUrl: null,
  })),
);
const DRIVER_BY_ID = new Map(DRIVERS.map((driver) => [driver.id, driver]));

const PODIUM = ['first', 'second', 'third'] as const;

/** La tarjeta de un Gran Premio de la app, abierta, con su formulario de predicción. */
function GrandPrixDemo({ gp }: { gp: Match }) {
  const [open, setOpen] = useState(true);
  const [pick, setPick] = useState<GrandPrixPicks>(EMPTY_PICK);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const bodyId = `try-gp-${gp.id}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = pickError(pick);
    setError(problem);
    setReady(!problem);
  };

  return (
    <article className="gp-card">
      <button
        type="button"
        className="gp-card-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="gp-card-title">
          <strong>{gp.round}</strong>
          <span className="gp-card-meta">{gp.date ? `Carrera ${formatWhen(gp.date)}` : ''}</span>
          <span className="gp-card-status">Abierto hasta la clasificación</span>
        </span>
        <span className="gp-card-side">
          {ready ? (
            <span className="gp-badge">
              <Check size={12} aria-hidden="true" /> Predicho
            </span>
          ) : (
            <span className="gp-badge is-pending">Sin predecir</span>
          )}
          <ChevronDown size={18} aria-hidden="true" className={open ? 'is-open' : ''} />
        </span>
      </button>

      {open && (
        <div id={bodyId} className="gp-card-body">
          <form className="gp-form" onSubmit={submit} noValidate>
            {PICK_SLOTS.map((slot) => {
              const id = `try-gp-${slot.key}`;
              const value = pick[slot.key];
              const driver = value != null ? DRIVER_BY_ID.get(value) : undefined;
              const taken = new Set(
                PODIUM.includes(slot.key as (typeof PODIUM)[number])
                  ? PODIUM.filter((other) => other !== slot.key).map((other) => pick[other])
                  : [],
              );
              return (
                <div key={slot.key} className={`gp-field gp-field-${slot.key}`}>
                  <label htmlFor={id}>
                    {slot.label}
                    {slot.optional && <span className="gp-optional"> (opcional)</span>}
                  </label>
                  <div className="gp-select-row">
                    {driver && (
                      <DriverFace
                        name={driverShortName(driver)}
                        color={driver.teamColor}
                        size={36}
                      />
                    )}
                    <SelectMenu
                      id={id}
                      className="gp-select"
                      label={slot.label}
                      value={value != null ? String(value) : ''}
                      style={driver ? { borderLeftColor: `#${driver.teamColor}` } : undefined}
                      onChange={(next) => {
                        setReady(false);
                        setPick((current) => ({
                          ...current,
                          [slot.key]: next ? Number(next) : null,
                        }));
                      }}
                      items={[
                        { value: '', label: slot.optional ? 'Sin elegir' : 'Elige piloto' },
                        ...DRIVERS.map((option) => ({
                          value: String(option.id),
                          label: driverLabel(option),
                          disabled: taken.has(option.id),
                        })),
                      ]}
                    />
                  </div>
                </div>
              );
            })}
            {error && (
              <p className="gp-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="glass-btn primary-btn gp-save" disabled={ready}>
              {ready ? 'Predicción lista' : 'Guardar predicción'}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

const FRIENDS_NOTE = 'En tu liga, las predicciones de tus amigos se ven cuando empieza.';

/** Va en el hero: elige competición y predice como en la app. */
export default function PredictionDemo() {
  const [tab, setTab] = useState<DemoTab>('liga');
  const [draft, setDraft] = useState<Draft>({});
  const [note, setNote] = useState<string | null>(null);
  const data = useDemoData(tab);

  const predict = (matchId: number, prediction: DraftPrediction | null) =>
    setDraft((current) => {
      const next = { ...current };
      if (prediction) next[matchId] = prediction;
      else delete next[matchId];
      return next;
    });

  const quickSign = (matchId: number, sign: MatchSign) =>
    // Como en la app, volver a pulsar el signo elegido lo quita.
    predict(matchId, draft[matchId]?.sign === sign ? null : withSign(sign));

  const showFriends = (fixture: MatchdayFixture) =>
    setNote(`${fixture.homeTeam} - ${fixture.awayTeam}: ${FRIENDS_NOTE.toLowerCase()}`);

  const choose = (next: DemoTab) => {
    setTab(next);
    setNote(null);
  };

  const liga = data.liga && playableFirst(data.liga);
  const ufc = data.ufc;
  const open = (matches: Match[]) => matches.filter(isOpen);
  const count = (matches: Match[]) => open(matches).filter((m) => draft[m.id]).length;

  let title = '';
  let progress = '';
  if (tab === 'liga' && liga) {
    title = `${liga[0].round} · LaLiga`;
    progress = `${count(liga)}/${open(liga).length} predicciones`;
  } else if (tab === 'gp' && data.gp) {
    title = `${data.gp.round} · Fórmula 1`;
    progress = 'Podio, pole y vuelta rápida';
  } else if (tab === 'ufc' && ufc) {
    title = ufc[0].fight?.eventName ?? ufc[0].round;
    progress = `Cartelera estelar · ${count(ufc)}/${open(ufc).length} predicciones`;
  }

  return (
    <article className="md-page paper-panel album-sheet try-matchday" aria-label="Pruébalo">
      <div className="paper-tabs" role="tablist" aria-label="Competición">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`try-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="try-panel"
            className={`paper-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => choose(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id="try-panel"
        role="tabpanel"
        aria-labelledby={`try-tab-${tab}`}
        aria-busy={!title}
        className="try-panel"
      >
        {title ? (
          <>
            <header className="try-head">
              <h3>{title}</h3>
              <span>{progress}</span>
            </header>
            <div className="try-list">
              {tab === 'liga' &&
                liga?.map((match) => (
                  <FixtureCard
                    key={match.id}
                    fixture={toFixture(match, 'FOOTBALL', draft[match.id])}
                    prediction={draft[match.id] ?? EMPTY_PREDICTION}
                    locked={toFixture(match, 'FOOTBALL').locked}
                    onQuickSign={quickSign}
                    onShowFriends={showFriends}
                  />
                ))}
              {tab === 'gp' && data.gp && <GrandPrixDemo key={data.gp.id} gp={data.gp} />}
              {tab === 'ufc' &&
                ufc?.map((match) => {
                  const fixture = toFixture(match, 'MMA', draft[match.id]);
                  return (
                    <FightCard
                      key={match.id}
                      fixture={fixture}
                      prediction={draft[match.id] ?? EMPTY_PREDICTION}
                      locked={fixture.locked}
                      onPick={predict}
                      onShowFriends={showFriends}
                    />
                  );
                })}
            </div>
          </>
        ) : (
          <p className="try-friends try-loading">Cargando…</p>
        )}
      </div>

      {note && (
        <p className="try-friends" aria-live="polite">
          {note}
        </p>
      )}
      <Link to={SIGNUP_TO_CREATE_LEAGUE} className="fam-btn fam-btn--ink fam-btn--block">
        Guárdala en tu liga
      </Link>
      <p className="try-friends">Partidos reales; aquí no se guarda nada.</p>
    </article>
  );
}
