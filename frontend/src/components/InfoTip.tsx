import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface Props {
  /** Qué explica, para lectores de pantalla: «Cómo se reparten los puntos». */
  label: string;
  children: ReactNode;
  /**
   * La burbuja flota sobre la página en vez de colgar de la «i»: para las que van dentro de algo que
   * recorta lo que sobresale, como la cabecera de una tabla con scroll.
   */
  floating?: boolean;
}

/** Sitio de la burbuja flotante: bajo la «i», centrada y sin salirse de la pantalla. */
function place(bubble: HTMLElement, button: HTMLElement) {
  const rect = button.getBoundingClientRect();
  const width = bubble.offsetWidth;
  const center = rect.left + rect.width / 2;
  const left = Math.min(Math.max(center - width / 2, 8), window.innerWidth - width - 8);
  bubble.style.top = `${rect.bottom + 4}px`;
  bubble.style.left = `${Math.max(left, 8)}px`;
}

/**
 * Explicación que solo hace falta la primera vez: una «i» que se abre al pulsarla (también en el
 * móvil, donde no hay hover) y se cierra al pulsar fuera o con Escape.
 */
export default function InfoTip({ label, children, floating = false }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node) &&
            !bubbleRef.current?.contains(event.target as Node)
      ) {
        if (event instanceof KeyboardEvent) event.stopPropagation();
        setOpen(false);
      }
    };
    // La flotante no sigue a la «i» al desplazarse: se cierra.
    const hide = () => setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close, true);
    if (floating) window.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close, true);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, floating]);

  useLayoutEffect(() => {
    const button = ref.current?.querySelector('button');
    if (open && floating && bubbleRef.current && button) place(bubbleRef.current, button);
  }, [open, floating]);

  const bubble = open && (
    <span
      ref={bubbleRef}
      id={id}
      role="note"
      className={floating ? 'info-tip-bubble is-floating' : 'info-tip-bubble'}
    >
      {children}
    </span>
  );

  return (
    <span
      ref={ref}
      className="info-tip"
      // Con ratón se abre también al pasar por encima; en el móvil, al pulsar.
      onPointerEnter={(event) => event.pointerType === 'mouse' && setOpen(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setOpen(false)}
    >
      <button
        type="button"
        className="info-tip-btn"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) =>
          // El clic del ratón llega con la burbuja ya abierta por el hover: no la cierra.
          setOpen((event.nativeEvent as PointerEvent).pointerType === 'mouse' ? true : !open)
        }
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {floating && bubble ? createPortal(bubble, document.body) : bubble}
    </span>
  );
}
