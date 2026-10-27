import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Flag from '../../components/Flag';

describe('Flag component', () => {
  it('renders flag image for a valid team name', () => {
    render(<Flag team="España" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/flags/es.svg');
    expect(img).toHaveAttribute('alt', 'España');
  });

  it('renders flag image when country code is passed directly', () => {
    render(<Flag team="es" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/flags/es.svg');
  });

  it('handles corrupted team names like Espa??a correctly', () => {
    render(<Flag team="Espa??a" />);
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/flags/es.svg');
  });

  it('falls back to flagcdn if local SVG fails, then to emoji', () => {
    render(<Flag team="España" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/flags/es.svg');

    // First error triggers flagcdn fallback
    fireEvent.error(img);
    expect(img).toHaveAttribute('src', expect.stringContaining('flagcdn.com/w40/es.png'));

    // Second error triggers emoji fallback
    fireEvent.error(img);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('🇪🇸')).toBeInTheDocument();
  });

  it('does not render for placeholders or invalid teams', () => {
    const { container: c1 } = render(<Flag team="1º Grupo A" />);
    expect(c1).toBeEmptyDOMElement();

    const { container: c2 } = render(<Flag team="Por definir" />);
    expect(c2).toBeEmptyDOMElement();

    const { container: c3 } = render(<Flag team="" />);
    expect(c3).toBeEmptyDOMElement();
  });

  it('renders crest image when logo prop is provided', () => {
    render(<Flag team="Real Madrid" logo="https://example.com/crest.png" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/crest.png');
    expect(img).toHaveAttribute('alt', 'Real Madrid');
  });

  it('falls back to flag when logo image errors out', () => {
    render(<Flag team="España" logo="https://example.com/broken-crest.png" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/broken-crest.png');
    fireEvent.error(img);
    // After logo error, falls back to country flag
    expect(screen.getByRole('img')).toHaveAttribute('src', '/flags/es.svg');
  });
});
