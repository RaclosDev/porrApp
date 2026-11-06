import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  deletePasskey,
  fetchPasskeys,
  finishPasskeyRegistration,
  startPasskeyRegistration,
  type PasskeySummary,
} from '../services/api';
import { createPasskey, deviceName, isPasskeyCancel, passkeysSupported } from '../utils/webauthn';
import { errorMessage } from '../utils/errors';

const PASSKEYS_QUERY_KEY = ['passkeys'] as const;

const dateFormat = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Llaves de acceso de la cuenta: con una, se entra con Face ID, huella o PIN sin pasar por Google.
 * Útil sobre todo en la app instalada en iPhone, que no ve la sesión de Google de Safari.
 */
export default function PasskeySettings() {
  const queryClient = useQueryClient();
  const supported = passkeysSupported();
  const { data: passkeys } = useQuery({
    queryKey: PASSKEYS_QUERY_KEY,
    queryFn: fetchPasskeys,
    enabled: supported,
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  if (!supported) return null;

  const setPasskeys = (list: PasskeySummary[]) =>
    queryClient.setQueryData<PasskeySummary[]>(PASSKEYS_QUERY_KEY, list);

  const add = async () => {
    setBusy(true);
    try {
      const { requestId, options } = await startPasskeyRegistration();
      const credential = await createPasskey(options);
      const saved = await finishPasskeyRegistration(requestId, credential, deviceName());
      setPasskeys([...(passkeys ?? []), saved]);
      toast.success('Llave de acceso añadida. La próxima vez entra con ella.');
    } catch (err) {
      if (isPasskeyCancel(err)) return;
      // El dispositivo ya tiene una llave de esta cuenta.
      if (err instanceof DOMException && err.name === 'InvalidStateError') {
        toast('Este dispositivo ya tiene una llave de acceso de tu cuenta.');
        return;
      }
      toast.error(errorMessage(err, 'No se pudo añadir la llave de acceso'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (passkey: PasskeySummary) => {
    setBusy(true);
    try {
      setPasskeys(await deletePasskey(passkey.id));
      toast.success(`Llave «${passkey.name}» borrada.`);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo borrar la llave de acceso'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby="passkey-settings-title">
      <h3 id="passkey-settings-title" className="m-0 text-[0.95rem] font-bold text-main">
        Llaves de acceso
      </h3>
      <span className="text-[0.74rem] text-muted">
        Entra con Face ID, huella o el PIN del dispositivo, sin escribir tu cuenta de Google.
      </span>
      {passkeys && passkeys.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex items-center gap-2 text-[0.85rem] text-main">
              <KeyRound size={16} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="font-bold">{passkey.name}</span>
                <span className="block text-[0.72rem] text-muted">
                  Añadida el {dateFormat.format(new Date(passkey.createdAt))}
                  {passkey.lastUsedAt &&
                    ` · usada el ${dateFormat.format(new Date(passkey.lastUsedAt))}`}
                </span>
              </span>
              <button
                type="button"
                className="glass-btn header-icon-btn shrink-0"
                aria-label={`Borrar la llave ${passkey.name}`}
                title="Borrar"
                disabled={busy}
                onClick={() => void remove(passkey)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="glass-btn text-[0.8rem] self-start flex items-center gap-1.5"
        disabled={busy}
        onClick={() => void add()}
      >
        <KeyRound size={14} aria-hidden="true" />
        {busy ? 'Un momento…' : 'Añadir llave en este dispositivo'}
      </button>
    </section>
  );
}
