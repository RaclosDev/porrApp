import { useEffect, useState } from 'react';
import FixtureCard from '../matchday/FixtureCard';
import FightCard from '../matchday/FightCard';
import { fetchMatches } from '../../services/api';
import type { Match, MatchdayFixture, Sport } from '../../types/api';
import {
  EMPTY_PREDICTION,
  withSign,
  type Draft,
  type DraftPrediction,
  type MatchSign,
} from '../../utils/matchday';
import snapshot from './predictionDemoSnapshot.json';

/*
 * Prueba del hero de la portada: la jornada en curso de LaLiga y la cartelera estelar de la
 * próxima UFC, con las mismas tarjetas que la app. Los partidos salen de la API pública;
 * si no responde, de una copia guardada.
 */

type DemoTab = 'liga' | 'ufc';

const TABS: { id: DemoTab; label: string; competitionId: number }[] = [
  { id: 'liga', label: 'LaLiga', competitionId: 4 },
  { id: 'ufc', label: 'UFC', competitionId: 47 },
];

interface DemoData {
  liga: Match[];
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
  ufc: (matches) => {
    const card = nextMainCard(matches);
    return card.length ? card : undefined;
  },
};

/**
 * Los datos de las dos pestañas. Se piden a la vez al montar: la de LaLiga se ve primero y la de
 * la UFC llega por detrás, así al cambiar de pestaña ya está lista. Si la API falla, la copia
 * guardada.
 */
function useDemoData() {
  const [data, setData] = useState<Partial<DemoData>>({});

  useEffect(() => {
    let active = true;
    const keep = <K extends DemoTab>(key: K, value: DemoData[K] | undefined) => {
      if (active) setData((current) => ({ ...current, [key]: value ?? FALLBACK[key] }));
    };
    for (const { id, competitionId } of TABS) {
      fetchMatches(competitionId)
        .then((matches) => keep(id, PICKERS[id](matches)))
        .catch(() => keep(id, undefined));
    }
    return () => {
      active = false;
    };
  }, []);

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

/** Va en el hero: elige competición y predice como en la app. */
export default function PredictionDemo() {
  const [tab, setTab] = useState<DemoTab>('liga');
  const [draft, setDraft] = useState<Draft>({});
  const data = useDemoData();

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

  const liga = data.liga && playableFirst(data.liga);
  const ufc = data.ufc;
  const open = (matches: Match[]) => matches.filter(isOpen);
  const count = (matches: Match[]) => open(matches).filter((m) => draft[m.id]).length;

  let title = '';
  let progress = '';
  if (tab === 'liga' && liga) {
    title = `${liga[0].round} · LaLiga`;
    progress = `${count(liga)}/${open(liga).length} predicciones`;
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
            onClick={() => setTab(t.id)}
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
                  />
                ))}
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
                    />
                  );
                })}
            </div>
          </>
        ) : (
          <p className="try-friends try-loading">Cargando…</p>
        )}
      </div>
    </article>
  );
}
