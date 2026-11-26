import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import PokerDatePicker from '../../components/poker/PokerDatePicker';

const today = new Date(2026, 10, 26);

it('abre el mes, no deja volver antes de hoy y elige un día del mes siguiente', () => {
  const onChange = vi.fn();
  render(<PokerDatePicker label="Fecha" value="2026-11-28" onChange={onChange} today={today} />);
  const trigger = screen.getByRole('button', { name: 'Fecha: sábado, 28 de noviembre' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('noviembre de 2026')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Mes anterior' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'miércoles, 25 de noviembre' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'sábado, 28 de noviembre' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  fireEvent.click(screen.getByRole('button', { name: 'Mes siguiente' }));
  expect(screen.getByText('diciembre de 2026')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'jueves, 3 de diciembre' }));
  expect(onChange).toHaveBeenCalledWith('2026-12-03');
  expect(screen.queryByRole('group', { name: 'Elegir fecha' })).not.toBeInTheDocument();
});

it('cierra el mes con Escape', () => {
  render(<PokerDatePicker label="Fecha" value="2026-11-28" onChange={vi.fn()} today={today} />);
  fireEvent.click(screen.getByRole('button', { name: /^Fecha: / }));
  expect(screen.getByRole('group', { name: 'Elegir fecha' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('group', { name: 'Elegir fecha' })).not.toBeInTheDocument();
});
