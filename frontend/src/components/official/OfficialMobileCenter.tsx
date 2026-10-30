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
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#cd7f32',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
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
