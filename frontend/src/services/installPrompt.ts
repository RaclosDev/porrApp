import { isIos, isStandalone } from './push';

/** Evento de instalación de la PWA (solo Chromium; no está en los tipos del DOM). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Cómo se puede instalar la app en este navegador:
 * - `installed`: ya se usa como app instalada (o se acaba de instalar).
 * - `native`: el navegador ofrece su diálogo de instalación (Android y Chrome/Edge de escritorio).
 * - `in-app`: navegador interno de otra app (Instagram, Facebook…), donde no se puede instalar:
 *   hay que abrir la página en el navegador del móvil.
 * - `ios`: iPhone o iPad, donde se instala a mano con «Compartir» → «Añadir a pantalla de inicio».
 * - `unavailable`: el navegador no lo permite o ya la tiene instalada aunque se abra en una pestaña.
 */
export type InstallState = 'installed' | 'native' | 'in-app' | 'ios' | 'unavailable';

/**
 * Navegadores dentro de otras apps (Instagram, Facebook, Messenger, TikTok, Snapchat, LinkedIn,
 * LINE, WeChat, app de Google). No ofrecen instalar ni «Añadir a pantalla de inicio».
 * El de WhatsApp en iPhone no se distingue de Safari.
 */
const IN_APP_BROWSER =
  /Instagram|FBAN|FBAV|FB_IAB|BytedanceWebview|musical_ly|Snapchat|LinkedInApp|\bLine\/|MicroMessenger|\bGSA\//;

export function isInAppBrowser(userAgent = navigator.userAgent): boolean {
  return IN_APP_BROWSER.test(userAgent);
}

/**
 * Dónde está «Compartir» en el navegador de iPhone o iPad, para señalarlo:
 * - `bottom`: Safari de iPhone hasta iOS 18, en la barra de abajo.
 * - `bottom-menu`: Safari de iPhone desde iOS 26, dentro del menú «⋯» de abajo a la derecha.
 * - `top-right`: Safari de iPad y Chrome, arriba a la derecha.
 * - `menu`: otros navegadores (Firefox, Edge…), en su menú.
 */
export type ShareButtonPlace = 'bottom' | 'bottom-menu' | 'top-right' | 'menu';

export function shareButtonPlace(userAgent = navigator.userAgent): ShareButtonPlace {
  if (/CriOS/.test(userAgent)) return 'top-right';
  if (/FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo/.test(userAgent)) return 'menu';
  if (!/iPhone|iPod/.test(userAgent)) return 'top-right';
  // Safari 26 congela la versión de iOS en el agente, pero no la suya propia.
  const safariVersion = Number(/Version\/(\d+)/.exec(userAgent)?.[1] ?? 0);
  return safariVersion >= 26 ? 'bottom-menu' : 'bottom';
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let justInstalled = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

/**
 * Escucha los eventos de instalación desde el arranque: Chrome lanza `beforeinstallprompt` una sola
 * vez y puede hacerlo antes de que se monte la cabecera.
 */
export function initInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sin esto Chrome muestra su propia mini barra; la app ofrece la instalación desde la cabecera.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    justInstalled = true;
    notify();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', notify);
}

export function subscribeInstallState(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function installState(): InstallState {
  if (justInstalled || isStandalone()) return 'installed';
  if (deferredPrompt) return 'native';
  if (isInAppBrowser()) return 'in-app';
  if (isIos()) return 'ios';
  return 'unavailable';
}

/**
 * Abre el diálogo de instalación del navegador. El evento solo sirve una vez: tras la respuesta
 * se descarta y el navegador volverá a ofrecerlo cuando lo considere.
 */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';
  deferredPrompt = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  notify();
  return outcome;
}
