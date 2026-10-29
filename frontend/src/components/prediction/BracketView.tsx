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
    <div className="pb-5 mt-2.5">
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
            <div className="flex flex-col gap-5">
              {/* Final */}
              <div>
                <div className="text-[0.75rem] font-bold text-[rgba(251,191,36,0.9)] tracking-[2px] uppercase text-center mb-2">
                  🏆 Final 🏆
                </div>
                <div className="mb-match-card">
                  {renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
                  {renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
                </div>
              </div>
              {/* Campeón */}
              <div className="text-center">
                <div className="text-[0.75rem] font-bold text-gold tracking-[2px] uppercase mb-2">
                  🏆 Campeón
                </div>
                <div className="champion-display">
                  {renderSlot(champName, { roundIndex: 'champion' })}
                </div>
              </div>
              {/* Tercer Puesto */}
              <div>
                <div className="text-[0.75rem] font-bold text-muted tracking-[2px] uppercase text-center mb-2">
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
                <div className="text-center">
                  <div className="text-[0.75rem] font-bold text-muted tracking-[1.5px] uppercase mb-2">
                    🥉 Ganador 3er Puesto
                  </div>
                  <div className="champion-display">
                    {renderSlot(thirdWinnerName, { roundIndex: 'thirdPlaceMatch' })}
                  </div>
                </div>
              )}
              {/* Puntos del centro */}
              {centerTotal > 0 && (
                <div className="text-center">
                  <div className="text-[0.85rem] font-bold text-[#00d2d3] bg-[rgba(0,_210,_211,_0.1)] inline-block py-1 px-3 rounded-[6px]">
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
