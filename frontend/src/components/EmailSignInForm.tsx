import { useId, useState, type FormEvent } from 'react';
import { Mail } from 'lucide-react';
import { useEmailSignIn, type EmailSignInMode } from '../hooks/useGoogleSignIn';
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
          Mínimo {MIN_PASSWORD_LENGTH} caracteres. Guárdala bien: de momento no se puede recuperar
          por correo.
        </p>
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
