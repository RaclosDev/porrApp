import type { ReactNode } from 'react';
import type { CanvasMatch, RenderSlot, SlotTeam } from './BracketCanvas';

export default function BracketFinale<T extends SlotTeam>({
  leftRounds,
  rightRounds,
  renderSlot,
  center,
  renderRoundFooter,
}: {
  leftRounds: CanvasMatch<T>[][];
  rightRounds: CanvasMatch<T>[][];
  renderSlot: RenderSlot<T>;
  center?: () => ReactNode;
  renderRoundFooter?: (roundIndex: number, side: 'left' | 'right') => ReactNode;
}) {
  const semifinal = (side: 'left' | 'right') => {
    const match = (side === 'left' ? leftRounds : rightRounds)[3]?.[0];
    return (
      <section className={`finale-semifinal finale-semifinal-${side}`}>
        <h3>Semifinal {side === 'left' ? '1' : '2'}</h3>
        <div className="mb-match-card">
          {renderSlot(match?.home, { side, roundIndex: 3, matchIndex: 0, isHome: true })}
          {renderSlot(match?.away, { side, roundIndex: 3, matchIndex: 0, isHome: false })}
        </div>
        {renderRoundFooter?.(3, side)}
      </section>
    );
  };

  return (
    <div className="bracket-finale">
      {semifinal('left')}
      {semifinal('right')}
      <div className="finale-center">
        {center ? center() : <p className="text-center">Final aún por definir</p>}
      </div>
    </div>
  );
}

export function BracketFinalMatch({
  home,
  away,
  champion,
  thirdPlace,
  thirdWinner,
  footer,
  editable = false,
  description,
}: {
  home: ReactNode;
  away: ReactNode;
  champion: ReactNode;
  thirdPlace: ReactNode;
  thirdWinner?: string | null;
  footer?: ReactNode;
  editable?: boolean;
  description?: string;
}) {
  return (
    <>
      <section className="finale-final">
        <h3>La gran final</h3>
        {editable && <p className="finale-hint">Elige al campeón</p>}
        {description && <p className="finale-hint">{description}</p>}
        <div className="finale-duel">
          <div className="finale-contender">{home}</div>
          <span className="finale-versus" aria-hidden="true">
            vs
          </span>
          <div className="finale-contender">{away}</div>
        </div>
        <div className="finale-champion">
          <h4>Campeón</h4>
          {champion}
        </div>
        {footer}
      </section>
      <details className="finale-third">
        <summary>
          <span>Tercer puesto</span>
          {thirdWinner && <strong>{thirdWinner}</strong>}
        </summary>
        {editable && <p className="finale-hint">Elige quién queda tercero</p>}
        <div className="mb-match-card">{thirdPlace}</div>
      </details>
    </>
  );
}
