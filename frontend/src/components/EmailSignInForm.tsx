import { useId, useState, type FormEvent } from 'react';
import { useEmailSignIn, type EmailSignInMode, type SignInOptions } from '../hooks/useGoogleSignIn';
import { requestPasswordReset } from '../services/api';
import { errorMessage } from '../utils/errors';

const MIN_PASSWORD_LENGTH = 8;
const CODE_LENGTH = 6;
const EMAIL_SHAPE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

interface EmailSignInFormProps {
  /** Crear cuenta o entrar; lo elige el panel de acceso. */
  mode: EmailSignInMode;
  /** Adónde ir al entrar (ver {@link SignInOptions}). */
  signInOptions?: SignInOptions;
  /** Después de entrar (por ejemplo, para cerrar el diálogo o unirse a la liga). */
  onSignedIn?: () => void | Promise<void>;
  /** El navegador ofrece las llaves de acceso en el autocompletado del email. */
  passkeyAutofill?: boolean;
  /** Antes de enviar, para cancelar la llave del autocompletado. */
  onBeforeSubmit?: () => void;
  /** Al pasar al código o a «¿Has olvidado la contraseña?» (el panel oculta lo demás). */
  onStepChange?: (step: Step) => void;
}

export type Step = 'form' | 'code' | 'forgot';

const errorText = 'm-0 text-[0.82rem] text-[#b91c1c]';
const fieldLabel = 'flex flex-col gap-1 text-[0.85rem] font-bold';
const linkButton =
  'bg-transparent border-0 p-0 text-inherit underline cursor-pointer text-[0.8rem] min-h-11';

/**
 * Email y contraseña para entrar o crear la cuenta. Crearla pide después el código de 6 cifras que
 * llega al email: la cuenta solo existe al escribirlo.
 */
