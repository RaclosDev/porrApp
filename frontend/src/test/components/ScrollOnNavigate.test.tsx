import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScrollOnNavigate, { SMOOTH_SCROLL_STATE } from '../../components/ScrollOnNavigate';

/** jsdom no hace scroll: `scrollTo` se limita a mover `scrollY` y avisar como el navegador. */
const scrollTo = vi.fn((options: ScrollToOptions) => {
  window.scrollY = options.top ?? 0;
  window.dispatchEvent(new Event('scroll'));
});

function userScrollsTo(top: number) {
  window.scrollY = top;
  fireEvent.scroll(window);
}

function Controls() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/ranking')}>ranking</button>
      <button onClick={() => navigate('/porra-nba', { state: SMOOTH_SCROLL_STATE })}>pie</button>
      <button onClick={() => navigate('/ranking?jornada=3')}>jornada</button>
      <button onClick={() => navigate('/faq#premios')}>ancla</button>
      <button onClick={() => navigate(-1)}>atrás</button>
      <section id="premios" />
    </>
  );
}

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ScrollOnNavigate />
      <Controls />
    </MemoryRouter>,
  );

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Scroll al navegar', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollTo);
    window.scrollY = 0;
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scrollTo.mockClear();
    scrollIntoView.mockClear();
  });

  it('la página nueva empieza arriba, sin animación', () => {
    renderAt('/');
    userScrollsTo(600);
    click('ranking');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' });
    expect(window.scrollY).toBe(0);
  });

  it('un enlace que lo pide sube a la página nueva con suavidad', () => {
    renderAt('/porra-ufc');
    userScrollsTo(2400);
    click('pie');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'smooth' });
  });

  it('con movimiento reducido, ese enlace también salta sin animación', () => {
    vi.mocked(window.matchMedia).mockImplementationOnce(
      (query: string) => ({ matches: query.includes('reduce'), media: query }) as MediaQueryList,
    );
    renderAt('/porra-ufc');
    userScrollsTo(2400);
    click('pie');
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' });
  });

  it('cambiar solo la query no mueve la página', () => {
    renderAt('/ranking');
    userScrollsTo(400);
    click('jornada');
    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.scrollY).toBe(400);
  });

  it('un #ancla lleva a su elemento en vez de arriba', () => {
    renderAt('/');
    userScrollsTo(300);
    click('ancla');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('premios'));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('atrás vuelve a donde estaba la página anterior', () => {
    renderAt('/');
    userScrollsTo(750);
    click('ranking');
    userScrollsTo(120);
    act(() => click('atrás'));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 750, left: 0, behavior: 'instant' });
    expect(window.scrollY).toBe(750);
  });

  it('el navegador no restaura por su cuenta mientras está montado', () => {
    // jsdom no implementa la restauración del navegador.
    window.history.scrollRestoration = 'auto';
    const { unmount } = renderAt('/');
    expect(window.history.scrollRestoration).toBe('manual');
    unmount();
    expect(window.history.scrollRestoration).toBe('auto');
  });
});
