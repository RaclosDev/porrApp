import type { Match } from '../../types/api';
import type { CustomCanvasLayout, CustomResultSlot } from '../../utils/customBracket';
import BracketCanvas, { TeamSlot, type CanvasMatch } from '../BracketCanvas';
import { BracketFinalMatch } from '../BracketFinale';
import BracketTeamStatus from '../BracketTeamStatus';

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
    const isLoser = Boolean(name && match && played && winnerOf(match) && !isWinner);
    const classes = [
      isWinner ? 'is-won' : '',
      isLoser ? 'is-out' : '',
      name && match && featuredMatchId === match.id ? 'is-featured' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <TeamSlot
        name={label}
        logo={name ? logos[name] : null}
        placeholder={!name}
        className={classes}
        rightContent={
          played && name ? (
            <>
              <BracketTeamStatus outcome={isWinner ? 'qualified' : isLoser ? 'eliminated' : null} />
              <span className="team-slot-score">
                {isHome ? match?.homeScore : match?.awayScore}
              </span>
            </>
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
