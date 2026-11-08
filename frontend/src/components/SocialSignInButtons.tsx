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
      <div className="flex justify-center min-w-0 h-10 overflow-hidden">
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
      {withApple && <AppleSignInButton onClick={onApple} shape={shape} />}
    </div>
  );
}
