import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UserAvatar, LeagueAvatar } from '../../components/Avatar';

describe('Avatar', () => {
  it('muestra la inicial cuando el usuario no tiene foto', () => {
    render(<UserAvatar url={null} name="raclos" />);
    expect(screen.getByText('R')).toBeInTheDocument();
    expect(screen.queryByTestId('avatar-image')).toBeNull();
  });

  it('muestra la foto cuando existe y vuelve a la inicial si falla la carga', () => {
    const { container } = render(<UserAvatar url="/api/users/1/avatar?v=1" name="raclos" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/users/1/avatar?v=1');
    fireEvent.error(img);
    expect(screen.getByText('R')).toBeInTheDocument();
  });

  it('la imagen de liga cae al emoji de la competición', () => {
    render(<LeagueAvatar url={null} badge="🌍" />);
    expect(screen.getByText('🌍')).toBeInTheDocument();
  });
});
