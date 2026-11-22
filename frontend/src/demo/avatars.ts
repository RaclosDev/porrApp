/**
 * Fotos de perfil de los participantes de la demo: retratos de stock libres (randomuser.me), uno
 * por persona, para que clasificaciones y podios se vean como en una liga de verdad.
 */
const PORTRAITS = 'https://randomuser.me/api/portraits';

const AVATARS: Record<number, string> = {
  1: `${PORTRAITS}/men/32.jpg`, // Dani
  3: `${PORTRAITS}/women/44.jpg`, // Noa
  5: `${PORTRAITS}/women/65.jpg`, // Alba
  6: `${PORTRAITS}/men/75.jpg`, // Marcos
  7: `${PORTRAITS}/women/68.jpg`, // Marta
  8: `${PORTRAITS}/women/12.jpg`, // Sara
  9: `${PORTRAITS}/men/46.jpg`, // Leo
  10: `${PORTRAITS}/men/22.jpg`, // Nico
  11: `${PORTRAITS}/men/52.jpg`, // Pablo
  12: `${PORTRAITS}/men/85.jpg`, // Toni
  13: `${PORTRAITS}/women/26.jpg`, // Clara
  14: `${PORTRAITS}/women/90.jpg`, // Aitana
  15: `${PORTRAITS}/women/33.jpg`, // Nerea
  17: `${PORTRAITS}/women/57.jpg`, // Irene
  18: `${PORTRAITS}/men/11.jpg`, // Mateo
  19: `${PORTRAITS}/women/79.jpg`, // Carla
  20: `${PORTRAITS}/men/64.jpg`, // Adri
  21: `${PORTRAITS}/men/41.jpg`, // Óscar
  22: `${PORTRAITS}/women/21.jpg`, // Julia
  23: `${PORTRAITS}/men/36.jpg`, // Álex
  24: `${PORTRAITS}/men/18.jpg`, // Javi
  25: `${PORTRAITS}/men/94.jpg`, // Hugo
  29: `${PORTRAITS}/women/50.jpg`, // Vega
};

export function demoAvatar(userId: unknown): string | null {
  return typeof userId === 'number' ? (AVATARS[userId] ?? null) : null;
}

/** Rellena las fotos que faltan en cualquier objeto con `userId` y `avatarUrl`. */
export function withAvatars<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withAvatars) as T;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, withAvatars(item)]);
    const record = Object.fromEntries(entries) as Record<string, unknown>;
    if ('avatarUrl' in record && record.avatarUrl == null) {
      record.avatarUrl = demoAvatar(record.userId);
    }
    return record as T;
  }
  return value;
}
