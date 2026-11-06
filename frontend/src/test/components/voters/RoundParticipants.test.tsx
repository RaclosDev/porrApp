import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import RoundParticipants from '../../../components/voters/RoundParticipants';
import type { MatchVoter } from '../../../types/api';

const member = (userId: number, name = `Miembro ${userId}`): MatchVoter => ({
  userId,
  name,
  avatarUrl: null,
});

describe('RoundParticipants', () => {
  it('no pinta nada si nadie ha hecho su predicción', () => {
    const { container } = render(<RoundParticipants participants={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('resume las caras en +N según el ancho y nombra a todos para el lector de pantalla', () => {
    render(
      <RoundParticipants
        participants={[
          member(1, 'Ana'),
          member(2, 'Bea'),
          member(3, 'Carla'),
          ...[4, 5, 6].map((id) => member(id)),
        ]}
      />,
    );

    const button = screen.getByRole('button', {
      name: '6 miembros ya han hecho su predicción: Ana, Bea, Carla, Miembro 4, Miembro 5 y Miembro 6. Ver la lista',
    });
    expect(button.querySelectorAll('.round-participants-avatar')).toHaveLength(4);
    expect(button.querySelectorAll('.round-participants-avatar.is-wide-only')).toHaveLength(2);
    expect(button.querySelector('.round-participants-more.is-compact-only')).toHaveTextContent(
      '+4',
    );
    expect(button.querySelector('.round-participants-more.is-wide-only')).toHaveTextContent('+2');
    expect(button.querySelector('[title="Ana"]')).not.toBeNull();
  });

  it('abre la lista con los nombres y la cierra con Escape', () => {
    render(
      <RoundParticipants participants={[member(1, 'Ana')]} roundLabel="Partidos Jornada 12" />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: '1 miembro ya ha hecho su predicción: Ana. Ver la lista',
      }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Ya han hecho su predicción' });
    expect(within(dialog).getByText('Partidos Jornada 12')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(within(dialog).getByText('Ana')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
