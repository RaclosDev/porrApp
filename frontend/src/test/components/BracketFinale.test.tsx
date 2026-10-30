import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BracketCanvas, { TeamSlot } from '../../components/BracketCanvas';
import { BracketFinalMatch } from '../../components/BracketFinale';

describe('Bracket finale', () => {
  it('keeps the champion choice and third-place choice accessible in the combined view', () => {
    const pickChampion = vi.fn();
    const pickThird = vi.fn();
    render(
      <BracketFinalMatch
        editable
        home={<TeamSlot name="España" onClick={pickChampion} />}
        away={<TeamSlot name="Argentina" />}
        champion={<TeamSlot name={null} />}
        thirdPlace={<TeamSlot name="Francia" onClick={pickThird} />}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pasar a España' }));
    expect(pickChampion).toHaveBeenCalledOnce();
    const thirdPlace = screen.getByText('Tercer puesto').closest('details')!;
    expect(thirdPlace).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('Tercer puesto'));
    expect(thirdPlace).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Pasar a Francia' }));
    expect(pickThird).toHaveBeenCalledOnce();
  });

  it('lets desktop users switch between the complete tree and the combined finale', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    try {
      const rounds = [[], [], [], [{ home: 'España', away: 'Francia' }]];
      render(
        <BracketCanvas
          leftRounds={rounds}
          rightRounds={rounds}
          renderSlot={(name) => <TeamSlot name={name} />}
          renderCenter={() => <p>Árbol completo</p>}
          renderFinal={() => <p>Final destacada</p>}
        />,
      );
      const final = screen.getByRole('button', { name: 'Final', exact: true });
      fireEvent.click(final);
      expect(final).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { name: 'Semifinal 1' })).toBeInTheDocument();
      expect(screen.getByText('Árbol completo').closest('.desktop-bracket-wrapper')).toHaveClass(
        'finale-full-hidden',
      );
      fireEvent.click(screen.getByRole('button', { name: 'Cuadro completo' }));
      expect(final).toHaveAttribute('aria-pressed', 'false');
      expect(
        screen.getByText('Árbol completo').closest('.desktop-bracket-wrapper'),
      ).not.toHaveClass('finale-full-hidden');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
