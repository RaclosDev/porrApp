import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../../utils/theme';

/** Cambia entre el tema oscuro y el claro. El icono enseña el tema al que se va. */
export default function ThemeToggle() {
  const [theme, setCurrent] = useState<Theme>(getTheme);
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        setCurrent(next);
      }}
      title={label}
      aria-label={label}
      className="glass-btn header-icon-btn header-theme-btn"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {next === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        )}
      </svg>
    </button>
  );
}
