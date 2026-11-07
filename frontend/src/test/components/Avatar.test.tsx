import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar, LeagueAvatar } from '../../components/Avatar';

describe('Avatar', () => {
  it('muestra la inicial del nombre cuando el usuario no tiene foto, sin pedir ninguna imagen', () => {
    const { container } = render(<UserAvatar url={null} name="raclos" />);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('R');
    expect(screen.queryByTestId('avatar-image')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('muestra la foto cuando existe y vuelve a la inicial si falla la carga', () => {
    const { container } = render(<UserAvatar url="/api/users/1/avatar?v=1" name="Ana" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/users/1/avatar?v=1');
    expect(screen.queryByTestId('avatar-generated')).toBeNull();
    fireEvent.error(img!);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('A');
  });

  it('respeta tildes y emojis y usa ? sin nombre', () => {
    const { rerender } = render(<UserAvatar url={null} name="  ángel" />);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('Á');
    rerender(<UserAvatar url={null} name="🦊 zorro" />);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('🦊');
    rerender(<UserAvatar url={null} name="" />);
    expect(screen.getByTestId('avatar-generated')).toHaveTextContent('?');
  });

  it('la imagen de liga cae al emoji de la competición', () => {
    render(<LeagueAvatar url={null} badge="🌍" />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
  });
});
