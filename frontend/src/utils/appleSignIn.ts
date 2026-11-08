/**
 * «Iniciar sesión con Apple» en la web con el SDK de Apple (ventana emergente). El script solo se
 * descarga cuando se pinta el botón, y solo si hay Services ID configurado.
 */

const SCRIPT_URL =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/es_ES/appleid.auth.js';

interface AppleSignInResponse {
  authorization: { id_token: string; code: string; state?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
}

interface AppleIdApi {
  auth: {
    init(config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }): void;
    signIn(): Promise<AppleSignInResponse>;
  };
}

declare global {
  interface Window {
    AppleID?: AppleIdApi;
  }
}

/** Services ID de Apple; vacío si el login con Apple no está configurado. */
const appleClientId = (import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined) ?? '';

export function appleSignInEnabled(): boolean {
  return appleClientId.trim() !== '';
}

let loading: Promise<AppleIdApi> | null = null;

/** Descarga el SDK de Apple una sola vez. */
export function loadAppleSdk(): Promise<AppleIdApi> {
  if (window.AppleID) return Promise.resolve(window.AppleID);
  loading ??= new Promise<AppleIdApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.AppleID ? resolve(window.AppleID) : reject(new Error('Apple no está disponible'));
    script.onerror = () => {
      loading = null;
      reject(new Error('No se ha podido cargar el acceso con Apple'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Abre la ventana de Apple y devuelve su ID token y, la primera vez, el nombre de la persona.
 * Hay que llamarla desde el clic con el SDK ya cargado: si no, el navegador bloquea la ventana.
 */
export async function signInWithApple(): Promise<{ idToken: string; name?: string }> {
  const sdk = window.AppleID ?? (await loadAppleSdk());
  sdk.auth.init({
    clientId: appleClientId,
    scope: 'name email',
    redirectURI: `${window.location.origin}/`,
    usePopup: true,
  });
  const response = await sdk.auth.signIn();
  const name = [response.user?.name?.firstName, response.user?.name?.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return { idToken: response.authorization.id_token, name: name || undefined };
}

/** La persona cerró la ventana de Apple o canceló: no es un error que mostrar. */
export function isAppleCancel(error: unknown): boolean {
  const code = (error as { error?: unknown } | null)?.error;
  return code === 'popup_closed_by_user' || code === 'user_cancelled_authorize';
}
