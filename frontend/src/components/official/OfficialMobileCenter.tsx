import { buildBracketData, slotName, type BracketSlot } from '../../utils/bracketBuilder';
import type { OfficialSlotContext } from '../BracketCanvas';
import Flag from '../Flag';
import type { ReactNode } from 'react';

interface OfficialMobileCenterProps {
  part: ReturnType<typeof buildBracketData>;
  getName: typeof slotName;
  getIsProv: (t: BracketSlot | undefined) => boolean;
  renderSlot: (team: BracketSlot | undefined, context?: OfficialSlotContext) => ReactNode;
}

/** Final, campeón y tercer puesto oficiales en la vista móvil. */
export default function OfficialMobileCenter({
  part,
  getName,
  getIsProv,
  renderSlot,
}: OfficialMobileCenterProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* Final */}
      <div>
        <div className="text-[0.75rem] font-bold text-[rgba(251,191,36,0.9)] tracking-[2px] uppercase text-center mb-2">
          🏆 Final 🏆
        </div>
        <div className="mb-match-card">
          {renderSlot(part.final?.[0], {
            side: 'center',
            roundIndex: 'final',
            isHome: true,
          })}
          {renderSlot(part.final?.[1], {
            side: 'center',
            roundIndex: 'final',
            isHome: false,
          })}
        </div>
      </div>
      {/* Campeón */}
      <div className="text-center">
        <div className="text-[0.75rem] font-bold text-gold tracking-[2px] uppercase mb-2">
          🏆 Campeón
        </div>
        <div className="champion-display">
          <div
            className={`team-slot h-12.5 text-[1.1rem] font-bold justify-center pointer-events-none bg-[rgba(251,191,36,0.15)] text-[#fbbf24] ${getIsProv(part.champion) ? 'border-[#ff4757]' : 'border-[#fbbf24]'} ${getIsProv(part.champion) ? 'border-dashed' : 'border-solid'} ${getIsProv(part.champion) ? '[animation:provisional-pulse_1.5s_infinite]' : '[animation:none]'}`}
          >
            <Flag
              team={getName(part.champion) || ''}
              size="w40"
              style={{
                width: 24,
                height: 18,
                borderRadius: 2,
                marginRight: 8,
                verticalAlign: 'middle',
              }}
            />
            {getName(part.champion) || '???'}
          </div>
        </div>
      </div>
      {/* Tercer Puesto */}
      <div>
        <div className="text-[0.75rem] font-bold text-muted tracking-[2px] uppercase text-center mb-2">
          🥉 Tercer Puesto
        </div>
        <div className="mb-match-card">
          {renderSlot(part.thirdPlaceMatch?.[0], {
            side: 'center',
            roundIndex: 'thirdPlaceMatch',
            isHome: true,
          })}
          {renderSlot(part.thirdPlaceMatch?.[1], {
            side: 'center',
            roundIndex: 'thirdPlaceMatch',
            isHome: false,
          })}
        </div>
        <div className="text-center mt-2.5">
          <div className="text-[0.75rem] font-bold text-[#cd7f32] tracking-[2px] uppercase mb-1.5">
            🥉 3.º Puesto
          </div>
          <div className="champion-display">
            <div
              className={`team-slot h-10.5 text-[1rem] font-bold justify-center pointer-events-none bg-[rgba(205,_127,_50,_0.15)] text-[#e0a96d] ${getIsProv(part.thirdPlaceWinner) ? 'border-[#ff4757]' : 'border-[#cd7f32]'} ${getIsProv(part.thirdPlaceWinner) ? 'border-dashed' : 'border-solid'} ${getIsProv(part.thirdPlaceWinner) ? '[animation:provisional-pulse_1.5s_infinite]' : '[animation:none]'}`}
            >
              <Flag
                team={getName(part.thirdPlaceWinner) || ''}
                size="w40"
                style={{
                  width: 20,
                  height: 15,
                  borderRadius: 2,
                  marginRight: 6,
                  verticalAlign: 'middle',
                }}
              />
              {getName(part.thirdPlaceWinner) || '???'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
