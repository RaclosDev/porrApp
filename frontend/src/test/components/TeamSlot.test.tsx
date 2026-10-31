import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TeamSlot } from '../../components/BracketCanvas';

describe('TeamSlot component flag rendering', () => {
  it('renders flag image for a single country', () => {
    render(<TeamSlot name="España" />);
    const flagImg = screen.getByRole('img');
    expect(flagImg).toBeInTheDocument();
    expect(flagImg).toHaveAttribute('src', '/flags/es.svg');
    expect(screen.getByText('España')).toBeInTheDocument();
  });

  it('renders both flags for combined classified teams (e.g. España / Alemania)', () => {
    render(<TeamSlot name="España / Alemania" />);
    const flagImgs = screen.getAllByRole('img');
    expect(flagImgs).toHaveLength(2);
    expect(flagImgs[0]).toHaveAttribute('src', '/flags/es.svg');
    expect(flagImgs[1]).toHaveAttribute('src', '/flags/de.svg');
    expect(screen.getByText('España / Alemania')).toBeInTheDocument();
  });

  it('does not render flags for placeholders like 1º Grupo A', () => {
    render(<TeamSlot name="1º Grupo A" />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('1º Grupo A')).toBeInTheDocument();
  });
});

describe('TeamSlot interaction', () => {
  it('renders a pressable button when it can be picked', () => {
    render(<TeamSlot name="España" onClick={() => {}} pressed />);
    const btn = screen.getByRole('button', { name: 'Pasar a España' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('stays a plain element for placeholders and read-only slots', () => {
    render(
      <>
        <TeamSlot name="1º Grupo A" onClick={() => {}} />
        <TeamSlot name="Italia" />
      </>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
