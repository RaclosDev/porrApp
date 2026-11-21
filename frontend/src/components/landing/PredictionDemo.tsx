import { useState } from 'react';
import FixtureCard from '../matchday/FixtureCard';
import MatchdayHeader from '../matchday/MatchdayHeader';
import MatchdayPodium from '../MatchdayPodium';
import type { MatchdayFixture, MatchVoter, MatchVoters } from '../../types/api';
import type { LeaderboardRow } from '../../hooks/useLeaderboard';
import { EMPTY_PREDICTION, withSign, type MatchSign } from '../../utils/matchday';

// Jornada de ejemplo en el hero de la portada, con las mismas piezas que la pantalla «Jornadas» de la app.
// No se guarda nada ni se llama al servidor.

interface DemoMatch {
  home: string;
  away: string;
  score: [number, number];
  /** Hora de inicio, pasado mañana. */
  hour: number;
}

const MATCHES: DemoMatch[] = [
  { home: 'España', away: 'Alemania', score: [2, 1], hour: 18 },
  { home: 'Argentina', away: 'Francia', score: [1, 1], hour: 21 },
  { home: 'Brasil', away: 'Portugal', score: [0, 2], hour: 21 },
];

/** Puntos por acertar el signo, como en el baremo por defecto de una liga. */
const SIGN_POINTS = 3;

interface DemoPlayer {
  userId: number;
  name: string;
}

const YOU: DemoPlayer = { userId: 1, name: 'Tú' };

/** Predicciones fijas de dos amigos de ejemplo, para que la jornada tenga con quién medirse. */
const FRIENDS: (DemoPlayer & { picks: MatchSign[] })[] = [
  { userId: 2, name: 'Ana', picks: ['1', 'X', '1'] },
  { userId: 3, name: 'Luis', picks: ['X', '2', '2'] },
];

const signOf = ([home, away]: [number, number]): MatchSign =>
  home > away ? '1' : home < away ? '2' : 'X';

const pointsFor = (picks: (MatchSign | undefined)[]) =>
  picks.reduce((sum, pick, i) => sum + (pick === signOf(MATCHES[i].score) ? SIGN_POINTS : 0), 0);

/** Pasado mañana, para que la fecha de la jornada nunca se quede vieja. */
function kickOff(hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + 2);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function fixtureFor(index: number, pick: MatchSign | undefined, played: boolean): MatchdayFixture {
  const { home, away, score, hour } = MATCHES[index];
  const hit = pick === signOf(score);
  return {
    matchId: index + 1,
    homeTeam: home,
    awayTeam: away,
    homeTeamId: null,
    awayTeamId: null,
    homeTeamLogo: null,
    awayTeamLogo: null,
    matchDate: kickOff(hour),
    round: 'Jornada 1',
    groupName: null,
    sport: 'FOOTBALL',
    finished: played,
    status: played ? 'FINISHED' : 'SCHEDULED',
    actualHomeScore: played ? score[0] : null,
    actualAwayScore: played ? score[1] : null,
    displayClock: null,
    predHomeScore: null,
    predAwayScore: null,
    predSign: pick ?? null,
    locked: played,
    lockReason: null,
    pointsAwarded: played ? (hit ? SIGN_POINTS : 0) : null,
    isExactScore: played ? false : null,
    isCorrectSign: played ? hit : null,
    // Los mismos textos que guarda el servidor al puntuar un signo.
    scoringDetails: played
      ? hit
        ? `Acierto de signo 1X2 (${SIGN_POINTS} pts)`
        : 'Sin acierto en signo (0 pts)'
      : null,
  };
}

const voter = ({ userId, name }: DemoPlayer): MatchVoter => ({ userId, name, avatarUrl: null });

/** Quién ha votado cada signo; como en la app, solo se enseña con el partido ya cerrado. */
function votersFor(index: number, pick: MatchSign | undefined): MatchVoters {
  const everyone = [
    { player: YOU, sign: pick },
    ...FRIENDS.map((friend) => ({ player: friend, sign: friend.picks[index] })),
  ];
  const by = (sign: MatchSign) =>
    everyone.filter((entry) => entry.sign === sign).map((entry) => voter(entry.player));
  return { matchId: index + 1, home: by('1'), draw: by('X'), away: by('2') };
}

