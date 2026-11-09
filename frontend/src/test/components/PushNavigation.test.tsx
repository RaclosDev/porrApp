import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PushNavigation, { PUSH_NAVIGATE } from '../../components/PushNavigation';

const container = new EventTarget();

function CurrentPath() {
  const { pathname, search } = useLocation();
  return <p data-testid="path">{pathname + search}</p>;
}

const post = (data: unknown) =>
  act(() => {
    container.dispatchEvent(new MessageEvent('message', { data }));
  });

describe('PushNavigation', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
    render(
      <MemoryRouter initialEntries={['/jornadas']}>
        <PushNavigation />
        <CurrentPath />
      </MemoryRouter>,
    );
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('abre la pantalla del aviso pulsado con la app ya abierta', () => {
    post({ type: PUSH_NAVIGATE, url: '/ranking?group=6&jornada=Jornada%2012' });
    expect(screen.getByTestId('path')).toHaveTextContent('/ranking?group=6&jornada=Jornada%2012');
  });

  it('ignora otros mensajes y rutas fuera de la app', () => {
    post({ type: 'otro', url: '/ranking' });
    post({ type: PUSH_NAVIGATE, url: '//evil.example/ranking' });
    post({ type: PUSH_NAVIGATE, url: 'https://evil.example' });
    expect(screen.getByTestId('path')).toHaveTextContent('/jornadas');
  });
});
