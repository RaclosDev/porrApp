import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import type { CredentialResponse } from '@react-oauth/google';
import SocialSignInButtons from './SocialSignInButtons';
import EmailSignInForm, { type Step } from './EmailSignInForm';
import {
  usePasskeySignIn,
  type EmailSignInMode,
  type SignInOptions,
} from '../hooks/useGoogleSignIn';
import { useConditionalPasskey } from '../hooks/usePasskeyAutoSignIn';
import { appleSignInEnabled } from '../utils/appleSignIn';
import { passkeysSupported } from '../utils/webauthn';

export type AuthIntent = 'signup' | 'login';

interface AuthPanelProps {
  /** Con qué se abre: crear cuenta (desde «Crear mi liga», invitaciones) o entrar. */
  intent: AuthIntent;
  /** Id del título, para el `aria-labelledby` del diálogo. */
  titleId?: string;
  /** Sin título ni entradilla propios (la pantalla ya tiene los suyos). */
  hideHeading?: boolean;
  /** Entradilla en lugar de la de por defecto. */
  lede?: ReactNode;
  /** Mostrar los botones de Google y Apple (en el diálogo, solo al abrirse: cargan sus SDK). */
  showSocial?: boolean;
  onGoogleSuccess: (response: CredentialResponse) => void | Promise<unknown>;
  onApple: () => Promise<unknown>;
  /** Adónde ir al entrar con email o llave (Google y Apple los gestiona quien los pasa). */
  signInOptions?: SignInOptions;
  /** Después de entrar con email, código o llave. */
  onSignedIn?: () => void | Promise<void>;
  /** Al pulsar los enlaces legales (por ejemplo, para cerrar el diálogo). */
  onLegalLinkClick?: () => void;
  shape?: 'pill' | 'rectangular';
  /** El panel está a la vista: solo entonces se ofrece la llave en el autocompletado. */
  active?: boolean;
}

const linkButton =
  'bg-transparent border-0 p-0 text-inherit underline font-bold cursor-pointer min-h-11';

/**
 * Pantalla de acceso común (diálogo, «Mis ligas» e invitaciones): Google y Apple, «o con tu email»
 * y el formulario ya abierto, la llave de acceso al entrar y el cambio entre crear cuenta y entrar.
 */
export default function AuthPanel({
  intent,
  titleId,
  hideHeading = false,
  lede,
  showSocial = true,
  onGoogleSuccess,
  onApple,
  signInOptions = {},
  onSignedIn,
  onLegalLinkClick,
  shape = 'pill',
  active = true,
}: AuthPanelProps) {
  const [mode, setMode] = useState<EmailSignInMode>(intent === 'signup' ? 'register' : 'login');
  const [step, setStep] = useState<Step>('form');
  const [socialError, setSocialError] = useState('');
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const registering = mode === 'register';
  const withApple = appleSignInEnabled();
  const withPasskeys = passkeysSupported();
  const providers = withApple ? 'Google, Apple o tu email' : 'Google o tu email';

  const passkeySignIn = usePasskeySignIn(signInOptions);
  const stopPasskeyAutofill = useConditionalPasskey(
    active && withPasskeys && !registering && step === 'form',
    () => void onSignedIn?.(),
    signInOptions,
  );

  const signInWithPasskey = async () => {
    stopPasskeyAutofill();
    setPasskeyBusy(true);
    const ok = await passkeySignIn();
    setPasskeyBusy(false);
    if (ok) await onSignedIn?.();
  };

  const defaultLede = registering
    ? `Gratis y en un minuto. Con ${providers}.`
    : `Con ${providers} para ver tus ligas y rellenar tu porra.`;

  // En el código o en «¿Has olvidado la contraseña?» solo queda ese paso a la vista.
  const focused = step !== 'form';

  return (
    <div className="flex flex-col gap-4 w-full max-w-80 mx-auto">
      {!hideHeading && (
        <div className="flex flex-col gap-2 text-center">
          <h2 id={titleId} className="poster-title m-0 text-[1.8rem]">
            {registering ? 'Crea tu cuenta' : 'Inicia sesión'}
          </h2>
          {!focused && (
            <p className="m-0 text-[0.95rem] text-muted leading-[1.45]">{lede ?? defaultLede}</p>
          )}
        </div>
      )}
      {hideHeading && lede && !focused && (
        <p className="m-0 text-[0.95rem] leading-[1.45]">{lede}</p>
      )}

      {!focused && showSocial && (
        <>
          <SocialSignInButtons
            onGoogleSuccess={(response) => {
              setSocialError('');
              void onGoogleSuccess(response);
            }}
            onGoogleError={() =>
              setSocialError('No se ha podido entrar con Google. Vuelve a intentarlo.')
            }
            onApple={async () => {
              setSocialError('');
              await onApple();
            }}
            shape={shape}
          />
          {socialError && (
            <p role="alert" className="m-0 text-[0.82rem] text-[#b91c1c] text-center">
              {socialError}
            </p>
          )}
          <div className="flex items-center gap-3 text-[0.8rem] text-muted" aria-hidden="true">
            <span className="flex-1 border-t border-current opacity-40" />o con tu email
            <span className="flex-1 border-t border-current opacity-40" />
          </div>
        </>
      )}

      <EmailSignInForm
        key={mode}
        mode={mode}
        signInOptions={signInOptions}
        onSignedIn={onSignedIn}
        passkeyAutofill={withPasskeys}
        onBeforeSubmit={stopPasskeyAutofill}
        onStepChange={setStep}
      />

      {!focused && (
        <>
          {withPasskeys && !registering && (
            <button
              type="button"
              className="glass-btn flex items-center justify-center gap-2 min-h-11 text-[0.85rem]"
              disabled={passkeyBusy}
              onClick={() => void signInWithPasskey()}
            >
              <KeyRound size={16} aria-hidden="true" />
              {passkeyBusy ? 'Comprobando…' : 'Entrar con llave de acceso'}
            </button>
          )}
          <p className="m-0 text-center text-[0.85rem]">
            {registering ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
            <button
              type="button"
              className={linkButton}
              onClick={() => setMode(registering ? 'login' : 'register')}
            >
              {registering ? 'Inicia sesión' : 'Crea una gratis'}
            </button>
          </p>
          <p className="m-0 text-center text-[0.76rem] text-muted leading-[1.5]">
            {registering ? 'Al crear la cuenta aceptas el ' : 'Al continuar aceptas el '}
            <Link to="/aviso-legal" className="underline" onClick={onLegalLinkClick}>
              aviso legal
            </Link>{' '}
            y la{' '}
            <Link to="/privacidad" className="underline" onClick={onLegalLinkClick}>
              política de privacidad
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
