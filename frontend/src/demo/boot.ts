/** Arranque de la demo. Tiene que importarse antes que nada que lea `localStorage` o llame a /api. */
import { DEMO, startDemoStorage } from './mode';
import { installDemoBackend } from './backend';

if (DEMO) {
  startDemoStorage();
  installDemoBackend();
}
