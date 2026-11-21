import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PredictionDemo from '../../components/landing/PredictionDemo';

const pick = (match: string, sign: string) =>
  fireEvent.click(
    within(screen.getByRole('group', { name: `Predicción ${match}` })).getByRole('button', {
      name: sign,
    }),
  );

describe('PredictionDemo', () => {
  it('pide todos los partidos antes de enseñar los resultados', () => {
    render(<PredictionDemo />);
    expect(screen.getByRole('button', { name: 'Te faltan 4 partidos' })).toBeDisabled();
    pick('Real Madrid contra Barcelona', 'X');
    expect(screen.getByRole('button', { name: 'Te faltan 3 partidos' })).toBeDisabled();
  });

  it('puntúa los signos acertados y deja al jugador líder si acierta todo', () => {
    render(<PredictionDemo />);
    pick('Real Madrid contra Barcelona', 'X');
    pick('Betis contra Sevilla', '1');
    pick('Athletic contra Real Sociedad', '2');
    pick('Valencia contra Villarreal', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Ver los resultados' }));

    const table = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('pts'));
    expect(table[0]).toHaveTextContent('Tú12 pts');
    expect(screen.getByRole('status')).toHaveTextContent('¡Líder de la jornada!');

    fireEvent.click(screen.getByRole('button', { name: 'Jugar otra vez' }));
    expect(screen.getByRole('button', { name: 'Te faltan 4 partidos' })).toBeDisabled();
  });
});
