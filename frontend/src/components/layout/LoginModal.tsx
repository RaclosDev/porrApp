import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import type { NavigateFunction } from 'react-router-dom';
import { useRef } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

interface LoginModalProps {
  exitDemoMode: () => void;
  handleGoogleSuccess: (credentialResponse: CredentialResponse) => void;
  isDemo: boolean;
  navigate: NavigateFunction;
  setShowMyPredictionModal: (show: boolean) => void;
  showMyPredictionModal: boolean;
}

/** Diálogo para iniciar sesión con Google o probar la demo. */
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

  return (
    <div
      id="my-prediction-modal"
      className={`modal z-[999999] ${showMyPredictionModal ? 'flex' : 'hidden'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="modal-content glass-panel max-w-105 text-center py-[35px] px-[25px] shadow-[0_25px_50px_-12px_rgba(0,_0,_0,_0.5)]">
        <h3
          id="login-modal-title"
          className="text-accent-text mb-5 text-[1.8rem] tracking-[1px]"
          style={{ fontFamily: "'Outfit', sans-serif" }}
        >
          Iniciar sesión
        </h3>
        <div className="[animation:fadeIn_0.5s_ease_forwards]">
          <p className="mb-7.5 text-[1rem] text-muted leading-[1.5]">
            Para ver en qué liga estás o rellenar tu porra, ¡inicia sesión con Google!
          </p>
          <div className="flex justify-center mb-5">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Inicio de sesión cancelado o fallido')}
              theme="filled_black"
              shape="pill"
              text="continue_with"
            />
          </div>
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
