import { Navigate, useSearchParams } from 'react-router-dom';
import type { CredentialResponse } from '@react-oauth/google';
import AuthPanel from '../components/AuthPanel';
import { useAppContext } from '../context/AppContext';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useGoogleSignIn';
import MarkerHeading from '../components/landing/MarkerHeading';
import { LANDING_COPY } from '../seo/pages';
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
    <div className="landing-page max-w-300 my-0 mx-auto pt-4 pb-15 px-4">
      <section className="mt-4 sm:mt-12 grid gap-8 lg:gap-14 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div className="flex flex-col gap-6">
          <MarkerHeading
            as="h1"
            onLoad
            text="Entra y sigue"
            marked="con tu porra."
            className="text-[clamp(2.4rem,6.4vw,5rem)]"
          />
          <div className="hidden lg:flex flex-col gap-6">
            <p className="text-[#3f4652] text-lg max-w-130 leading-snug">
              Tus ligas, tus predicciones y la clasificación te esperan donde las dejaste.
            </p>
            <ol
              className="list-none p-0 m-0 max-w-130 border-t border-[rgba(17,24,39,0.16)]"
              aria-label="Cómo se juega"
            >
              {LANDING_COPY.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex gap-4 items-baseline py-3 border-b border-[rgba(17,24,39,0.16)]"
                >
                  <span className="poster-title text-3xl text-[#0b5f74]" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="flex flex-col">
                    <span className="poster-title text-2xl">{step.title}</span>
                    <span className="text-[#3f4652] leading-snug">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="landing-poster paper-panel p-6 sm:p-8 text-center min-w-0">
          <AuthPanel
            intent="login"
            onGoogleSuccess={(response: CredentialResponse) => void googleSignIn(response)}
            onApple={async () => void (await appleSignIn())}
            signInOptions={signInOptions}
            shape="rectangular"
          />
        </div>
      </section>
    </div>
  );
}
