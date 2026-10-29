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
            className="team-slot"
            style={{
              height: 50,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              justifyContent: 'center',
              pointerEvents: 'none',
              borderColor: getIsProv(part.champion) ? '#ff4757' : '#fbbf24',
              background: 'rgba(251,191,36,0.15)',
              color: '#fbbf24',
              borderStyle: getIsProv(part.champion) ? 'dashed' : 'solid',
              animation: getIsProv(part.champion) ? 'provisional-pulse 1.5s infinite' : 'none',
            }}
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
              className="team-slot"
              style={{
                height: 42,
                fontSize: '1rem',
                fontWeight: 'bold',
                justifyContent: 'center',
                pointerEvents: 'none',
                borderColor: getIsProv(part.thirdPlaceWinner) ? '#ff4757' : '#cd7f32',
                background: 'rgba(205, 127, 50, 0.15)',
                color: '#e0a96d',
                borderStyle: getIsProv(part.thirdPlaceWinner) ? 'dashed' : 'solid',
                animation: getIsProv(part.thirdPlaceWinner)
                  ? 'provisional-pulse 1.5s infinite'
                  : 'none',
              }}
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
