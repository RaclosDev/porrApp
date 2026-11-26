import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Crupier } from '../../../components/poker/crupier/Crupier';

const shown = (root: Element, name: string) =>
  (root.querySelector(`.${name}`) as SVGElement).style.display !== 'none';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Crupier', () => {
  it('pinta el dibujo como decoración y anima con requestAnimationFrame', () => {
    const raf = vi.fn(() => 1);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const { container, unmount } = render(<Crupier className="extra" />);
    const box = container.firstElementChild!;
    expect(box).toHaveAttribute('aria-hidden', 'true');
    expect(box).toHaveClass('crupier', 'extra');
    expect(box.querySelectorAll('svg')).toHaveLength(2);
    expect(raf).toHaveBeenCalled();
    unmount();
    expect(cancel).toHaveBeenCalledWith(1);
  });

  it('sin escena deja solo al crupier y su mesa, para fundirse con el fondo de la tarjeta', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    const { container } = render(<Crupier bare />);
    expect(container.firstElementChild).toHaveClass('crupier', 'crupier-bare');
  });

  it('hace la acción de cada aviso nuevo, una sola vez', () => {
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1),
    );
    const now = vi.spyOn(performance, 'now').mockReturnValue(0);
    const { container, rerender } = render(
      <Crupier auto={false} cue={{ id: 1, action: 'gracias' }} />,
    );
    expect(shown(container, 'p-sign')).toBe(true);
    // El mismo aviso en otro render no la repite: al pasar su duración, el cartel se guarda.
    now.mockReturnValue(4000);
    rerender(<Crupier auto={false} asleep cue={{ id: 1, action: 'gracias' }} />);
    expect(shown(container, 'p-sign')).toBe(false);
    rerender(<Crupier auto cue={{ id: 2, action: 'campana', audioDelay: 0.8 }} />);
    expect(shown(container, 'p-bell')).toBe(true);
  });

  it('con movimiento reducido se queda quieto y dormido en el descanso', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const raf = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    const { container } = render(<Crupier asleep />);
    expect(raf).not.toHaveBeenCalled();
    expect(shown(container, 'p-zzz')).toBe(true);
  });
});
