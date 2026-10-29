import type { ReactNode } from 'react';
import { type RenderViewerSlot, type ViewerData } from './viewerTypes';
import BracketCanvas from '../BracketCanvas';

interface BracketViewProps {
  champName: string | null;
  thirdWinnerName: string | null;
  finalHome: string | null;
  finalAway: string | null;
  thirdHome: string | null;
  thirdAway: string | null;
  getCenterPointsTotal: () => number;
  hiddenRounds: Record<number, boolean>;
  leftRounds: ViewerData['leftRounds'];
  rightRounds: ViewerData['rightRounds'];
  renderCenter: (colW: number) => ReactNode;
  renderRoundFooter: (roundIndex: number, side: 'left' | 'right') => ReactNode;
  renderSlot: RenderViewerSlot;
}

/** Cuadro de eliminatorias del pronóstico (lienzo en escritorio, pestañas en móvil). */
export default function BracketView({
  champName,
  thirdWinnerName,
  finalHome,
  finalAway,
  thirdHome,
  thirdAway,
  getCenterPointsTotal,
  hiddenRounds,
  leftRounds,
  rightRounds,
  renderCenter,
  renderRoundFooter,
  renderSlot,
}: BracketViewProps) {
  return (
    <div
      style={{
        paddingBottom: '20px',
        marginTop: '10px',
      }}
    >
      <BracketCanvas
        leftRounds={leftRounds}
        rightRounds={rightRounds}
        renderSlot={renderSlot}
        renderCenter={renderCenter}
        hiddenRounds={hiddenRounds}
        renderRoundFooter={renderRoundFooter}
        mobileCenter={() => {
          const centerTotal = getCenterPointsTotal();
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Final */}
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'rgba(251,191,36,0.9)',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  🏆 Final 🏆
                </div>
                <div className="mb-match-card">
                  {renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
                  {renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
                </div>
              </div>
              {/* Campeón */}
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--champion-gold)',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  🏆 Campeón
                </div>
                <div className="champion-display">
                  {renderSlot(champName, { roundIndex: 'champion' })}
                </div>
              </div>
              {/* Tercer Puesto */}
              <div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    marginBottom: 8,
                  }}
                >
                  🥉 Tercer Puesto
                </div>
                <div className="mb-match-card">
                  {renderSlot(thirdHome, {
                    roundIndex: 'thirdPlaceMatch',
                    isHome: true,
                  })}
                  {renderSlot(thirdAway, {
                    roundIndex: 'thirdPlaceMatch',
                    isHome: false,
                  })}
                </div>
              </div>
              {/* Ganador Tercer Puesto */}
              {thirdWinnerName && (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      letterSpacing: 1.5,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    🥉 Ganador 3er Puesto
                  </div>
                  <div className="champion-display">
                    {renderSlot(thirdWinnerName, { roundIndex: 'thirdPlaceMatch' })}
                  </div>
                </div>
              )}
              {/* Puntos del centro */}
              {centerTotal > 0 && (
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      color: '#00d2d3',
                      background: 'rgba(0, 210, 211, 0.1)',
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '6px',
                    }}
                  >
                    +{centerTotal} pts
                  </div>
                </div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
}
