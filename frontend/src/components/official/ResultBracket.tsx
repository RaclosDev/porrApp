import type { CSSProperties } from 'react';
import type { Match } from '../../types/api';
import type { CustomCanvasLayout, CustomResultSlot } from '../../utils/customBracket';
import BracketCanvas, { TeamSlot, type CanvasMatch } from '../BracketCanvas';
import { BracketFinalMatch } from '../BracketFinale';

const toCanvasMatch = (slot: CustomResultSlot): CanvasMatch<string | null> => ({
  home: slot.home,
  away: slot.away,
});

interface ResultBracketProps {
  layout: CustomCanvasLayout<CustomResultSlot>;
  logos: Record<string, string>;
  /** Cruce destacado como próximo partido. */
  featuredMatchId?: number | null;
  /** Ganador de un cruce jugado. */
  winnerOf: (match: Match) => string | null;
}

/** Cuadro de resultados reales con el lienzo del cuadro oficial: cada casilla con su marcador. */
export default function ResultBracket({
  layout,
  logos,
  featuredMatchId,
  winnerOf,
}: ResultBracketProps) {
  const finalMatch = layout.final?.match;
  const champion = finalMatch ? winnerOf(finalMatch) : null;

  const renderResultSlot = (slot: CustomResultSlot | null | undefined, isHome: boolean) => {
    if (!slot) return <TeamSlot name={null} />;
    const name = isHome ? slot.home : slot.isBye ? null : slot.away;
    const label = name ?? (isHome ? slot.homePlaceholder : slot.awayPlaceholder);
    const match = slot.match;
    const played = Boolean(match?.finished && match.homeScore != null && match.awayScore != null);
    const isWinner = Boolean(name && match && played && winnerOf(match) === name);

    let style: CSSProperties = {};
    if (name && match && featuredMatchId === match.id) {
      style = {
        border: '2px solid var(--accent-cyan)',
        position: 'relative',
        zIndex: 10,
        fontWeight: 'bold',
      };
    }

    return (
      <TeamSlot
        name={label}
        logo={name ? logos[name] : null}
        placeholder={!name}
        slotStyle={style}
        rightContent={
          played && name ? (
            <span
              className={`ml-1 text-[0.85em] font-bold bg-[rgba(17,24,39,0.06)] bg-none py-0.5 px-1 rounded-[4px] ${isWinner ? 'text-[var(--hit)]' : 'text-muted'}`}
            >
              {isHome ? match?.homeScore : match?.awayScore}
              {isWinner && <span className="sr-only"> (ganador)</span>}
            </span>
          ) : null
        }
      />
    );
  };

  return (
    <BracketCanvas
      leftRounds={layout.left.map((round) => round.map(toCanvasMatch))}
      rightRounds={layout.right.map((round) => round.map(toCanvasMatch))}
      roundLabels={layout.roundLabels}
      centerLabel={layout.roundLabels.length ? 'Semifinales y final' : 'Final'}
      renderSlot={(_, { side, roundIndex, matchIndex, isHome }) =>
        renderResultSlot(layout[side][roundIndex]?.[matchIndex], isHome)
      }
      renderFinal={() => (
        <BracketFinalMatch
          home={renderResultSlot(layout.final, true)}
          away={renderResultSlot(layout.final, false)}
          champion={
            <TeamSlot
              name={champion}
              logo={champion ? logos[champion] : null}
              placeholder={!champion}
            />
          }
        />
      )}
    />
  );
}