export default function EmailSignInForm({
  mode,
  signInOptions = {},
  onSignedIn,
  passkeyAutofill = false,
  onBeforeSubmit,
  onStepChange,
}: EmailSignInFormProps) {
  const id = useId();
  const { signIn, confirm } = useEmailSignIn(signInOptions);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [step, setStepState] = useState<Step>('form');
  const registering = mode === 'register';

  const setStep = (next: Step) => {
    setError('');
    setStepState(next);
    onStepChange?.(next);
  };

  if (step === 'forgot') {
    return <ForgotPasswordForm initialEmail={email} onBack={() => setStep('form')} />;
  }

  if (step === 'code') {
    return (
      <CodeForm
        email={email.trim()}
        onConfirm={async (code) => {
          await confirm(email.trim(), code, password);
          await onSignedIn?.();
        }}
        onResend={() => signIn('register', email.trim(), password)}
        onBack={() => setStep('form')}
      />
    );
  }

  const validate = (): string => {
    const trimmed = email.trim();
    if (!trimmed) return 'Escribe tu email.';
    if (!EMAIL_SHAPE.test(trimmed)) return 'Escribe un email válido, como nombre@ejemplo.com.';
    if (!password) return 'Escribe tu contraseña.';
    if (registering && password.length < MIN_PASSWORD_LENGTH) {
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    return '';
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    onBeforeSubmit?.();
    setBusy(true);
    setError('');
    try {
      const result = await signIn(mode, email.trim(), password);
      if (result === 'code-sent') {
        setStep('code');
        return;
      }
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

  const longEnough = password.length >= MIN_PASSWORD_LENGTH;

  return (
    <form
      className="flex flex-col gap-3 text-left w-full"
      onSubmit={(event) => void submit(event)}
      aria-label={registering ? 'Crear cuenta con email' : 'Entrar con email'}
      noValidate
    >
      <label className={fieldLabel} htmlFor={`${id}-email`}>
        Email
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete={registering ? 'email' : passkeyAutofill ? 'username webauthn' : 'username'}
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="glass-input font-normal"
        />
      </label>
      <label className={fieldLabel} htmlFor={`${id}-password`}>
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
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            onClick={() => setShowPassword((shown) => !shown)}
          >
            {showPassword ? 'Ocultar' : 'Mostrar'}
          </button>
        </span>
      </label>
      {registering ? (
        <p
          id={`${id}-password-hint`}
          className={`m-0 text-[0.76rem] leading-[1.4] ${longEnough ? 'text-[#166534]' : 'text-muted'}`}
        >
          {longEnough
            ? '✓ Longitud correcta. Evita las contraseñas fáciles de adivinar.'
            : `Al menos ${MIN_PASSWORD_LENGTH} caracteres${password ? ` (llevas ${password.length})` : ''}.`}
        </p>
      ) : (
        <button
          type="button"
          className={`self-start ${linkButton}`}
          onClick={() => setStep('forgot')}
        >
          ¿Has olvidado la contraseña?
        </button>
      )}
      {error && (
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
      <button type="submit" className="glass-btn primary-btn font-bold min-h-11" disabled={busy}>
        {busy ? 'Un momento…' : registering ? 'Crear cuenta' : 'Entrar'}
      </button>
    </form>
  );
}

interface CodeFormProps {
  email: string;
  onConfirm: (code: string) => Promise<void>;
  onResend: () => Promise<unknown>;
  onBack: () => void;
}

/** Segundo paso del registro: el código de 6 cifras que llega al email. */
function CodeForm({ email, onConfirm, onResend, onBack }: CodeFormProps) {
  const id = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const digits = code.replace(/\D/g, '');
    if (digits.length !== CODE_LENGTH) {
      setError(`El código tiene ${CODE_LENGTH} cifras.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onConfirm(digits);
    } catch (cause) {
      setError(errorMessage(cause, 'No se ha podido crear la cuenta.'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    setResent(false);
    try {
      await onResend();
      setResent(true);
    } catch (cause) {
      setError(errorMessage(cause, 'No se ha podido mandar otro código.'));
    }
  };

  return (
    <form
      className="flex flex-col gap-3 text-left w-full"
      onSubmit={(event) => void submit(event)}
      aria-labelledby={`${id}-title`}
      noValidate
    >
      <h4 id={`${id}-title`} className="m-0 text-[1rem] font-bold text-center">
        Revisa tu correo
      </h4>
      <p className="m-0 text-[0.85rem] leading-[1.45]">
        Te hemos mandado un código de {CODE_LENGTH} cifras a <strong>{email}</strong>. Escríbelo
        para terminar de crear tu cuenta.
      </p>
      <label className={fieldLabel} htmlFor={`${id}-code`}>
        Código
        <input
          id={`${id}-code`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={CODE_LENGTH + 2}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="glass-input font-normal text-center text-[1.4rem] tracking-[0.4em]"
          autoFocus
        />
      </label>
      {error && (
        <p role="alert" className={errorText}>
          {error}
        </p>
      )}
      {resent && !error && (
        <p role="status" className="m-0 text-[0.8rem] text-[#166534]">
          Te hemos mandado otro código.
        </p>
      )}
      <button type="submit" className="glass-btn primary-btn font-bold min-h-11" disabled={busy}>
        {busy ? 'Un momento…' : 'Crear cuenta'}
      </button>
      <p className="m-0 text-[0.76rem] text-muted leading-[1.4]">
        Caduca en 15 minutos. ¿No te llega? Mira en spam o{' '}
        <button type="button" className={linkButton} onClick={() => void resend()}>
          pide otro
        </button>
        . Si ya tenías cuenta con este email, te llegará un aviso para entrar en vez del código.
      </p>
      <button type="button" className="glass-btn min-h-11 text-[0.85rem]" onClick={onBack}>
        Cambiar el email
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
    if (!EMAIL_SHAPE.test(email.trim())) {
      setError('Escribe un email válido, como nombre@ejemplo.com.');
      return;
    }
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
      className="flex flex-col gap-3 text-left w-full"
      onSubmit={(event) => void submit(event)}
      aria-labelledby={`${id}-title`}
      noValidate
    >
      <h4 id={`${id}-title`} className="m-0 text-[1rem] font-bold text-center">
        Cambiar la contraseña
      </h4>
      {sent ? (
        <p role="status" className="m-0 text-[0.85rem] leading-[1.45]">
          Si hay una cuenta con ese email, te llegará un correo: con un enlace para cambiar la
          contraseña o, si entras con Google o Apple, con cómo entrar. El enlace caduca en 30
          minutos; mira también en spam.
        </p>
      ) : (
        <>
          <p className="m-0 text-[0.82rem] text-muted leading-[1.4]">
            Te mandamos un enlace a tu email para que pongas una nueva.
          </p>
          <label className={fieldLabel} htmlFor={`${id}-email`}>
            Email
            <input
              id={`${id}-email`}
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="glass-input font-normal"
            />
          </label>
          {error && (
            <p role="alert" className={errorText}>
              {error}
            </p>
          )}
          <button
            type="submit"
            className="glass-btn primary-btn font-bold min-h-11"
            disabled={busy}
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
