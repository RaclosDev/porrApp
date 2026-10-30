import type { ReactNode } from 'react';
import { type RenderViewerSlot, type ViewerData } from './viewerTypes';
import BracketCanvas from '../BracketCanvas';
import { BracketFinalMatch } from '../BracketFinale';

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
        renderFinal={() => {
          const centerTotal = getCenterPointsTotal();
          return (
            <BracketFinalMatch
              description="Puntos obtenidos por tu predicción"
              home={renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
              away={renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
              champion={renderSlot(champName, { roundIndex: 'champion' })}
              thirdWinner={thirdWinnerName}
              thirdPlace={
                <>
                  {renderSlot(thirdHome, { roundIndex: 'thirdPlaceMatch', isHome: true })}
                  {renderSlot(thirdAway, { roundIndex: 'thirdPlaceMatch', isHome: false })}
                </>
              }
              footer={centerTotal > 0 ? <p className="finale-points">+{centerTotal} pts</p> : null}
            />
          );
        }}
      />
    </div>
  );
}
