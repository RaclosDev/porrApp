import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { usePasswordReset } from '../hooks/useGoogleSignIn';
import { errorMessage } from '../utils/errors';

const MIN_PASSWORD_LENGTH = 8;

/** Token del enlace del correo: va en el fragmento (#token=…) para que no llegue al servidor. */
function tokenFromHash(): string {
  return new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
}

/** Página del enlace del correo: pone una contraseña nueva y entra. */
export default function ResetPassword() {
  const id = useId();
  const reset = usePasswordReset();
  const [token] = useState(tokenFromHash);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Quita el token de la barra de direcciones: no queda en el historial ni al compartir la URL.
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reset(token, password);
    } catch (cause) {
      setError(errorMessage(cause, 'No se ha podido cambiar la contraseña.'));
      setBusy(false);
    }
  };

  return (
    <article className="paper-panel album-sheet max-w-md mx-auto my-6 px-6 py-8 text-left">
      <h1 className="poster-title text-[1.6rem] mb-4">Nueva contraseña</h1>
      {token ? (
        <form className="flex flex-col gap-3" onSubmit={(event) => void submit(event)} noValidate>
          <label
            className="flex flex-col gap-1 text-[0.85rem] font-bold"
            htmlFor={`${id}-password`}
          >
            Contraseña nueva
            <span className="flex gap-1.5">
              <input
                id={`${id}-password`}
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={72}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby={`${id}-hint`}
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
          <p id={`${id}-hint`} className="m-0 text-[0.76rem] text-muted leading-[1.4]">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres. Al cambiarla se cierra la sesión en tus otros
            dispositivos y se quitan tus llaves de acceso.
          </p>
          {error && (
            <p role="alert" className="m-0 text-[0.82rem] text-[#b91c1c]">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="glass-btn primary-btn font-bold min-h-11"
            disabled={busy || !password}
          >
            {busy ? 'Un momento…' : 'Guardar y entrar'}
          </button>
        </form>
      ) : (
        <p role="alert" className="m-0 leading-[1.5]">
          Este enlace no es válido. Pide otro desde «Continuar con email» → «¿Has olvidado la
          contraseña?».
        </p>
      )}
      <Link to="/" className="underline inline-flex items-center min-h-11 mt-4 text-[0.9rem]">
        Volver a PorrApp
      </Link>
    </article>
  );
}
