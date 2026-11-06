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
 * - `ios`: iPhone o iPad, donde se instala a mano con «Compartir» → «Añadir a pantalla de inicio».
 * - `unavailable`: el navegador no lo permite o ya la tiene instalada aunque se abra en una pestaña.
 */
export type InstallState = 'installed' | 'native' | 'ios' | 'unavailable';

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
