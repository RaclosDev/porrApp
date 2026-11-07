import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMatchdayFriendPredictions } from '../services/api';
import { UserAvatar } from './Avatar';
import type { FriendPrediction, MatchdayFixture } from '../types/api';
import SheetDialog from './SheetDialog';
import { methodRoundText } from '../utils/fights';

function TeamCrest({ logo, name }: { logo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [logo]);

  if (logo && !failed) {
    return (
      <img
        className="friends-predictions-crest"
        src={logo}
        alt=""
        width={30}
        height={30}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="friends-predictions-crest friends-predictions-crest-fallback"
      aria-hidden="true"
    >
      {name.trim().charAt(0).toLocaleUpperCase('es')}
    </span>
  );
}

const formatTimestamp = (dateStr: string | null) => {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
};

/**
 * Signo pronosticado: el guardado o, si solo hay marcador, el que se deduce de él. Las ligas
 * por jornadas se juegan a 1X2, así que se muestra el signo y nunca un marcador.
 */
const signOf = (prediction: FriendPrediction): string | null => {
  const sign = prediction.sign?.trim().toUpperCase();
  if (sign === '1' || sign === 'X' || sign === '2') return sign;
  const { homeScore: home, awayScore: away } = prediction;
  if (home == null || away == null) return null;
  return home > away ? '1' : home === away ? 'X' : '2';
};

function PredictionRow({
  prediction,
  showTime,
  children,
}: {
  prediction: FriendPrediction;
  /** La hora solo dice algo antes del cierre: después cambia al repartir los puntos. */
  showTime: boolean;
  children: ReactNode;
}) {
  const formattedTime = showTime ? formatTimestamp(prediction.updatedAt) : null;
  return (
    <div className={`friends-prediction${prediction.isCaller ? ' is-caller' : ''}`}>
      <UserAvatar
        url={prediction.avatarUrl}
        userId={prediction.userId}
        name={prediction.participantName}
        size={40}
      />
      <div className="friends-prediction-main">
        <div className="friends-prediction-name">
          <span>{prediction.participantName}</span>
          {prediction.isCaller && <span className="friends-prediction-you">Tú</span>}
        </div>
        {formattedTime && <div className="friends-prediction-time">{formattedTime}</div>}
      </div>
      <div className="friends-prediction-result">{children}</div>
    </div>
  );
}

function Points({ points }: { points: number | null }) {
  if (points == null) return null;
  return (
    <span className={`friends-prediction-points${points > 0 ? '' : ' is-zero'}`}>
      {points > 0 ? `+${points} pts` : '0 pts'}
    </span>
  );
}

export default function MatchFriendsPredictionsModal({
  groupId,
  match,
  onClose,
}: {
  groupId: string;
  match: MatchdayFixture | null;
  onClose: () => void;
}) {
  const matchId = match?.matchId;
  const {
    data: predictions = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['matchFriendPredictions', groupId, matchId],
    queryFn: () => fetchMatchdayFriendPredictions(groupId, matchId!),
    enabled: Boolean(groupId && matchId),
  });

  if (!match) return null;

  const isMatchLocked = Boolean(match.finished || match.locked);
  const predictedCount = predictions.filter((prediction) => prediction.hasPredicted).length;
  const progress = predictions.length ? Math.round((predictedCount / predictions.length) * 100) : 0;
  const matchDate = formatTimestamp(match.matchDate);
  const roundLabel = match.round && match.round !== 'group' ? match.round : '';
  // En una pelea de la UFC el «marcador» solo dice quién ganó: no se muestra.
  const isFight = Boolean(match.fight);
  const hasFinalScore =
    !isFight && match.finished && match.actualHomeScore != null && match.actualAwayScore != null;
  const ready = !isLoading && !error && predictions.length > 0;

  // Cerrado: agrupado por signo, igual que la lista de votos del inicio. Abierto: quién ha
  // predicho ya (los signos ajenos siguen ocultos).
  const groups = [
    { sign: '1', title: `Gana ${match.homeTeam}` },
    { sign: 'X', title: 'Empate' },
    { sign: '2', title: `Gana ${match.awayTeam}` },
    { sign: '–', title: 'Sin predicción' },
  ]
    .map((group) => ({
      ...group,
      list: predictions.filter((prediction) => (signOf(prediction) ?? '–') === group.sign),
    }))
    .filter(({ sign, list }) => (sign !== '–' || list.length > 0) && !(isFight && sign === 'X'));

  return (
    <SheetDialog
      title={isFight ? 'Predicciones de la pelea' : 'Predicciones del partido'}
      onClose={onClose}
    >
      <div className="friends-predictions-match">
        <div className="friends-predictions-team">
          <TeamCrest logo={match.homeTeamLogo} name={match.homeTeam} />
          <span>{match.homeTeam}</span>
        </div>
        <div className="friends-predictions-center">
          <span className={`friends-predictions-vs${hasFinalScore ? ' is-finished' : ''}`}>
            {hasFinalScore ? `${match.actualHomeScore} - ${match.actualAwayScore}` : 'vs'}
          </span>
          {roundLabel && <span className="friends-predictions-round">{roundLabel}</span>}
        </div>
        <div className="friends-predictions-team is-away">
          <span>{match.awayTeam}</span>
          <TeamCrest logo={match.awayTeamLogo} name={match.awayTeam} />
        </div>
      </div>

      <div className="friends-predictions-meta">
        {matchDate && <span>{matchDate}</span>}
        {!isLoading && !error && (
          <span className="friends-predictions-count">
            {predictedCount}/{predictions.length} con predicción
          </span>
        )}
      </div>
      <div className="friends-predictions-progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <div className="friends-predictions-list sheet-dialog-body">
        {isLoading && (
          <div className="friends-predictions-skeletons" role="status">
            <span className="sr-only">Cargando predicciones…</span>
            {[0, 1, 2].map((row) => (
              <div key={row} className="friends-predictions-skeleton skeleton" />
            ))}
          </div>
        )}

        {error && (
          <p className="friends-predictions-message is-error">
            No se pudieron cargar las predicciones de la liga.
          </p>
        )}

        {!isLoading && !error && predictions.length === 0 && (
          <p className="friends-predictions-message">
            Todavía no hay miembros con predicciones en este partido.
          </p>
        )}

        {ready &&
          isMatchLocked &&
          groups.map(({ sign, title, list }) => (
            <section key={sign} className="match-voters-group" aria-label={`${sign} · ${title}`}>
              <h3 className="match-voters-heading">
                <span className="match-voters-sign">{sign}</span>
                <span className="min-w-0 truncate">{title}</span>
                <span className="match-voters-count">{list.length}</span>
              </h3>
              {list.length === 0 ? (
                <p className="sheet-dialog-status">Nadie</p>
              ) : (
                list.map((prediction) => (
                  <PredictionRow key={prediction.userId} prediction={prediction} showTime={false}>
                    {isFight && prediction.method && (
                      <span className="text-[0.75rem] text-muted shrink-0">
                        {methodRoundText(prediction.method, prediction.round)}
                      </span>
                    )}
                    <Points points={prediction.pointsAwarded} />
                  </PredictionRow>
                ))
              )}
            </section>
          ))}

        {ready &&
          !isMatchLocked &&
          predictions.map((prediction) => {
            const sign = signOf(prediction);
            return (
              <PredictionRow key={prediction.userId} prediction={prediction} showTime>
                {sign ? (
                  <span className="friends-prediction-pick">{sign}</span>
                ) : prediction.hasPredicted ? (
                  <span className="friends-prediction-status is-hidden">Oculto</span>
                ) : (
                  <span className="friends-prediction-status is-pending">Pendiente</span>
                )}
              </PredictionRow>
            );
          })}
      </div>

      {!isMatchLocked && (
        <div className="friends-predictions-foot">
          <span>
            Las predicciones de los demás se ven al empezar {isFight ? 'la pelea' : 'el partido'}.
          </span>
        </div>
      )}
    </SheetDialog>
  );
}
