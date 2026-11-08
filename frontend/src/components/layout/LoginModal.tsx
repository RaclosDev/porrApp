import type { CredentialResponse } from '@react-oauth/google';
import { type NavigateFunction } from 'react-router-dom';
import { useRef } from 'react';
import { X } from 'lucide-react';
import AuthPanel, { type AuthIntent } from '../AuthPanel';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { useAppleSignIn, useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { usePasskeyAutoSignIn } from '../../hooks/usePasskeyAutoSignIn';

interface LoginModalProps {
  exitDemoMode: () => void;
  /** Crear cuenta (desde «Crear mi liga») o entrar. */
  intent: AuthIntent;
  /** Adónde ir al entrar si no hay invitación pendiente. */
  redirectTo?: string;
  isDemo: boolean;
  navigate: NavigateFunction;
  setShowLoginModal: (show: boolean) => void;
  showLoginModal: boolean;
}

/** Diálogo para crear la cuenta o iniciar sesión con Google, Apple, email o llave de acceso. */
export default function LoginModal({
  exitDemoMode,
  intent,
  redirectTo,
  isDemo,
  navigate,
  setShowLoginModal,
  showLoginModal,
}: LoginModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Layout ya cierra este diálogo con Escape.
  useDialogFocus(dialogRef, { active: showLoginModal });
  const signInOptions = { redirectTo };
  const googleSignIn = useGoogleSignIn(signInOptions);
  const appleSignIn = useAppleSignIn(signInOptions);
  const close = () => setShowLoginModal(false);
  usePasskeyAutoSignIn(showLoginModal, close, signInOptions);

  const signInWithGoogle = async (response: CredentialResponse) => {
    if (await googleSignIn(response)) close();
  };

  const signInWithApple = async () => {
    if (await appleSignIn()) close();
  };

  const leave = () => {
    close();
    if (isDemo) exitDemoMode?.();
    navigate('/', { replace: true, state: {} });
  };

  return (
    <div
      id="login-modal"
      className={`modal items-start overflow-y-auto py-6 z-[999999] ${showLoginModal ? 'flex' : 'hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="modal-content relative my-auto shrink-0 overflow-visible paper-panel album-sheet landing-tape max-w-105 text-center pt-8 pb-5 px-5 sm:px-6 shadow-[0_25px_50px_-12px_rgba(0,_0,_0,_0.5)]">
        <button
          type="button"
          className="absolute top-2 right-2 flex items-center justify-center w-11 h-11 rounded-full bg-transparent border-0 cursor-pointer text-inherit hover:bg-[rgba(17,24,39,0.08)]"
          aria-label="Cerrar"
          onClick={close}
        >
          <X size={20} aria-hidden="true" />
        </button>
        {/* El diálogo siempre está montado: el panel (y los SDK de Google y Apple) solo al abrirlo. */}
        {showLoginModal && (
          <AuthPanel
            key={intent}
            intent={intent}
            titleId="login-modal-title"
            onGoogleSuccess={signInWithGoogle}
            onApple={signInWithApple}
            signInOptions={signInOptions}
            onSignedIn={close}
            onLegalLinkClick={close}
            active={showLoginModal}
          />
        )}
        <button
          type="button"
          className="mt-3 bg-transparent border-0 underline text-[0.8rem] text-muted cursor-pointer min-h-11"
          onClick={leave}
        >
          {isDemo ? 'Salir de la demo' : 'Volver al inicio'}
        </button>
      </div>
    </div>
  );
}
