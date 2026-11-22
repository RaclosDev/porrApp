import { useLayoutEffect, useRef, useState } from 'react';
import type { CredentialResponse } from '@react-oauth/google';
import GoogleSignInButton from './GoogleSignInButton';
import AppleSignInButton from './AppleSignInButton';
import { appleSignInEnabled } from '../utils/appleSignIn';

const GAP = 8;
const GOOGLE_MAX_WIDTH = 400;

interface SocialSignInButtonsProps {
  onGoogleSuccess: (response: CredentialResponse) => void;
  onGoogleError: () => void;
  onApple: () => Promise<unknown> | void;
  shape?: 'pill' | 'rectangular';
}

/**
 * Google y Apple en una fila, cada uno con la mitad del ancho. Sin Apple configurado, Google
 * ocupa la fila. El botón de Google es un iframe de Google con ancho fijo en píxeles: se mide la
 * fila para dárselo.
 */
export default function SocialSignInButtons({
  onGoogleSuccess,
  onGoogleError,
  onApple,
  shape = 'pill',
}: SocialSignInButtonsProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const withApple = appleSignInEnabled();

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => setRowWidth(Math.floor(row.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, []);

  const googleWidth = Math.min(
    GOOGLE_MAX_WIDTH,
    withApple ? Math.floor((rowWidth - GAP) / 2) : rowWidth,
  );

  return (
    <div
      ref={rowRef}
      className={`grid w-full max-w-100 mx-auto items-center ${withApple ? 'grid-cols-2' : 'grid-cols-1'}`}
      style={{ gap: GAP }}
    >
      <div className="fam-google min-w-0">
        {/* En las páginas con estilo de portada (.fam) se ve nuestra cara, con borde negro y sombra, y
            el botón de Google va encima casi transparente recibiendo el clic. En la app oscura la cara
            sigue oculta y se ve el botón de Google tal cual. */}
        <span className="hidden fam-btn fam-btn--block fam-google__face" aria-hidden="true">
          <GoogleLogo />
          {withApple ? 'Google' : 'Continuar con Google'}
        </span>
        <div className="flex justify-center min-w-0 h-10 overflow-hidden fam-google__hit">
          <GoogleSignInButton
            onSuccess={onGoogleSuccess}
            onError={onGoogleError}
            theme="outline"
            size="large"
            shape={shape}
            // En media fila no cabe «Continuar con Google»: el logo ya dice de quién es cada botón.
            text={withApple ? 'signin' : 'continue_with'}
            width={googleWidth > 0 ? String(googleWidth) : undefined}
          />
        </div>
      </div>
      {withApple && <AppleSignInButton onClick={onApple} shape={shape} />}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
