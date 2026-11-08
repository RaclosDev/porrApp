import type { AuthIntent } from '../components/AuthPanel';

export const OPEN_LOGIN_EVENT = 'open-login-modal';

/** Cómo abrir el diálogo de acceso. */
export interface LoginModalRequest {
  /** Crear cuenta (por defecto desde «Crear mi liga») o entrar. */
  intent?: AuthIntent;
  /** Adónde ir al entrar si no hay invitación pendiente. */
  redirectTo?: string;
}

/** Abre el diálogo de acceso desde cualquier página (lo escucha Layout). */
function openLoginModal(request: LoginModalRequest = {}): void {
  window.dispatchEvent(new CustomEvent<LoginModalRequest>(OPEN_LOGIN_EVENT, { detail: request }));
}

/** «Crear mi liga»: crear la cuenta y, al entrar, ir directo a crear la liga. */
export function openSignupToCreateLeague(): void {
  openLoginModal({ intent: 'signup', redirectTo: '/crear-liga' });
}
