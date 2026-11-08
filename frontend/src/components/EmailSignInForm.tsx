import { useId, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { useEmailSignIn, type EmailSignInMode } from '../hooks/useGoogleSignIn';
import { requestPasswordReset } from '../services/api';
import { errorMessage } from '../utils/errors';

const MIN_PASSWORD_LENGTH = 8;

interface EmailSignInFormProps {
  /** Con qué pestaña se abre: crear cuenta o entrar. */
  initialMode?: EmailSignInMode;
  /** Ir a «Mis ligas» o a la invitación pendiente al entrar, como con Google. */
  navigateAfterLogin?: boolean;
  /** Después de entrar (por ejemplo, para cerrar el diálogo o unirse a la liga). */
  onSignedIn?: () => void | Promise<void>;
}

/**
 * Alternativa a Google: crear cuenta o entrar con email y contraseña. Empieza plegado en un botón
 * para que la pantalla de acceso siga siendo corta.
 */
export default function EmailSignInForm({
  initialMode = 'login',
  navigateAfterLogin = true,
  onSignedIn,
}: EmailSignInFormProps) {
  const id = useId();
  const signIn = useEmailSignIn({ navigateAfterLogin });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<EmailSignInMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);
  const registering = mode === 'register';

  if (!open) {
    return (
      <button
        type="button"
        className="glass-btn flex items-center justify-center gap-2 rounded-full px-4 py-2 text-[0.88rem] font-bold min-h-11 mx-auto"
        onClick={() => setOpen(true)}
      >
        <Mail size={16} aria-hidden="true" />
        Continuar con email
      </button>
    );
  }

  if (forgot) {
    return <ForgotPasswordForm initialEmail={email} onBack={() => setForgot(false)} />;
  }

  const switchMode = (next: EmailSignInMode) => {
    setMode(next);
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (registering && password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(mode, email.trim(), password);
      await onSignedIn?.();
    } catch (cause) {
      setError(
        errorMessage(
          cause,
          registering ? 'No se ha podido crear la cuenta.' : 'No se ha podido iniciar sesión.',
        ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 text-left w-full max-w-80 mx-auto"
      onSubmit={(event) => void submit(event)}
      aria-labelledby={`${id}-title`}
      noValidate
    >
      <h4 id={`${id}-title`} className="sr-only">
        {registering ? 'Crear cuenta con email' : 'Entrar con email'}
      </h4>
      <div className="flex gap-1.5 justify-center" role="group" aria-label="¿Tienes cuenta?">
        <button
          type="button"
          className={`glass-btn rounded-full px-3.5 py-1.5 text-[0.82rem] min-h-11 ${registering ? '' : 'primary-btn font-bold'}`}
          aria-pressed={!registering}
          onClick={() => switchMode('login')}
        >
          Ya tengo cuenta
        </button>
        <button
          type="button"
          className={`glass-btn rounded-full px-3.5 py-1.5 text-[0.82rem] min-h-11 ${registering ? 'primary-btn font-bold' : ''}`}
          aria-pressed={registering}
          onClick={() => switchMode('register')}
        >
          Crear cuenta
        </button>
      </div>
      <label className="flex flex-col gap-1 text-[0.85rem] font-bold" htmlFor={`${id}-email`}>
        Email
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete={registering ? 'email' : 'username'}
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="glass-input font-normal"
        />
      </label>
      <label className="flex flex-col gap-1 text-[0.85rem] font-bold" htmlFor={`${id}-password`}>
        Contraseña
        <span className="flex gap-1.5">
          <input
            id={`${id}-password`}
            type={showPassword ? 'text' : 'password'}
            autoComplete={registering ? 'new-password' : 'current-password'}
            required
            minLength={registering ? MIN_PASSWORD_LENGTH : undefined}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={registering ? `${id}-password-hint` : undefined}
            className="glass-input font-normal flex-1 min-w-0"
          />
          <button
            type="button"
            className="glass-btn text-[0.78rem] px-2.5 min-h-11 font-normal"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((shown) => !shown)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
      </label>
      {registering && (
        <p id={`${id}-password-hint`} className="m-0 text-[0.76rem] text-muted leading-[1.4]">
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      )}
      {!registering && (
        <button
          type="button"
          className="self-start text-[0.8rem] underline min-h-11 bg-transparent border-0 p-0 text-inherit cursor-pointer"
          onClick={() => {
            setError('');
            setForgot(true);
          }}
        >
          ¿Has olvidado la contraseña?
        </button>
      )}
      {error && (
        <p role="alert" className="m-0 text-[0.82rem] text-[#b91c1c]">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="glass-btn primary-btn font-bold min-h-11"
        disabled={busy || !email.trim() || !password}
      >
        {busy ? 'Un momento…' : registering ? 'Crear cuenta' : 'Entrar'}
      </button>
    </form>
  );
}

interface ForgotPasswordFormProps {
  initialEmail: string;
  onBack: () => void;
}

/** Pide el enlace para cambiar la contraseña. El mensaje es el mismo exista o no la cuenta. */
function ForgotPasswordForm({ initialEmail, onBack }: ForgotPasswordFormProps) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (cause) {
      setError(errorMessage(cause, 'No se ha podido mandar el enlace.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-3 text-left w-full max-w-80 mx-auto"
      onSubmit={(event) => void submit(event)}
      aria-labelledby={`${id}-title`}
      noValidate
    >
      <h4 id={`${id}-title`} className="m-0 text-[0.95rem] font-bold text-center">
        Cambiar la contraseña
      </h4>
      {sent ? (
        <p role="status" className="m-0 text-[0.85rem] leading-[1.45]">
          Si hay una cuenta con contraseña con ese email, te llegará un enlace para cambiarla.
          Caduca en 30 minutos; mira también en spam.
        </p>
      ) : (
        <>
          <p className="m-0 text-[0.82rem] text-muted leading-[1.4]">
            Te mandamos un enlace a tu email para que pongas una nueva.
          </p>
          <label className="flex flex-col gap-1 text-[0.85rem] font-bold" htmlFor={`${id}-email`}>
            Email
            <input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="glass-input font-normal"
            />
          </label>
          {error && (
            <p role="alert" className="m-0 text-[0.82rem] text-[#b91c1c]">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="glass-btn primary-btn font-bold min-h-11"
            disabled={busy || !email.trim()}
          >
            {busy ? 'Un momento…' : 'Mandar enlace'}
          </button>
        </>
      )}
      <button type="button" className="glass-btn min-h-11 text-[0.85rem]" onClick={onBack}>
        Volver
      </button>
    </form>
  );
}
