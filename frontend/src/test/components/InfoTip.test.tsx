import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import InfoTip from '../../components/InfoTip';

it('abre la explicación al pulsar la «i» y la cierra con Escape o pulsando fuera', () => {
  render(<InfoTip label="Cómo se reparten los puntos">5, 3 y 1</InfoTip>);
  const button = screen.getByRole('button', { name: 'Cómo se reparten los puntos' });
  expect(screen.queryByRole('note')).toBeNull();
  fireEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('note')).toHaveTextContent('5, 3 y 1');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('note')).toBeNull();
  fireEvent.click(button);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('note')).toBeNull();
});
