import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar, LeagueAvatar } from '../../components/Avatar';

/** Dibujo del avatar generado, sin los ids de máscara que `useId` cambia en cada render. */
function generatedShape(props: { userId?: number | string | null; name?: string }) {
  const { getByTestId, unmount } = render(<UserAvatar url={null} {...props} />);
  const html = getByTestId('avatar-generated').innerHTML.replace(/(id|mask)="[^"]*"/g, '');
  unmount();
  return html;
}

describe('Avatar', () => {
  it('genera un avatar cuando el usuario no tiene foto, sin pedir ninguna imagen', () => {
    const { container } = render(<UserAvatar url={null} userId={7} name="raclos" />);
    expect(screen.getByTestId('avatar-generated')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('muestra la foto cuando existe y vuelve al avatar generado si falla la carga', () => {
    const { container } = render(<UserAvatar url="/api/users/1/avatar?v=1" userId={1} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/users/1/avatar?v=1');
    expect(screen.queryByTestId('avatar-generated')).toBeNull();
    fireEvent.error(img!);
    expect(screen.getByTestId('avatar-generated')).toBeInTheDocument();
  });

  it('el avatar generado depende del id (no del nombre) y cambia entre usuarios', () => {
    expect(generatedShape({ userId: 7, name: 'raclos' })).toBe(
      generatedShape({ userId: '7', name: 'otro nombre' }),
    );
    expect(generatedShape({ userId: 7 })).not.toBe(generatedShape({ userId: 8 }));
    expect(generatedShape({ name: 'Ana' })).toBe(generatedShape({ userId: '', name: 'Ana' }));
  });

  it('la imagen de liga cae al emoji de la competición', () => {
    render(<LeagueAvatar url={null} badge="🌍" />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
  });
});
