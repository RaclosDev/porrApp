import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import toast from 'react-hot-toast';
import type { NavigateFunction } from 'react-router-dom';

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
  return (
    <div
      id="my-prediction-modal"
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label="Identificación de usuario"
      style={{ display: showMyPredictionModal ? 'flex' : 'none', zIndex: 999999 }}
    >
      <div
        className="modal-content glass-panel"
        style={{
          maxWidth: '420px',
          textAlign: 'center',
          padding: '35px 25px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h3
          style={{
            color: 'var(--accent-color)',
            marginBottom: '20px',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '1.8rem',
            letterSpacing: '1px',
          }}
        >
          Iniciar sesión
        </h3>
        <div style={{ animation: 'fadeIn 0.5s ease forwards' }}>
          <p
            style={{
              marginBottom: '30px',
              fontSize: '1rem',
              color: 'var(--text-muted)',
              lineHeight: '1.5',
            }}
          >
            Para ver en qué liga estás o rellenar tu porra, ¡inicia sesión con Google!
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => toast.error('Inicio de sesión cancelado o fallido')}
              theme="filled_black"
              shape="pill"
              text="continue_with"
            />
          </div>
          <button
            className="glass-btn"
            style={{
              marginTop: '10px',
              fontSize: '0.85rem',
              padding: '8px 15px',
              opacity: 0.8,
              width: '100%',
            }}
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
