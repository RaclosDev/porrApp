const ESPN_TEAM_LOGO = /^https:\/\/a\.espncdn\.com\/i\/teamlogos\/([^?#]+)$/;

/** Lado en píxeles del escudo pedido: cubre los escudos más grandes de la app en pantallas 2x. */
const LOGO_PX = 96;

/**
 * Los escudos de ESPN llegan a 500 px (hasta 230 KB cada uno) y la app los pinta a 20-48 px.
 * Su redimensionador devuelve el mismo escudo al tamaño pedido; el resto de URLs no cambia.
 */
export const smallTeamLogo = (url: string): string => {
  const match = ESPN_TEAM_LOGO.exec(url);
  return match
    ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${match[1]}&w=${LOGO_PX}&h=${LOGO_PX}`
    : url;
};
