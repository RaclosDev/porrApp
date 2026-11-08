import { useEffect, useState } from 'react';
import { loadAppleSdk } from '../utils/appleSignIn';

interface AppleSignInButtonProps {
  onClick: () => Promise<unknown> | void;
  shape?: 'pill' | 'rectangular';
}

/**
 * Botón de Apple con su estilo (fondo negro, logo y texto en blanco), al lado del de Google y con
 * su mismo texto corto. Se nombra «Iniciar sesión con Apple» para los lectores de pantalla. El SDK se descarga al pintarse para que el clic abra la ventana sin esperas: si se
 * cargara al pulsar, el navegador bloquearía la ventana emergente.
 */
export default function AppleSignInButton({ onClick, shape = 'pill' }: AppleSignInButtonProps) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadAppleSdk().catch(() => {
      // Si no carga ahora, se reintenta al pulsar.
    });
  }, []);

  const handleClick = async () => {
    setBusy(true);
    try {
      await onClick();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      aria-label="Iniciar sesión con Apple"
      className={`flex w-full h-10 min-w-0 items-center justify-center gap-1.5 bg-black px-3 text-[0.875rem] font-medium text-white border-0 cursor-pointer disabled:opacity-70 ${
        shape === 'pill' ? 'rounded-full' : 'rounded-[4px]'
      }`}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M16.37 1.43c0 1.14-.5 2.27-1.18 3.08-.74.9-1.99 1.57-2.99 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.57-2.27 1.21-2.98.8-.94 2.14-1.64 3.25-1.68.03.13.05.28.05.43zm4.56 15.71c-.03.07-.46 1.58-1.52 3.12-.94 1.34-1.94 2.71-3.43 2.71-1.52 0-1.9-.88-3.63-.88-1.7 0-2.3.91-3.67.91-1.38 0-2.33-1.26-3.43-2.8-1.29-1.82-2.32-4.63-2.32-7.28 0-4.28 2.8-6.55 5.55-6.55 1.45 0 2.68.95 3.6.95.87 0 2.22-1.01 3.9-1.01.61 0 2.89.06 4.37 2.19-.13.09-2.38 1.37-2.38 4.19 0 3.26 2.85 4.42 2.96 4.45z" />
      </svg>
      <span className="truncate">Iniciar sesión</span>
    </button>
  );
}
