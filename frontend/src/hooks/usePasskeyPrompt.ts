import { useEffect, useState } from 'react';
import { passkeysSupported } from '../utils/webauthn';
import { passkeyPromptAnswered, platformPasskeyAvailable } from '../utils/passkeyPrompt';

/**
 * Si toca ofrecer una llave de acceso: con sesión, en un dispositivo con Face ID, Touch ID, huella
 * o Windows Hello, y sin haber respondido ya con esta cuenta en este dispositivo.
 */
export function usePasskeyPrompt(userId: string, active: boolean) {
  const [available, setAvailable] = useState(false);
  // Fuerza a releer la respuesta guardada tras responder.
  const [, setAnsweredAt] = useState(0);
  const answered = !userId || passkeyPromptAnswered(userId);
  const wanted = active && !answered && passkeysSupported();

  useEffect(() => {
    if (!wanted) return;
    let current = true;
    void platformPasskeyAvailable().then((ok) => {
      if (current) setAvailable(ok);
    });
    return () => {
      current = false;
    };
  }, [wanted]);

  return {
    show: wanted && available,
    done: () => setAnsweredAt(Date.now()),
  };
}
