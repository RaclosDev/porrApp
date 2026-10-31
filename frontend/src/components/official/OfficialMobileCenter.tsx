import { buildBracketData, slotName, type BracketSlot } from '../../utils/bracketBuilder';
import { TeamSlot, type OfficialSlotContext } from '../BracketCanvas';
import { BracketFinalMatch } from '../BracketFinale';
import type { ReactNode } from 'react';

interface OfficialMobileCenterProps {
  expandedThirdPlace?: boolean;
  part: ReturnType<typeof buildBracketData>;
  getName: typeof slotName;
  getIsProv: (t: BracketSlot | undefined) => boolean;
  renderSlot: (team: BracketSlot | undefined, context?: OfficialSlotContext) => ReactNode;
}

export default function OfficialMobileCenter({
  expandedThirdPlace,
  part,
  getName,
  getIsProv,
  renderSlot,
}: OfficialMobileCenterProps) {
  return (
    <BracketFinalMatch
      expandedThirdPlace={expandedThirdPlace}
      home={renderSlot(part.final?.[0], { side: 'center', roundIndex: 'final', isHome: true })}
      away={renderSlot(part.final?.[1], { side: 'center', roundIndex: 'final', isHome: false })}
      champion={
        <TeamSlot
          name={getName(part.champion)}
          slotStyle={getIsProv(part.champion) ? { borderStyle: 'dashed' } : {}}
        />
      }
      thirdWinner={getName(part.thirdPlaceWinner)}
      thirdPlace={
        <>
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
        </>
      }
    />
  );
}
