import { useState, useRef, useEffect, useId, type KeyboardEvent } from 'react';
import Flag from './Flag';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  /** Valor seleccionado (nombre del equipo). */
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Texto si no hay valor seleccionado. */
  placeholder?: string;
  /** Nombre accesible del control, p. ej. "Grupo A, 1º clasificado". */
  label?: string;
  /** Id de un elemento visible que nombra el control (alternativa a `label`). */
  'aria-labelledby'?: string;
}

const sameValue = (a: string, b: string) =>
  a === b || (!!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase());

/**
 * Select personalizado para elegir equipos: muestra banderas junto a las opciones
 * y mantiene el estilo visual 'glass'. Sigue el patrón combobox + listbox de ARIA:
 * el foco se queda en el combobox y ↑/↓ mueven la opción activa.
 */
export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder,
  label,
  'aria-labelledby': labelledBy,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const optionId = (idx: number) => `${listboxId}-opt-${idx}`;

  /**
   * Cierra el desplegable si el usuario hace click fuera del componente.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /** Mantiene visible la opción activa al moverse con el teclado. */
  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    document
      .getElementById(`${listboxId}-opt-${activeIndex}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [isOpen, activeIndex, listboxId]);

  const selectedIndex = options.findIndex((o) => sameValue(o.value, value));
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const open = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const choose = (idx: number) => {
    const opt = options[idx];
    if (opt) onChange(opt.value);
    setIsOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) open();
        else setActiveIndex((i) => Math.min(i + 1, last));
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) open();
        else setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (isOpen) {
          e.preventDefault();
          setActiveIndex(last);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && activeIndex >= 0) choose(activeIndex);
        else open();
        break;
      case 'Escape':
        if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(false);
        }
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div className={`relative flex-1 ${isOpen ? 'z-[1000]' : 'z-[1]'}`} ref={dropdownRef}>
      <div
        className="glass-input py-1.5 px-2 text-[0.85rem] cursor-pointer flex justify-between items-center min-h-11"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        tabIndex={0}
        aria-label={labelledBy ? undefined : label || placeholder || 'Seleccionar'}
        aria-labelledby={labelledBy}
        onKeyDown={handleKeyDown}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
      >
        <div className="flex items-center justify-center gap-2 flex-1">
          {selectedOption ? (
            <>
              {selectedOption.value !== '' && (
                <Flag
                  team={selectedOption.value}
                  size="w80"
                  style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }}
                />
              )}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </div>
        <span className="text-[0.7rem] text-muted" aria-hidden="true">
          ▼
        </span>
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={labelledBy ? undefined : label || placeholder}
          aria-labelledby={labelledBy}
          className="absolute top-full left-0 right-0 bg-panel bg-none border border-line rounded-[8px] mt-1 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-[100] overflow-hidden"
        >
          {options.map((opt, idx) => (
            <div
              className={`min-h-11 py-2 px-2.5 text-[0.85rem] cursor-pointer flex items-center justify-center gap-2 ${idx === activeIndex || idx === selectedIndex ? 'bg-[color-mix(in_srgb,var(--accent-cyan)_12%,transparent)] bg-none' : 'bg-transparent bg-none'} ${idx === activeIndex ? 'outline outline-1 -outline-offset-1 outline-cyan' : ''} ${idx < options.length - 1 ? 'border-b border-b-line' : 'border-b-0'}`}
              key={idx}
              id={optionId(idx)}
              role="option"
              aria-selected={idx === selectedIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              // Evita que el combobox pierda el foco al pulsar una opción.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(idx)}
            >
              {opt.value !== '' && (
                <Flag
                  team={opt.value}
                  size="w80"
                  style={{ width: 16, height: 12, objectFit: 'cover', borderRadius: 2 }}
                />
              )}
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
