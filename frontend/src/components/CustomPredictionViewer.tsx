import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { fetchCustomTeams, fetchPrediction } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';
import { getCustomRoundTitle } from '../utils/customBracket';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useCustomLock } from '../hooks/useCustomLock';
import { knockoutRoundTitle } from '../utils/knockoutDraw';
import Flag from './Flag';
import { ViewerModal } from './prediction/ViewerFrame';
import '../styles/custom-prediction-viewer.css';

export default function CustomPredictionViewer({
  predictionId,
  onClose,
}: {
  predictionId: string | number;
  onClose: () => void;
}) {
  const { activeGroupId, activeGroupCustomCompetition, activeGroupKnockoutDraw, allGames } =
    useAppContext();
  // En unas eliminatorias sorteadas ronda a ronda cada lista es una ronda real con sus cruces.
  const lock = useCustomLock(activeGroupKnockoutDraw ? activeGroupId : null);
  const knockoutRounds = activeGroupKnockoutDraw ? (lock.state?.knockoutRounds ?? []) : null;
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { active: true, onEscape: onClose });

  const {
    data: prediction,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: ['predictionViewer', predictionId],
    queryFn: () => fetchPrediction(predictionId),
    retry: false,
    gcTime: 0,
  });
  const { data: teams = [] } = useQuery({
    queryKey: queryKeys.customTeams(activeGroupId),
    queryFn: () => fetchCustomTeams(Number(activeGroupId)),
    enabled: Boolean(activeGroupId) && activeGroupCustomCompetition,
  });
  const logos: Record<string, string | null | undefined> = activeGroupCustomCompetition
    ? Object.fromEntries(teams.map((team) => [team.name, team.logoUrl]))
    : Object.fromEntries(
        allGames.flatMap((match) => [
          [match.home, match.homeLogo || match.homeTeamLogo],
          [match.away, match.awayLogo || match.awayTeamLogo],
        ]),
      );
  const groups = Object.entries(prediction?.groups ?? {});
  const rounds = prediction?.customRounds ?? [];

  const teamName = (name: string | null | undefined, hidden = 'Aún oculto') =>
    name ? (
      <span className="custom-viewer-team">
        <Flag team={name} logo={logos[name]} />
        <span>{name}</span>
      </span>
    ) : (
      <span className="custom-viewer-hidden">{hidden}</span>
    );

  return (
    <ViewerModal dialogRef={dialogRef} onClose={onClose} className="modal-content custom-viewer">
      <div className="custom-viewer-header">
        <div className="custom-viewer-heading">
          <span className="custom-viewer-eyebrow">Predicción</span>
          <h2 className="poster-title">
            {prediction?.user ? `Porra de ${prediction.user}` : 'Porra'}
          </h2>
        </div>
        <button type="button" className="custom-viewer-close" onClick={onClose} aria-label="Cerrar">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="custom-viewer-body">
        {isPending && <p role="status">Cargando predicción…</p>}
        {error && (
          <div className="custom-viewer-error" role="alert">
            <p>{errorMessage(error, 'No se pudo cargar la predicción')}</p>
            <button type="button" className="glass-btn" onClick={() => void refetch()}>
              Reintentar
            </button>
          </div>
        )}

        {prediction && (
          <>
            {prediction.champion && (
              <div className="custom-viewer-champion">
                <Trophy size={24} aria-hidden="true" />
                <div>
                  <span>Campeón elegido</span>
                  <strong>{teamName(prediction.champion)}</strong>
                </div>
              </div>
            )}

            {groups.length > 0 && (
              <section
                className="custom-viewer-section"
                aria-labelledby="custom-viewer-groups-title"
              >
                <h3 id="custom-viewer-groups-title" className="poster-title">
                  Fase de grupos
                </h3>
                <div className="custom-viewer-grid">
                  {groups.map(([group, order]) => (
                    <section key={group} className="custom-viewer-card">
                      <h4 className="album-sheet-title">Grupo {group}</h4>
                      <ol className="custom-viewer-list">
                        {order.map((team, index) => (
                          <li key={`${group}-${index}`}>
                            <span className="custom-viewer-index">{index + 1}º</span>
                            {teamName(team)}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              </section>
            )}

            {rounds.length > 0 && (
              <section
                className="custom-viewer-section"
                aria-labelledby="custom-viewer-rounds-title"
              >
                <h3 id="custom-viewer-rounds-title" className="poster-title">
                  Eliminatorias
                </h3>
                <div className="custom-viewer-grid">
                  {rounds.map((round, index) => (
                    <section key={index} className="custom-viewer-card">
                      <h4 className="album-sheet-title">
                        {knockoutRounds
                          ? knockoutRoundTitle(knockoutRounds[index]?.round ?? '')
                          : getCustomRoundTitle(index, rounds.length)}
                      </h4>
                      <ol className="custom-viewer-list">
                        {round.map((winner, position) => {
                          const tie = knockoutRounds?.[index]?.ties[position];
                          // En unas eliminatorias sorteadas se dice de qué cruce es cada elección.
                          return tie ? (
                            <li key={position} className="custom-viewer-tie">
                              <span className="custom-viewer-tie-label">
                                {tie.home ?? '?'} – {tie.away ?? '?'}
                              </span>
                              {teamName(winner, 'Sin elegir u oculto')}
                            </li>
                          ) : (
                            <li key={position}>
                              <span className="custom-viewer-index">C{position + 1}</span>
                              {teamName(winner)}
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </ViewerModal>
  );
}
