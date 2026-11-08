import type { CredentialResponse } from '@react-oauth/google';
import GoogleSignInButton from '../GoogleSignInButton';
import EmailSignInForm from '../EmailSignInForm';
import toast from 'react-hot-toast';
import { Link, type NavigateFunction } from 'react-router-dom';
import { useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { usePasskeySignIn } from '../../hooks/useGoogleSignIn';
import { passkeysSupported } from '../../utils/webauthn';

interface LoginModalProps {
  exitDemoMode: () => void;
  handleGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  isDemo: boolean;
  navigate: NavigateFunction;
  setShowMyPredictionModal: (show: boolean) => void;
  showMyPredictionModal: boolean;
}

/** Diálogo para iniciar sesión con Google, email y contraseña o llave de acceso, o probar la demo. */
export default function LoginModal({
  exitDemoMode,
  handleGoogleSuccess,
  isDemo,
  navigate,
  setShowMyPredictionModal,
  showMyPredictionModal,
}: LoginModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Layout ya cierra este diálogo con Escape.
  useDialogFocus(dialogRef, { active: showMyPredictionModal });
  const passkeySignIn = usePasskeySignIn();
  const [signingIn, setSigningIn] = useState(false);

  const signInWithPasskey = async () => {
    setSigningIn(true);
    const ok = await passkeySignIn();
    setSigningIn(false);
    if (ok) setShowMyPredictionModal(false);
  };

  return (
    <div
      id="my-prediction-modal"
      className={`modal items-start overflow-y-auto py-6 z-[999999] ${showMyPredictionModal ? 'flex' : 'hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="modal-content my-auto shrink-0 overflow-visible paper-panel album-sheet landing-tape max-w-105 text-center py-[35px] px-[25px] shadow-[0_25px_50px_-12px_rgba(0,_0,_0,_0.5)]">
        <h3 id="login-modal-title" className="poster-title mb-5 text-[1.8rem]">
          Iniciar sesión
        </h3>
        <div>
          <p className="mb-7.5 text-[1rem] text-muted leading-[1.5]">
            Inicia sesión con Google o con tu email para ver tus ligas y rellenar tu porra.
          </p>
          <div className="flex justify-center mb-5">
            {/* El diálogo siempre está montado: el SDK de Google solo se carga al abrirlo. */}
            {showMyPredictionModal && (
              <GoogleSignInButton
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Inicio de sesión cancelado o fallido')}
                theme="outline"
                shape="pill"
                text="continue_with"
              />
            )}
          </div>
          <div className="mb-5">
            <EmailSignInForm onSignedIn={() => setShowMyPredictionModal(false)} />
          </div>
          {passkeysSupported() && (
            <div className="flex flex-col items-center gap-1.5 mb-5">
              <button
                type="button"
                className="glass-btn flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[0.88rem] font-bold"
                disabled={signingIn}
                onClick={() => void signInWithPasskey()}
              >
                <KeyRound size={16} aria-hidden="true" />
                {signingIn ? 'Comprobando…' : 'Entrar con llave de acceso'}
              </button>
              <span className="text-[0.74rem] text-muted">
                Con Face ID, huella o PIN, si ya añadiste una llave desde tu perfil.
              </span>
            </div>
          )}
          <p className="mb-4 text-[0.8rem] text-muted leading-[1.5]">
            Al continuar aceptas el{' '}
            <Link
              to="/aviso-legal"
              className="underline"
              onClick={() => setShowMyPredictionModal(false)}
            >
              aviso legal
            </Link>{' '}
            y la{' '}
            <Link
              to="/privacidad"
              className="underline"
              onClick={() => setShowMyPredictionModal(false)}
            >
              política de privacidad
            </Link>
            .
          </p>
          <button
            className="glass-btn mt-2.5 text-[0.85rem] py-2 px-[15px] opacity-[0.8] w-full"
            onClick={() => {
              setShowMyPredictionModal(false);
              if (isDemo) {
                exitDemoMode?.();
              }
              navigate('/', { replace: true, state: {} });
            }}
          >
            {isDemo ? 'Salir de la demo' : 'Volver al inicio'}
          </button>
        </div>
      </div>
    </div>
  );
}
