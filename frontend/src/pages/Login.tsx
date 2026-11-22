import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import AuthPanel, { type AuthIntent } from '../components/AuthPanel';
import { useAppContext } from '../context/AppContext';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { usePasskeyAutoSignIn } from '../hooks/usePasskeyAutoSignIn';
import { safeRedirect } from '../utils/safeRedirect';

const TITLE: Record<AuthIntent, string> = { login: 'Inicia sesión', signup: 'Crea tu cuenta' };

/** Ruta de la otra pantalla de acceso, conservando el destino (`?redirect=`). */
const AUTH_PATH: Record<AuthIntent, string> = { login: '/login', signup: '/registro' };

interface LoginProps {
  /** /login (entrar) o /registro (crear la cuenta). */
  intent?: AuthIntent;
}

/**
 * /login y /registro: páginas públicas de acceso (Google, Apple, email con contraseña y llave de
 * acceso). Tras entrar se va a la invitación pendiente, al destino de `?redirect=` o al inicio.
 */
export default function Login({ intent = 'login' }: LoginProps) {
  const navigate = useNavigate();
  const { search } = useLocation();
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
    <div className="landing-page fam">
      <div className="fam-container fam-auth">
        <section className="fam-card" aria-labelledby="auth-title">
          <h1 id="auth-title" className="fam-card__title">
            {TITLE[intent]}
          </h1>
          <AuthPanel
            key={intent}
            family
            hideHeading
            intent={intent}
            onIntentChange={(next) => navigate(AUTH_PATH[next] + search, { replace: true })}
            onGoogleSuccess={(response: CredentialResponse) => void googleSignIn(response)}
            onApple={async () => void (await appleSignIn())}
            signInOptions={signInOptions}
            shape="rectangular"
          />
        </section>
        <Link to="/demo" className="fam-btn fam-auth__demo">
          Probar la demo sin registrarte
        </Link>
      </div>
    </div>
  );
}
