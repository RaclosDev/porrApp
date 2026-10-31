/**
 * Borradores locales (sin guardar en el servidor) por usuario y liga.
 *
 * Las claves antiguas (`draft_<tipo>_<liga>`) no llevaban usuario, así que en un dispositivo
 * compartido una persona veía el borrador de otra. Un borrador antiguo se migra al primer
 * usuario que lo lee y desaparece de la clave sin usuario.
 */
import { hasValidGroupSelections, normalizeGroupsDraft, type GroupSelection } from './bracketDraft';

export type DraftKind = 'matchday' | 'bracket' | 'groups' | 'advancing';

const DRAFT_PREFIX = 'draft_';
const ANONYMOUS = 'anon';

export const draftKey = (kind: DraftKind, groupId: string, userId: string): string =>
  `${DRAFT_PREFIX}${kind}_u${userId || ANONYMOUS}_g${groupId}`;

const legacyDraftKey = (kind: DraftKind, groupId: string): string =>
  `${DRAFT_PREFIX}${kind}_${groupId}`;

/** Texto guardado del borrador, o `null` si no hay. */
export function readDraft(kind: DraftKind, groupId: string, userId: string): string | null {
  if (!groupId) return null;
  try {
    const key = draftKey(kind, groupId, userId);
    const current = localStorage.getItem(key);
    if (current !== null) return current;
    const legacyKey = legacyDraftKey(kind, groupId);
    const legacy = localStorage.getItem(legacyKey);
    if (legacy === null) return null;
    localStorage.removeItem(legacyKey);
    localStorage.setItem(key, legacy);
    return legacy;
  } catch {
    return null;
  }
}

/** Borrador ya interpretado como JSON; `undefined` si no hay o está corrupto. */
export function readJsonDraft(kind: DraftKind, groupId: string, userId: string): unknown {
  const raw = readDraft(kind, groupId, userId);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeDraft(kind: DraftKind, groupId: string, userId: string, value: unknown): void {
  if (!groupId) return;
  try {
    localStorage.setItem(draftKey(kind, groupId, userId), JSON.stringify(value));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function removeDraft(kind: DraftKind, groupId: string, userId: string): void {
  try {
    localStorage.removeItem(draftKey(kind, groupId, userId));
    localStorage.removeItem(legacyDraftKey(kind, groupId));
  } catch {
    /* ignore */
  }
}

/** Borra todos los borradores de todos los usuarios (al cerrar sesión). */
export function clearAllDrafts(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* ignore */
  }
}

/** Fase de grupos guardada en local por este usuario para esta liga. */
export const readGroupsDraft = (
  groupId: string,
  userId: string,
): Record<string, GroupSelection> => {
  const raw = readJsonDraft('groups', groupId, userId);
  if (!raw || typeof raw !== 'object') return {};
  const parsed = normalizeGroupsDraft(raw);
  return hasValidGroupSelections(parsed) ? parsed : {};
};

/** undefined: no hay borrador válido; []: el usuario desmarcó todos sus terceros. */
export const readThirdsDraft = (groupId: string, userId: string): string[] | undefined => {
  const raw = readJsonDraft('advancing', groupId, userId);
  return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : undefined;
};
