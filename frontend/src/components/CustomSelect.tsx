import { useState, useRef, useEffect } from 'react';
import { getCountryCode } from '../utils/constants';

/**
 * Componente Select (Dropdown) personalizado para seleccionar equipos.
 * Permite mostrar banderas junto a las opciones y mantener un estilo visual 'glass'.
 *
 * @component
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.value - Valor actualmente seleccionado (nombre del equipo).
 * @param {Array<{value: string, label: string}>} props.options - Opciones disponibles.
 * @param {Function} props.onChange - Callback que se ejecuta cuando el usuario selecciona una opción.
 * @param {string} props.placeholder - Texto que se muestra si no hay valor seleccionado.
 * @returns {JSX.Element} Dropdown interactivo.
 */
export default function CustomSelect({ value, options, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  /**
   * Cierra el desplegable si el usuario hace click fuera del componente.
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flex: 1, zIndex: isOpen ? 1000 : 1 }}>
      <div
        className="glass-input"
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
        style={{
          padding: '6px 8px',
          fontSize: '0.85rem',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '44px',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flex: 1,
          }}
        >
          {selectedOption ? (
            <>
              {selectedOption.value !== '' && (
                <img
                  src={`https://flagcdn.com/w80/${getCountryCode(selectedOption.value)}.png`}
                  alt=""
                  style={{ width: '16px', height: '12px', objectFit: 'cover', borderRadius: '2px' }}
                />
              )}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {options.map((opt, idx) => (
            <div
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
              style={{
                padding: '8px 10px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: value === opt.value ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderBottom:
                  idx < options.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
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
                <img
                  src={`https://flagcdn.com/w80/${getCountryCode(opt.value)}.png`}
                  alt=""
                  style={{ width: '16px', height: '12px', objectFit: 'cover', borderRadius: '2px' }}
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
