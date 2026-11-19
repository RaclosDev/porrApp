import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent } from 'react';

export type SelectMenuItem =
  | { value: string; label: string; disabled?: boolean }
  /** Separador; con `label`, encabeza el grupo que sigue (lo que era un `<optgroup>`). */
  | { separator: true; label?: string };

interface SelectMenuProps {
  value: string;
  items: SelectMenuItem[];
  onChange: (value: string) => void;
  /** Nombre del control: el botón se anuncia como «Etiqueta: opción elegida». */
  label: string;
  /** Texto del botón cuando el valor no coincide con ninguna opción. */
  placeholder?: string;
  /** Clases del botón: cada sitio conserva el aspecto que tenía su desplegable. */
  className?: string;
  style?: CSSProperties;
  id?: string;
  disabled?: boolean;
  /** Como en un `<select required>`: el formulario no se envía con el valor vacío. */
  required?: boolean;
  'aria-describedby'?: string;
}

const isOption = (item: SelectMenuItem): item is Extract<SelectMenuItem, { value: string }> =>
  !('separator' in item);

/**
 * Desplegable con el aspecto de la app (el `<select>` nativo no se deja maquetar): un botón con la
 * opción elegida y un menú en hoja de papel, como el de «Mis ligas». Popover nativo: Escape y clic
 * fuera lo cierran; ↑/↓, Inicio y Fin recorren las opciones.
 */
export default function SelectMenu({
  value,
  items,
  onChange,
  label,
  placeholder = 'Seleccionar',
  className = '',
  style,
  id,
  disabled,
  required,
  'aria-describedby': describedBy,
}: SelectMenuProps) {
  const menuId = useId();
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const current = items.filter(isOption).find((item) => item.value === value);
  const shown = current?.label ?? placeholder;

  const place = () => {
    const b = btn.current?.getBoundingClientRect();
    const p = pop.current;
    if (!b || !p) return;
    const gap = 6;
    const margin = 8;
    p.style.minWidth = `${Math.min(Math.max(180, b.width), window.innerWidth - margin * 2)}px`;
    p.style.left = `${Math.min(Math.max(margin, b.left), window.innerWidth - p.offsetWidth - margin)}px`;
    const below = window.innerHeight - b.bottom - gap - margin;
    const above = b.top - gap - margin;
    // Abre hacia arriba solo si abajo no cabe y arriba hay más sitio (el botón al pie de la pantalla).
    const up = p.scrollHeight > below && above > below;
    p.style.maxHeight = `${Math.max(120, up ? above : below)}px`;
    p.style.top = up
      ? `${Math.max(margin, b.top - gap - p.offsetHeight)}px`
      : `${b.bottom + gap}px`;
  };

  // Abierto, el menú sigue al botón si la página se desplaza o cambia de tamaño.
  useEffect(() => {
    const p = pop.current;
    if (!p) return;
    const follow = () => {
      if (p.matches(':popover-open')) place();
    };
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => {
      window.removeEventListener('scroll', follow, true);
      window.removeEventListener('resize', follow);
    };
  }, []);

  const options = () => [
    ...(pop.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]:not(:disabled)') ??
      []),
  ];

  const pick = (next: string) => {
    pop.current?.hidePopover?.();
    btn.current?.focus();
    if (next !== value) onChange(next);
  };

  const onKey = (e: KeyboardEvent) => {
    const all = options();
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === 'ArrowDown'
        ? i + 1
        : e.key === 'ArrowUp'
          ? i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? all.length - 1
              : null;
    if (to === null || !all.length) return;
    e.preventDefault();
    all[(to + all.length) % all.length]?.focus();
  };

  return (
    <>
      <button
        ref={btn}
        id={triggerId}
        type="button"
        className={`select-menu-trigger ${className}`}
        style={style}
        popoverTarget={menuId}
        aria-haspopup="menu"
        aria-expanded="false"
        data-value={value}
        aria-label={`${label}: ${shown}`}
        aria-describedby={describedBy}
        disabled={disabled}
        onKeyDown={(e) => {
          // Como en un `<select>`: ↑/↓ con el menú cerrado lo abren.
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            pop.current?.showPopover?.();
          }
        }}
      >
        <span className={`select-menu-value${current ? '' : ' is-placeholder'}`}>{shown}</span>
        <svg className="select-menu-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {required && (
        // El navegador valida el formulario sobre este campo oculto; el aviso se lleva al botón.
        <input
          className="select-menu-validity"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          onInvalid={() => btn.current?.focus()}
        />
      )}
      <div
        ref={pop}
        id={menuId}
        popover="auto"
        role="menu"
        tabIndex={-1}
        aria-labelledby={triggerId}
        className="select-menu paper-panel"
        onKeyDown={onKey}
        onClick={(e) => {
          // Dentro de un <label>, un clic en el hueco del menú (no en una opción) activaría el botón
          // y lo cerraría.
          if (!(e.target as Element).closest('[role="menuitemradio"]')) e.preventDefault();
        }}
        onToggle={(e) => {
          const open = (e as unknown as ToggleEvent).newState === 'open';
          btn.current?.setAttribute('aria-expanded', String(open));
          if (!open) return;
          place();
          const all = options();
          const start = all.find((el) => el.getAttribute('aria-checked') === 'true') ?? all[0];
          if (!start || !pop.current) return;
          // La elegida, centrada en el menú: con muchas opciones se ven las de antes y las de después.
          start.focus({ preventScroll: true });
          pop.current.scrollTop =
            start.offsetTop - (pop.current.clientHeight - start.offsetHeight) / 2;
        }}
      >
        {items.map((item, index) =>
          isOption(item) ? (
            <button
              key={`o-${index}`}
              type="button"
              role="menuitemradio"
              aria-checked={item.value === value}
              data-value={item.value}
              disabled={item.disabled}
              className="select-menu-item"
              onClick={() => pick(item.value)}
            >
              <span className="select-menu-check" aria-hidden="true">
                {item.value === value ? '✓' : ''}
              </span>
              <span className="select-menu-label">{item.label}</span>
            </button>
          ) : (
            <div
              key={`s-${index}`}
              role="separator"
              aria-label={item.label}
              className="select-menu-sep"
            >
              {item.label && (
                <span className="select-menu-heading" aria-hidden="true">
                  {item.label}
                </span>
              )}
            </div>
          ),
        )}
      </div>
    </>
  );
}
