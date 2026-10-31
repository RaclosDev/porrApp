import Flag from '../Flag';
import { matchTop, MATCH_H, COL_GAP } from '../BracketCanvas';
import type { RenderViewerSlot } from './viewerTypes';

interface BracketCenterProps {
  colW: number;
  centerTotal: number;
  champName: string | null;
  thirdWinnerName: string | null;
  finalHome: string | null;
  finalAway: string | null;
  thirdHome: string | null;
  thirdAway: string | null;
  renderSlot: RenderViewerSlot;
}

const finalTopY = matchTop(3, 0);

/** Bloque central del lienzo de escritorio: final, campeón y tercer puesto. */
export default function BracketCenter({
  colW,
  centerTotal,
  champName,
  thirdWinnerName,
  finalHome,
  finalAway,
  thirdHome,
  thirdAway,
  renderSlot,
}: BracketCenterProps) {
  return (
    <div className="block">
      <div
        className="absolute flex flex-col items-center gap-0.5 pointer-events-none"
        style={{ top: finalTopY - 44, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-gold tracking-[0.5px] uppercase">Final</div>
        {centerTotal > 0 ? (
          <div className="marker-ink text-[1rem] inline-block">+{centerTotal} pts</div>
        ) : (
          <div className="text-[0.85rem] font-bold text-muted">0 pts</div>
        )}
      </div>

      <div
        className="match final-match absolute"
        style={{ top: finalTopY, left: COL_GAP, width: colW }}
      >
        {renderSlot(finalHome, { roundIndex: 'final', isHome: true })}
        {renderSlot(finalAway, { roundIndex: 'final', isHome: false })}
      </div>

      <div
        className="absolute text-center"
        style={{ top: finalTopY + MATCH_H + 16, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-gold tracking-[0.5px] uppercase mb-1">
          Campeón
        </div>
        <div className="champion-display">
          <div className="team-slot h-12.5 text-[1.1rem] font-bold justify-center pointer-events-none border-gold bg-[rgba(146,_64,_14,_0.1)] bg-none text-gold">
            <Flag
              team={champName || ''}
              size="w40"
              style={{
                width: 24,
                height: 18,
                borderRadius: 2,
                marginRight: 8,
                verticalAlign: 'middle',
              }}
            />
            {champName || '???'}
          </div>
        </div>
      </div>

      <div
        className="absolute text-center"
        style={{ top: finalTopY + MATCH_H + 16 + MATCH_H + 36, left: COL_GAP, width: colW }}
      >
        <div className="text-[0.65rem] font-bold text-muted tracking-[0.5px] uppercase mb-1">
          Tercer puesto
        </div>
        <div className="match third-place">
          {renderSlot(thirdHome, { roundIndex: 'thirdPlaceMatch', isHome: true })}
          {renderSlot(thirdAway, { roundIndex: 'thirdPlaceMatch', isHome: false })}
        </div>
        {thirdWinnerName && (
          <div className="mt-2 text-center">
            <div className="text-[0.65rem] font-bold text-muted tracking-[0.5px] uppercase mb-1">
              Ganador del tercer puesto
            </div>
            <div className="champion-display inline-block w-full">
              <div className="team-slot h-9.5 text-[0.95rem] font-bold justify-center pointer-events-none border-[#9a3412] bg-[rgba(154,_52,_18,_0.1)] bg-none text-[#9a3412]">
                <Flag
                  team={thirdWinnerName || ''}
                  size="w40"
                  style={{
                    width: 20,
                    height: 15,
                    borderRadius: 2,
                    marginRight: 6,
                    verticalAlign: 'middle',
                  }}
                />
                {thirdWinnerName || '???'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
