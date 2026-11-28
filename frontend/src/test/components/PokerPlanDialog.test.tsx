import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PokerPlanDialog from '../../components/poker/PokerPlanDialog';
import { maxEntries } from '../../components/poker/pokerFormat';

it('enseña el plan de la liga, su tope de jugadores y cómo pedir otro', () => {
  const onClose = vi.fn();
  render(<PokerPlanDialog plan="FREE" leagueName="Sábados" onClose={onClose} />);
  const dialog = screen.getByRole('dialog', { name: 'Plan Gratis' });
  expect(within(dialog).getByText(/^Hasta 10 jugadores por torneo\. Las porras/)).toBeVisible();
  const current = within(dialog).getByText('Tu plan').closest('li');
  expect(current).toHaveAttribute('aria-current', 'true');
  expect(within(current as HTMLElement).getByText('Gratis')).toBeVisible();
  expect(within(dialog).getByText('4,99 €/mes')).toBeVisible();
  expect(within(dialog).getByText('Hasta 20 jugadores por torneo')).toBeVisible();
  expect(within(dialog).queryByText(/música/i)).toBeNull();
  expect(within(dialog).getByRole('link', { name: 'raclosdev@gmail.com' })).toHaveAttribute(
    'href',
    expect.stringContaining('mailto:raclosdev@gmail.com?subject='),
  );
  fireEvent.click(within(dialog).getByRole('button', { name: /cerrar/i }));
  expect(onClose).toHaveBeenCalled();
});

it('sin plan conocido toma el gratuito y el tope nunca pasa del máximo del servidor', () => {
  render(<PokerPlanDialog plan={undefined} leagueName="Sábados" onClose={vi.fn()} />);
  expect(screen.getByRole('dialog', { name: 'Plan Gratis' })).toBeVisible();
  expect(maxEntries({ maxEntries: 10 })).toBe(10);
  expect(maxEntries({ maxEntries: 500 })).toBe(100);
  expect(maxEntries({})).toBe(100);
});
