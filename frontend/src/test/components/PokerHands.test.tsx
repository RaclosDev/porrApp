import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import PokerHands from '../../components/poker/PokerHands';

it('lista las jugadas de mejor a peor, plegadas hasta abrirlas', () => {
  render(<PokerHands />);
  expect(screen.getByText('Doble pareja')).not.toBeVisible();
  fireEvent.click(screen.getByText('Jugadas del póker'));
  const names = screen
    .getAllByRole('listitem')
    .map((item) => item.querySelector('strong')?.textContent);
  expect(names[0]).toBe('Escalera real');
  expect(names.indexOf('Doble pareja')).toBeLessThan(names.indexOf('Pareja'));
  expect(names.at(-1)).toBe('Carta alta');
});
