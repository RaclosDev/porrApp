import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';

interface Props {
  /** Qué explica, para lectores de pantalla: «Cómo se reparten los puntos». */
  label: string;
  children: ReactNode;
}

/**
 * Explicación que solo hace falta la primera vez: una «i» que se abre al pulsarla (también en el
 * móvil, donde no hay hover) y se cierra al pulsar fuera o con Escape.
 */
export default function InfoTip({ label, children }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        if (event instanceof KeyboardEvent) event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close, true);
    };
  }, [open]);

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
          setOpen((value) =>
            (event.nativeEvent as PointerEvent).pointerType === 'mouse' ? true : !value,
          )
        }
      >
        <Info size={15} aria-hidden="true" />
      </button>
      {open && (
        <span id={id} role="note" className="info-tip-bubble">
          {children}
        </span>
      )}
    </span>
  );
}
