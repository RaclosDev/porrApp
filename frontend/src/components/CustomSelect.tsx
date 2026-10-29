import { useState, useRef, useEffect } from 'react';
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
}

/**
 * Select personalizado para elegir equipos: muestra banderas junto a las opciones
 * y mantiene el estilo visual 'glass'.
 */
export default function CustomSelect({ value, options, onChange, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const selectedOption = options.find(
    (o) =>
      o.value === value ||
      (value && o.value && o.value.trim().toLowerCase() === value.trim().toLowerCase()),
  );

  return (
    <div className={`relative flex-1 ${isOpen ? 'z-[1000]' : 'z-[1]'}`} ref={dropdownRef}>
      <div
        className="glass-input py-1.5 px-2 text-[0.85rem] cursor-pointer flex justify-between items-center min-h-11"
        role="combobox"
        aria-expanded={isOpen}
        tabIndex={0}
        aria-label={placeholder || 'Seleccionar'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        onClick={() => setIsOpen(!isOpen)}
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
        <span className="text-[0.7rem] text-muted">▼</span>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-[#0f172a] border border-[rgba(255,255,255,0.2)] rounded-[8px] mt-1 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-[100] overflow-hidden">
          {options.map((opt, idx) => (
            <div
              className={`py-2 px-2.5 text-[0.85rem] cursor-pointer flex items-center justify-center gap-2 ${value === opt.value ? 'bg-[rgba(255,255,255,0.1)]' : 'bg-transparent'} ${idx < options.length - 1 ? 'border-b border-b-[rgba(255,255,255,0.05)]' : 'border-b-0'}`}
              key={idx}
              role="option"
              tabIndex={0}
              aria-selected={value === opt.value}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
              onMouseLeave={(e) => {
                if (value !== opt.value) e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
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
