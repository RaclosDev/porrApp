/**
 * Cliente del backend. Punto de entrada único: reexporta la sesión (`http.ts`) y los endpoints
 * de cada dominio (`endpoints/`), así que componentes y tests siguen importando de aquí.
 */
export {
  type SessionRestore,
  getAuthToken,
  setAuthToken,
  initSession,
  whenSessionRestored,
  isRedeemingHandoff,
  endSession,
  prepareSessionHandoff,
  loginWithGoogle,
  startPasskeyLogin,
  loginWithPasskey,
  loginWithPassword,
  registerWithPassword,
} from './http';
export * from './endpoints/tournament';
export * from './endpoints/predictions';
export * from './endpoints/leaderboard';
export * from './endpoints/leagues';
export * from './endpoints/users';
export * from './endpoints/pushApi';
export * from './endpoints/passkeys';
