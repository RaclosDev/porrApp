import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RoundParticipants from '../../components/voters/RoundParticipants';

const people = [
  { userId: 1, name: 'Ana', avatarUrl: 'https://example.com/ana.jpg' },
  { userId: 2, name: 'Bea', avatarUrl: null },
];

describe('foto en grande desde la lista de personas', () => {
  it('abre la foto al pulsarla y Escape solo cierra la foto, no la hoja', () => {
    render(<RoundParticipants participants={people} roundLabel="Jornada 13" />);
    fireEvent.click(screen.getByRole('button', { name: /ya han hecho su predicción/ }));

    // Sin foto no hay nada que ampliar.
    expect(screen.queryByRole('button', { name: 'Ver la foto de Bea' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto de Ana' }));
    expect(screen.getByRole('dialog', { name: 'Foto de Ana' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto de Ana' })).toHaveAttribute(
      'src',
      'https://example.com/ana.jpg',
    );

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Foto de Ana' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Ya han hecho su predicción' })).toBeInTheDocument();
  });

  it('se cierra con la X sin cerrar la hoja', () => {
    render(<RoundParticipants participants={people} />);
    fireEvent.click(screen.getByRole('button', { name: /ya han hecho su predicción/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver la foto de Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar foto' }));
    expect(screen.queryByRole('dialog', { name: 'Foto de Ana' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Ya han hecho su predicción' })).toBeInTheDocument();
  });
});
