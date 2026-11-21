import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PredictionDemo from '../../components/landing/PredictionDemo';

const pick = (match: string, sign: string) =>
  fireEvent.click(screen.getByRole('button', { name: `Predecir ${sign} en ${match}` }));

describe('PredictionDemo', () => {
  it('pide todos los partidos antes de jugar la jornada, como la pantalla de jornadas', () => {
    render(<PredictionDemo />);
    expect(screen.getByText('0/3 predicciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Te faltan 3 partidos' })).toBeDisabled();

    pick('España - Alemania', '1');
    expect(screen.getByText('1/3 predicciones')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Predecir 1 en España - Alemania' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Volver a pulsar el signo lo quita.
    pick('España - Alemania', '1');
    expect(screen.getByRole('button', { name: 'Te faltan 3 partidos' })).toBeDisabled();
  });

  it('cierra los partidos con su resultado, sus puntos y el podio', () => {
    render(<PredictionDemo />);
    pick('España - Alemania', '1');
    pick('Argentina - Francia', 'X');
    pick('Brasil - Portugal', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Jugar la jornada' }));

    expect(screen.getByText('Final 2 - 1')).toBeInTheDocument();
    expect(screen.getAllByText(/Acierto de signo 1X2/)).toHaveLength(2);
    expect(screen.getByText(/Sin acierto en signo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Predecir 1 en España - Alemania/ })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Podio de la jornada de ejemplo' })).toHaveTextContent(
      'Tú',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Jugar otra vez' }));
    expect(screen.getByRole('button', { name: 'Te faltan 3 partidos' })).toBeDisabled();
  });
});
