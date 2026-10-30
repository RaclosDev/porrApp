import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MobileBracket from '../../components/MobileBracket';
import { TeamSlot, type CanvasMatch } from '../../components/BracketCanvas';

const match = (home: string, away: string): CanvasMatch<string> => ({ home, away });

/** Cuadro sin dieciseisavos. */
const leftRounds = [
  [],
  [match('España', 'Italia'), match('Francia', 'Alemania')],
  [match('España', 'Francia')],
  [match('España', 'Brasil')],
];
const rightRounds = [
  [],
  [match('Brasil', 'Argentina'), match('Portugal', 'Inglaterra')],
  [match('Brasil', 'Portugal')],
  [match('Argentina', 'Portugal')],
];

const renderBracket = (defaultTab: number, onPick = vi.fn()) => {
  render(
    <MobileBracket
      leftRounds={leftRounds}
      rightRounds={rightRounds}
      defaultTab={defaultTab}
      renderSlot={(team) => <TeamSlot name={team as string} onClick={() => onPick(team)} />}
      renderFinal={() => <p>Contenido de la final</p>}
    />,
  );
  return onPick;
};

describe('MobileBracket', () => {
  it('picking a semifinal team keeps the combined Final tab open', () => {
    const onPick = renderBracket(3);
    fireEvent.click(screen.getAllByRole('button', { name: 'Pasar a España' })[0]);

    expect(onPick).toHaveBeenCalledWith('España');
    expect(screen.getByRole('tab', { name: 'Final' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Contenido de la final')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Semis' })).not.toBeInTheDocument();
  });

  it('picking a team in the next-round column keeps the current tab open', () => {
    const onPick = renderBracket(1);
    // "Francia" aparece en octavos y en la columna de cuartos.
    const slots = screen.getAllByRole('button', { name: 'Pasar a Francia' });
    fireEvent.click(slots[slots.length - 1]);

    expect(onPick).toHaveBeenCalledWith('Francia');
    expect(screen.getByRole('tab', { name: 'Octavos' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates with the dedicated buttons', () => {
    renderBracket(1);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ronda →' }));
    expect(screen.getByRole('tab', { name: 'Cuartos' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ronda →' }));
    expect(screen.getByRole('tab', { name: 'Final' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Contenido de la final')).toBeInTheDocument();
  });
});
