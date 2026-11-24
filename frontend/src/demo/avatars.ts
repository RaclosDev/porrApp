/**
 * Fotos de perfil de los participantes de la demo: retratos de stock libres (randomuser.me), uno
 * por persona, para que clasificaciones y podios se vean como en una liga de verdad.
 */
const PORTRAITS = 'https://randomuser.me/api/portraits';

/** Por el id de demo (DemoAnonymizer, a partir de 101), no por el de la cuenta real. */
const AVATARS: Record<number, string> = {
  101: `${PORTRAITS}/men/32.jpg`, // Dani
  102: `${PORTRAITS}/women/44.jpg`, // Noa
  103: `${PORTRAITS}/women/65.jpg`, // Alba
  104: `${PORTRAITS}/men/75.jpg`, // Marcos
  105: `${PORTRAITS}/women/68.jpg`, // Marta
  106: `${PORTRAITS}/women/12.jpg`, // Sara
  107: `${PORTRAITS}/men/46.jpg`, // Leo
  108: `${PORTRAITS}/men/22.jpg`, // Nico
  109: `${PORTRAITS}/men/52.jpg`, // Pablo
  110: `${PORTRAITS}/men/85.jpg`, // Toni
  111: `${PORTRAITS}/women/26.jpg`, // Clara
  112: `${PORTRAITS}/women/90.jpg`, // Aitana
  113: `${PORTRAITS}/women/33.jpg`, // Nerea
  114: `${PORTRAITS}/women/57.jpg`, // Irene
  115: `${PORTRAITS}/men/11.jpg`, // Mateo
  116: `${PORTRAITS}/women/79.jpg`, // Carla
  117: `${PORTRAITS}/men/64.jpg`, // Adri
  118: `${PORTRAITS}/men/41.jpg`, // Óscar
  119: `${PORTRAITS}/women/21.jpg`, // Julia
  120: `${PORTRAITS}/men/36.jpg`, // Álex
  121: `${PORTRAITS}/men/18.jpg`, // Javi
  122: `${PORTRAITS}/men/94.jpg`, // Hugo
  123: `${PORTRAITS}/women/50.jpg`, // Vega
};

export function demoAvatar(userId: unknown): string | null {
  return typeof userId === 'number' ? (AVATARS[userId] ?? null) : null;
}

// Foto de cada liga de la demo, por id de grupo: las ligas reales suelen tener una.
const LEAGUE_IMAGES: Record<number, string> = {
  1: '/demo-ligas/mundial.svg',
  6: '/demo-ligas/laliga.svg',
  39: '/demo-ligas/ufc.svg',
};

/** Rellena las fotos que faltan: personas (`userId` + `avatarUrl`) y ligas (`adminUserId` + `imageUrl`). */
export function withAvatars<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withAvatars) as T;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => [key, withAvatars(item)]);
    const record = Object.fromEntries(entries) as Record<string, unknown>;
    if ('avatarUrl' in record && record.avatarUrl == null) {
      record.avatarUrl = demoAvatar(record.userId);
    }
    if ('adminUserId' in record && 'imageUrl' in record && record.imageUrl == null) {
      record.imageUrl = typeof record.id === 'number' ? (LEAGUE_IMAGES[record.id] ?? null) : null;
    }
    return record as T;
  }
  return value;
}
