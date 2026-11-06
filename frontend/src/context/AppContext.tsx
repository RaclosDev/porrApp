import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useShallow } from 'zustand/react/shallow';
import {
  fetchMe,
  fetchMyGroups,
  updateUserPreferences,
  whenSessionRestored,
} from '../services/api';
import { SESSION_REVISION_KEY } from '../services/sessionHint';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  useAppStore,
  defaultBracketState,
  getInitialBracketState,
  readGroupVisits,
} from '../store/useAppStore';
import { writeDraft } from '../utils/drafts';
import {
  useActiveLeague,
  useLeagueDataEffects,
  useLeagueRanking,
  useOfficialData,
} from './leagueData';

type StoreState = ReturnType<typeof useAppStore.getState>;

/** Borrador del cuadro: cambia con cada clic, así que solo lo lee quien lo edita. */
const BRACKET_DRAFT_KEYS = [
  'bracketState',
  'setBracketState',
  'topScorer',
  'setTopScorer',
] as const;
type BracketDraftKey = (typeof BRACKET_DRAFT_KEYS)[number];

const withoutBracketDraft = (state: StoreState) =>
  Object.fromEntries(
    Object.entries(state).filter(
      ([key]) => !(BRACKET_DRAFT_KEYS as readonly string[]).includes(key),
    ),
  ) as Omit<StoreState, BracketDraftKey>;

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const userName = useAppStore((state) => state.userName);
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const bracketState = useAppStore((state) => state.bracketState);
  const userId = useAppStore((state) => state.userId);
  const isDemoMode = useAppStore((state) => state.isDemoMode);

  const setUserName = useAppStore((state) => state.setUserName);
  const setUserAvatarUrl = useAppStore((state) => state.setUserAvatarUrl);
  const setUserId = useAppStore((state) => state.setUserId);
  const changeGroup = useAppStore((state) => state.changeGroup);
  const logout = useAppStore((state) => state.logout);
  const setIsAuthenticated = useAppStore((state) => state.setIsAuthenticated);
  const isUserAuthed = useAppStore((state) => state.isAuthenticated);

  useWebSocket(queryClient);
  useLeagueDataEffects();

  // Otra pestaña ha cambiado la cuenta compartida por la cookie. Recargar vacía todo el estado
  // anterior y recupera la identidad nueva sin revocar la sesión de esa otra pestaña.
  useEffect(() => {
    const onSessionChange = (event: StorageEvent) => {
      if (
        event.storageArea === localStorage &&
        (event.key === SESSION_REVISION_KEY || event.key === null)
      )
        window.location.reload();
    };
    window.addEventListener('storage', onSessionChange);
    return () => window.removeEventListener('storage', onSessionChange);
  }, []);

  // api.ts avisa con este evento cuando no ha podido renovar la sesión tras un 401.
  useEffect(() => {
    window.addEventListener('auth-expired', logout);
    return () => window.removeEventListener('auth-expired', logout);
  }, [logout]);

  // El store arranca dando la sesión por buena; si al recuperarla el servidor dice que no hay,
  // se cierra. Sin respuesta del servidor se deja como está y se reintentará en el próximo 401.
  useEffect(() => {
    let active = true;
    whenSessionRestored()?.then((result) => {
      if (!active) return;
      if (result === 'restored') setIsAuthenticated(true);
      else if (result === 'none' && useAppStore.getState().isAuthenticated) logout();
    });
    return () => {
      active = false;
    };
  }, [logout, setIsAuthenticated]);

  useEffect(() => {
    // La demo pública es de solo lectura: no persistir borradores locales.
    if (isDemoMode || !activeGroupId) return;
    // Evitar sobreescribir un draft guardado si bracketState coincide con defaultBracketState vacío
    if (bracketState === defaultBracketState) {
      const existing = getInitialBracketState(activeGroupId, userId);
      if (existing !== defaultBracketState) return;
    }
    const timer = setTimeout(() => {
      writeDraft('bracket', activeGroupId, userId, bracketState);
    }, 300);
    return () => clearTimeout(timer);
  }, [bracketState, activeGroupId, userId, isDemoMode]);

  useEffect(() => {
    let isCancelled = false;
    const autoSelectGroup = async () => {
      const selectedAtStart = useAppStore.getState().activeGroupId;
      if (isDemoMode || !isUserAuthed) return;
      try {
        let dbGroupId = null;
        try {
          const me = await fetchMe();
          if (isCancelled) return;
          dbGroupId = me.lastSelectedGroupId?.toString();
          // El id del servidor manda: es la semilla del avatar y la clave de los borradores.
          setUserId(String(me.userId));
          setUserAvatarUrl(me.avatarUrl || '');
          if (typeof me.profileSetupCompleted === 'boolean')
            useAppStore.getState().setProfileSetupCompleted(me.profileSetupCompleted);
          if (me.participantName && me.participantName !== userName)
            setUserName(me.participantName);
        } catch {
          /* ignore */
        }

        const myGroups = await fetchMyGroups();
        if (
          isCancelled ||
          localStorage.getItem('pendingJoinCode') ||
          useAppStore.getState().activeGroupId !== selectedAtStart
        )
          return;

        if (!myGroups || myGroups.length === 0) {
          localStorage.removeItem('activeGroupId');
          changeGroup('');
        } else {
          // La fuente de verdad es el store (no localStorage): handleGoogleSuccess
          // puede haber escrito la preferencia del servidor sin actualizar el estado.
          const currentStoreGroup = useAppStore.getState().activeGroupId;
          const belongsToCurrent =
            currentStoreGroup && myGroups.some((g) => g.id.toString() === currentStoreGroup);

          if (belongsToCurrent) {
            // El usuario ya tiene una liga válida seleccionada en esta sesión (respetar en F5)
            const currentBracket = useAppStore.getState().bracketState;
            if (currentBracket === defaultBracketState) {
              const saved = getInitialBracketState(
                currentStoreGroup,
                useAppStore.getState().userId,
              );
              if (saved !== defaultBracketState) useAppStore.getState().setBracketState(saved);
            }
            // Si difiere de la preferencia en BD, sincronizamos la BD sin cambiar la selección local
            if (dbGroupId !== currentStoreGroup) {
              updateUserPreferences({ lastSelectedGroupId: Number(currentStoreGroup) }).catch(
                () => {},
              );
            }
          } else if (dbGroupId && myGroups.some((g) => g.id.toString() === dbGroupId)) {
            // No hay selección local válida en esta sesión, usar la preferencia de BD
            changeGroup(dbGroupId);
          } else {
            // Sin preferencia en BD: la última liga visitada en este dispositivo y,
            // si no hay historial, la más reciente por fecha de creación.
            const visits = readGroupVisits();
            const lastVisitedId = Object.entries(visits)
              .sort(([, a], [, b]) => Number(b) - Number(a))
              .map(([id]) => id)
              .find((id) => myGroups.some((g) => g.id.toString() === id));

            if (lastVisitedId) {
              changeGroup(lastVisitedId);
            } else {
              const mostRecent = [...myGroups].sort(
                (a, b) =>
                  new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
              )[0];
              changeGroup(mostRecent.id.toString());
            }
          }
        }
      } catch {
        /* ignore */
      }
    };
    autoSelectGroup();
    return () => {
      isCancelled = true;
    };
  }, [userName, isUserAuthed, changeGroup, isDemoMode, setUserAvatarUrl, setUserName, setUserId]);

  return children;
}

/** Borrador del cuadro y goleador elegido, para el editor del cuadro (useBracket). */
export const useBracketDraft = () =>
  useAppStore(
    useShallow((s) => ({
      bracketState: s.bracketState,
      setBracketState: s.setBracketState,
      topScorer: s.topScorer,
      setTopScorer: s.setTopScorer,
    })),
  );

/**
 * Sesión, liga activa, datos oficiales y ranking en un solo objeto. Para lo que use una sola
 * parte, mejor el hook de esa parte (`useActiveLeague`, `useOfficialData`, `useLeagueRanking`).
 * No incluye el borrador del cuadro (`useBracketDraft`): cambiaría en cada clic del editor.
 */
export const useAppContext = () => {
  const session = useAppStore(useShallow(withoutBracketDraft));
  const league = useActiveLeague();
  const official = useOfficialData();
  const ranking = useLeagueRanking();
  return { ...session, ...league, ...official, ...ranking };
};