function rankingRow(player: DemoPlayer, points: number): LeaderboardRow {
  return {
    key: player.userId,
    id: player.userId,
    userId: player.userId,
    name: player.name,
    predictionName: player.name,
    avatarUrl: '',
    // El podio solo lee los puntos de la jornada.
    points: { total: points, matchday: points } as LeaderboardRow['points'],
    matchdayPoints: points,
    paid: true,
    thirdPlaceMatch: null,
    thirdPlaceWinner: null,
  };
}

/** Va en el hero: la jornada de ejemplo y, al jugarla, los resultados, los votos y el podio. */
export default function PredictionDemo() {
  const [picks, setPicks] = useState<(MatchSign | undefined)[]>(() =>
    MATCHES.map(() => undefined),
  );
  const [played, setPlayed] = useState(false);
  const [friendsOf, setFriendsOf] = useState<number | null>(null);
  const predicted = picks.filter(Boolean).length;
  const pending = MATCHES.length - predicted;

  const pick = (matchId: number, sign: MatchSign) => {
    // Como en la app, volver a pulsar el signo elegido lo quita.
    setPicks((current) =>
      current.map((value, i) => (i === matchId - 1 ? (value === sign ? undefined : sign) : value)),
    );
  };

  const reset = () => {
    setPicks(MATCHES.map(() => undefined));
    setPlayed(false);
    setFriendsOf(null);
  };

  const showFriends = (fixture: MatchdayFixture) =>
    setFriendsOf((current) => (current === fixture.matchId ? null : fixture.matchId));

  const rows = [
    rankingRow(YOU, pointsFor(picks)),
    ...FRIENDS.map((friend) => rankingRow(friend, pointsFor(friend.picks))),
  ];

  const friendsIndex = friendsOf != null ? friendsOf - 1 : null;

  return (
    <article className="md-page paper-panel album-sheet try-matchday" aria-label="Liga de ejemplo">
      <MatchdayHeader
        title="Mundial con amigos"
        isLocked={false}
        isLoading={false}
        predicted={predicted}
        total={MATCHES.length}
        saveStatus="idle"
        errorMsg=""
        onRetry={() => undefined}
      />

      <div className="flex flex-col gap-3.5">
        {MATCHES.map((_, index) => {
          const fixture = fixtureFor(index, picks[index], played);
          const sign = picks[index];
          return (
            <FixtureCard
              key={fixture.matchId}
              fixture={fixture}
              prediction={sign ? withSign(sign) : EMPTY_PREDICTION}
              locked={played}
              onQuickSign={pick}
              onShowFriends={showFriends}
              voters={played ? votersFor(index, sign) : undefined}
              onShowVoters={showFriends}
            />
          );
        })}
      </div>

      {friendsIndex != null && (
        <p className="try-friends" role="status">
          <strong>
            {MATCHES[friendsIndex].home} - {MATCHES[friendsIndex].away}:
          </strong>{' '}
          {played
            ? FRIENDS.map((friend) => `${friend.name} ${friend.picks[friendsIndex]}`).join(' · ')
            : 'las predicciones de Ana y Luis se ven cuando empieza el partido.'}
        </p>
      )}

      {played ? (
        <>
          <MatchdayPodium rows={rows} by="matchday" label="Podio de la jornada de ejemplo" />
          <button type="button" className="fam-btn fam-btn--block" onClick={reset}>
            Jugar otra vez
          </button>
        </>
      ) : (
        <button
          type="button"
          className="fam-btn fam-btn--ink fam-btn--block"
          disabled={pending > 0}
          onClick={() => setPlayed(true)}
        >
          {pending > 0
            ? `Te ${pending === 1 ? 'falta 1 partido' : `faltan ${pending} partidos`}`
            : 'Jugar la jornada'}
        </button>
      )}
      <p className="try-friends">Liga de ejemplo con Ana y Luis: no se guarda nada.</p>
    </article>
  );
}
