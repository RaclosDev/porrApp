import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('shows the whole bracket on three sheets without a view selector', () => {
    const pick = vi.fn();
    const rounds = [
      [{ home: 'España', away: 'Italia' }],
      [{ home: 'España', away: 'Alemania' }],
      [{ home: 'España', away: 'Portugal' }],
      [{ home: 'España', away: 'Francia' }],
    ];
    render(
      <BracketCanvas
        leftRounds={rounds}
        rightRounds={rounds}
        renderSlot={(name, context) => <TeamSlot name={name} onClick={() => pick(context)} />}
        renderFinal={() => <p>Final destacada y tercer puesto</p>}
      />,
    );
    const left = within(screen.getByRole('region', { name: 'Cruces del lado izquierdo' }));
    const right = within(screen.getByRole('region', { name: 'Cruces del lado derecho' }));
    const center = within(
      screen.getByRole('region', { name: 'Semifinales, final y tercer puesto' }),
    );
    expect(left.getByText('Italia')).toBeInTheDocument();
    expect(right.getByText('Portugal')).toBeInTheDocument();
    expect(center.getByText('Final destacada y tercer puesto')).toBeInTheDocument();
    expect(center.getByRole('heading', { name: 'Semifinal 1' })).toBeInTheDocument();
    expect(center.getByRole('heading', { name: 'Semifinal 2' })).toBeInTheDocument();
    expect(left.queryByText('Francia')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cuadro completo' })).not.toBeInTheDocument();
    fireEvent.click(left.getAllByRole('button', { name: 'Pasar a España' })[0]);
    expect(pick).toHaveBeenCalledWith({ side: 'left', roundIndex: 0, matchIndex: 0, isHome: true });
  });
});
