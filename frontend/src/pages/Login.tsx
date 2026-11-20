import { Navigate, useSearchParams } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import AuthPanel from '../components/AuthPanel';
import { useAppContext } from '../context/AppContext';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { usePasskeyAutoSignIn } from '../hooks/usePasskeyAutoSignIn';
import { safeRedirect } from '../utils/safeRedirect';

/** /login: página pública de acceso (Google, Apple, email con contraseña y llave de acceso). */
export default function Login() {
  const [params] = useSearchParams();
  const redirectTo = safeRedirect(params.get('redirect'));
  const { isAuthenticated, userName } = useAppContext();
  const signedIn = isAuthenticated && Boolean(userName);
  const signInOptions = { redirectTo };
  const googleSignIn = useGoogleSignIn(signInOptions);
  const appleSignIn = useAppleSignIn(signInOptions);
  usePasskeyAutoSignIn(!signedIn, undefined, signInOptions);

  if (signedIn) {
    // Con la sesión puesta (también tras entrar aquí) se sigue a la invitación pendiente, al
    // destino pedido o al inicio; `replace` para que «atrás» no vuelva a esta pantalla.
    const pendingCode = localStorage.getItem('pendingJoinCode');
    const target = pendingCode ? `/join/${encodeURIComponent(pendingCode)}` : (redirectTo ?? '/');
    return <Navigate to={target} replace />;
  }

  return (
    <div className="join-auth-screen paper-panel album-sheet landing-tape text-center p-6">
      <AuthPanel
        intent="login"
        onGoogleSuccess={(response: CredentialResponse) => void googleSignIn(response)}
        onApple={async () => void (await appleSignIn())}
        signInOptions={signInOptions}
        shape="rectangular"
      />
    </div>
  );
}
