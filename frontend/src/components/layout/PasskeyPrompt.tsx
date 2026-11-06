import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '../../utils/errors';
import { isPasskeyCancel } from '../../utils/webauthn';
import {
  addPasskeyOnThisDevice,
  isDuplicatePasskey,
  markPasskeyPromptAnswered,
} from '../../utils/passkeyPrompt';

interface PasskeyPromptProps {
  userId: string;
  /** Se ha respondido: el aviso deja paso a los demás. */
  onDone: () => void;
}

/** Cómo se desbloquea este dispositivo, para que el aviso hable en sus términos. */
function unlockMethod(userAgent = navigator.userAgent): string {
  if (/iPhone|iPad/.test(userAgent)) return 'Face ID';
  if (/Macintosh/.test(userAgent)) return 'Touch ID';
  if (/Windows/.test(userAgent)) return 'Windows Hello';
  return 'tu huella';
}

/**
 * Tras entrar en un dispositivo que puede guardar llaves de acceso, ofrece añadir una para entrar
 * la próxima vez sin Google. Se pregunta una sola vez por cuenta y dispositivo; desde el perfil se
 * puede añadir más tarde.
 */
export default function PasskeyPrompt({ userId, onDone }: PasskeyPromptProps) {
  const [busy, setBusy] = useState(false);
  const method = unlockMethod();

  const answer = () => {
    markPasskeyPromptAnswered(userId);
    onDone();
  };

  const later = () => {
    answer();
    toast('Puedes añadirla cuando quieras desde tu perfil, en «Llaves de acceso».');
  };

  const activate = async () => {
    setBusy(true);
    try {
      await addPasskeyOnThisDevice();
      toast.success(`Listo: la próxima vez entra con ${method}.`);
      answer();
    } catch (err) {
      if (isPasskeyCancel(err)) return;
      if (isDuplicatePasskey(err)) {
        answer();
        return;
      }
      toast.error(errorMessage(err, 'No se pudo añadir la llave de acceso'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Entrar con llave de acceso"
      className="paper-panel album-sheet landing-tape fixed bottom-[calc(90px_+_env(safe-area-inset-bottom,_0px))] md:bottom-5 left-1/2 z-[999998] flex w-[90%] max-w-[350px] -translate-x-1/2 flex-col items-center gap-2.5 rounded-[4px] border border-[var(--ink)] px-5 py-[15px] shadow-[4px_4px_0_rgba(0,0,0,0.2)]"
    >
      <KeyRound size={22} aria-hidden="true" className="text-main" />
      <p className="m-0 text-center font-bold text-main">
        ¿Entrar la próxima vez con {method}? Sin escribir tu cuenta de Google.
      </p>
      <div className="mt-[5px] flex gap-2.5">
        <button
          type="button"
          onClick={() => void activate()}
          disabled={busy}
          className="glass-btn primary-btn px-[15px] py-2 font-bold text-main"
        >
          {busy ? 'Un momento…' : 'Activar'}
        </button>
        <button type="button" onClick={later} disabled={busy} className="glass-btn px-[15px] py-2">
          Más tarde
        </button>
      </div>
    </div>
  );
}
