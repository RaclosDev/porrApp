import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar, LeagueAvatar, avatarLetters, avatarInk } from '../../components/Avatar';

describe('Avatar', () => {
  it('muestra las letras del nombre cuando el usuario no tiene foto, sin pedir ninguna imagen', () => {
    const { container } = render(<UserAvatar url={null} userId={7} name="raclos" />);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('Ra');
    expect(screen.queryByTestId('avatar-image')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('muestra la foto cuando existe y vuelve a las letras si falla la carga', () => {
    const { container } = render(
      <UserAvatar url="/api/users/1/avatar?v=1" userId={1} name="Ana" />,
    );
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/users/1/avatar?v=1');
    expect(screen.queryByTestId('avatar-generated')).toBeNull();
    fireEvent.error(img!);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('An');
  });

  it('distingue nombres con la misma inicial', () => {
    expect(avatarLetters('Jaime')).toBe('Ja');
    expect(avatarLetters('Jokin')).toBe('Jo');
    expect(avatarLetters('Giorgi - Winamax')).toBe('GW');
    expect(avatarLetters('  ángel  martín ')).toBe('ÁM');
    expect(avatarLetters('🦊 zorro')).toBe('🦊');
    expect(avatarLetters('J')).toBe('J');
    expect(avatarLetters('')).toBe('?');
    expect(avatarLetters(null)).toBe('?');
  });

  it('la tinta depende del id (no del nombre) y es estable', () => {
    expect(avatarInk(7, 'raclos')).toBe(avatarInk('7', 'otro nombre'));
    expect(avatarInk(null, 'Ana')).toBe(avatarInk('', 'Ana'));
    const inks = new Set(Array.from({ length: 20 }, (_, i) => avatarInk(i)));
    expect(inks.size).toBeGreaterThan(1);
    for (const ink of inks) expect(ink).toBeGreaterThanOrEqual(0);
    render(<UserAvatar url={null} userId={7} name="raclos" />);
    expect(screen.getByTestId('avatar-generated')).toHaveAttribute(
      'data-ink',
      String(avatarInk(7)),
    );
  });

  it('la imagen de liga cae al emoji de la competición', () => {
    render(<LeagueAvatar url={null} badge="🌍" />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
  });
});
