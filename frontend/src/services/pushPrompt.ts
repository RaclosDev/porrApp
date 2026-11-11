import { savePushDeviceState } from './api';
import { needsIosInstall, notificationPermission } from './push';

const WEEK = 7 * 24 * 60 * 60 * 1000;
const key = (userId: string) => `push_prompt_v2:${userId}`;
let deviceId: string | undefined;

export function pushPromptDue(userId: string): boolean {
  try {
    const last = Number(localStorage.getItem(key(userId)));
    return !last || !Number.isFinite(last) || Date.now() - last >= WEEK || last > Date.now();
  } catch {
    return true;
  }
}

export function rememberPushPrompt(userId: string): void {
  try {
    localStorage.setItem(key(userId), String(Date.now()));
  } catch {
    // El aviso sigue funcionando si el navegador no permite guardar preferencias.
  }
}

export async function reportPushDeviceState(promptShown = false): Promise<void> {
  if (!deviceId) {
    try {
      deviceId = localStorage.getItem('push_device_id') || crypto.randomUUID();
      localStorage.setItem('push_device_id', deviceId);
    } catch {
      deviceId = crypto.randomUUID();
    }
  }
  await savePushDeviceState({
    deviceId,
    permission: notificationPermission(),
    installRequired: needsIosInstall(),
    promptShown,
  });
}
