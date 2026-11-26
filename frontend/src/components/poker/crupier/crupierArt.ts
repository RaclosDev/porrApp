/** Dibujo del crupier de PorrApp (dibujos animados de los años 30, en blanco y negro con sepia). */

const FACE =
  '<ellipse cx="89" cy="80" rx="5.6" ry="9.6" fill="#111"/><ellipse cx="111" cy="80" rx="5.6" ry="9.6" fill="#111"/>\n<path d="M82 68 H97 V78.5 Q89 75 82 78.5Z M104 68 H119 V78.5 Q111 75 104 78.5Z" fill="#fff"/>\n<path d="M82 78 Q89 74.5 96.5 78 M103.5 78 Q111 74.5 118 78" fill="none" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>\n<path d="M91 81 h2.4 M113 81 h2.4" stroke="#111" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>\n<ellipse cx="100" cy="89" rx="6" ry="4.3" fill="#111"/>\n<path d="M83 99 Q100 108 119 95" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>\n<path d="M119 95 q3 1 2.6 4.6" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>';

/** Sombreros: la visera verde es la de serie; el resto se desbloqueará con las ligas que donen. */
const HATS = {
  verde:
    '<path d="M66 60 Q100 42 134 60 L136 66 Q100 50 64 66Z" fill="#111" stroke="#111" stroke-width="2" stroke-linejoin="round"/>\n<path d="M64 66 Q100 50 136 66 L150 74 Q100 54 50 74Z" fill="#27a35c" fill-opacity="0.9" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/>\n<path d="M58 70 Q100 54 142 70" fill="none" stroke="#c9ffd9" stroke-opacity="0.55" stroke-width="1.4"/>',
  gris: '<path d="M66 60 Q100 42 134 60 L136 66 Q100 50 64 66Z" fill="#111" stroke="#111" stroke-width="2" stroke-linejoin="round"/>\n<path d="M64 66 Q100 50 136 66 L150 74 Q100 54 50 74Z" fill="#b8b8b8" fill-opacity="0.75" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/>\n<path d="M58 70 Q100 54 142 70" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.4"/>',
  canotier:
    '<path d="M73 57 L75 36 Q100 31 125 36 L127 57Z" fill="#e9dcae" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/>\n<path d="M75 36 Q100 41 125 36" fill="none" stroke="#111" stroke-width="2"/>\n<path d="M74 47 Q100 52 126 47 L127 56 Q100 61 73 56Z" fill="#111"/>\n<path d="M79 40 v6 M86 41 v6 M93 42 v5 M107 42 v5 M114 41 v6 M121 40 v6" stroke="#b9a874" stroke-width="1.2"/>\n<ellipse cx="100" cy="59" rx="45" ry="7.5" fill="#e9dcae" stroke="#111" stroke-width="2.6"/>\n<path d="M60 59 Q100 65 140 59" fill="none" stroke="#b9a874" stroke-width="1.2"/>',
  bombin:
    '<path d="M72 59 Q70 27 100 26 Q130 27 128 59Z" fill="#141414" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/>\n<path d="M83 36 Q92 29 104 30" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="2.4" stroke-linecap="round"/>\n<path d="M73 52 Q100 57 127 52 L128 58 Q100 63 72 58Z" fill="#3a3a3a"/>\n<path d="M60 58 Q100 52 140 58 Q146 61 140 64 Q100 57 60 64 Q54 61 60 58Z" fill="#141414" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/>',
};

export type CrupierHat = keyof typeof HATS;

function draw(hat: CrupierHat) {
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="spot" cx="50%" cy="30%" r="55%"><stop offset="0" stop-color="#fff6dc" stop-opacity="0.9"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>
    <g id="glove">
      <path d="M-7 8 Q-9 14 -6 16 H6 Q9 14 7 8Z" fill="#fff" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/>
      <circle r="10.5" fill="#fff" stroke="#111" stroke-width="3"/>
      <path d="M-4.5 -6 v6 M0 -7 v7 M4.5 -6 v6" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>
    </g>
    <g id="card"><rect x="-6.5" y="-9" width="13" height="18" rx="2" fill="#fff" stroke="#111" stroke-width="1.8"/><path d="M0 -4 l3 4 -3 4 -3 -4Z" fill="#111"/></g>
    <g id="chip"><circle r="9" fill="#27a35c" stroke="#111" stroke-width="2"/><circle r="6.6" fill="none" stroke="#fff" stroke-width="2.6" stroke-dasharray="3.4 3.4"/><circle r="3.6" fill="#fff" stroke="#111" stroke-width="1.2"/></g>
    <path id="spark" d="M0 -6 Q1 -1 6 0 Q1 1 0 6 Q-1 1 -6 0 Q-1 -1 0 -6Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
  </defs>
  <g>
    <g class="scene-wall"><rect width="200" height="200" fill="#d9cdaa"/>
    <g fill="#cbbe98"><path d="M100 40 L72 0 H128Z M100 40 L18 0 H44Z M100 40 L156 0 H182Z M100 40 L0 26 V60Z M100 40 L200 26 V60Z"/></g>
    <ellipse cx="100" cy="70" rx="80" ry="70" fill="url(#spot)"/></g>
    <g class="body">
      <path d="M64 170 Q60 118 100 110 Q140 118 136 170Z" fill="#141414" stroke="#111" stroke-width="3" stroke-linejoin="round"/>
      <path d="M88 112 L100 146 L112 112 Q100 116 88 112Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M88 112 L80 120 L92 136 Z M112 112 L120 120 L108 136Z" fill="#2c2c2c" stroke="#111" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="100" cy="130" r="1.6" fill="#111"/><circle cx="100" cy="138" r="1.6" fill="#111"/>
      <circle cx="100" cy="154" r="2.6" fill="#fff" stroke="#111" stroke-width="1.4"/><circle cx="100" cy="163" r="2.6" fill="#fff" stroke="#111" stroke-width="1.4"/>
      <path d="M118 128 h9 l-1 4 h-7Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
      <g stroke="#111" stroke-width="2" stroke-linejoin="round">
        <path d="M100 117 L87 109 Q85 117 87 125Z M100 117 L113 109 Q115 117 113 125Z" fill="#111"/>
        <path d="M88.5 112 Q87.5 117 88.5 122 M111.5 112 Q112.5 117 111.5 122" stroke="#fff" stroke-width="1.2" fill="none"/>
        <ellipse cx="100" cy="117" rx="3.6" ry="4" fill="#111" stroke="#fff" stroke-width="1.2"/>
      </g>
    </g>
    <g class="head">
      <path d="M92 104 V112 H108 V104" fill="#fff" stroke="#111" stroke-width="2.6"/>
      <circle cx="68" cy="80" r="6.5" fill="#fff" stroke="#111" stroke-width="2.6"/>
      <circle cx="132" cy="80" r="6.5" fill="#fff" stroke="#111" stroke-width="2.6"/>
      <ellipse cx="100" cy="76" rx="32" ry="31" fill="#fff" stroke="#111" stroke-width="3"/>
      <path d="M69 68 Q70 44 100 43 Q130 44 131 68 Q124 58 114 60 Q108 52 100 56 Q92 52 86 60 Q76 58 69 68Z" fill="#111"/>
      <g class="visor">${HATS[hat]}
      </g>
      <g class="face">${FACE}</g>
    </g>
    <path d="M0 166 H200 V200 H0Z" fill="#6e6e6e"/>
    <path d="M0 166 H200" stroke="#111" stroke-width="3"/>
    <path d="M0 172 H200" stroke="#2a2a2a" stroke-width="6"/>
    <path d="M18 190 Q100 178 182 190" fill="none" stroke="#e9dcb8" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="4 4"/>
    <g stroke="#111" stroke-width="2" stroke-linejoin="round">
      <rect x="84" y="176" width="15" height="20" rx="2" fill="#fff" transform="rotate(-6 91 186)"/>
      <rect x="101" y="176" width="15" height="20" rx="2" fill="#fff" transform="rotate(5 108 186)"/>
      <path d="M105 181 l3 4 -3 4 -3 -4Z" fill="#111" stroke="none"/>
      <ellipse cx="172" cy="190" rx="12" ry="5" fill="#fff"/><ellipse cx="172" cy="185" rx="12" ry="5" fill="#111"/><ellipse cx="172" cy="180" rx="12" ry="5" fill="#fff"/>
      <ellipse cx="172" cy="180" rx="7" ry="2.6" fill="none" stroke-dasharray="2 2" stroke-width="1.4"/>
    </g>
    <g class="props">
      <path class="p-rope" fill="none" stroke="#7a5a2e" stroke-width="2.6" stroke-linecap="round"/>
      <use class="p-card" href="#card"/>
      <use class="p-sh0" href="#card"/><use class="p-sh1" href="#card"/><use class="p-sh2" href="#card"/><use class="p-sh3" href="#card"/><use class="p-sh4" href="#card"/><use class="p-sh5" href="#card"/><use class="p-sh6" href="#card"/>
      <use class="p-chip" href="#chip"/>
      <path class="p-chain" fill="none" stroke="#b08a3c" stroke-width="1.8" stroke-dasharray="2.4 1.6"/>
      <g class="p-watch">
        <rect x="-2.5" y="-16" width="5" height="5" rx="1.5" fill="#d9b45a" stroke="#111" stroke-width="1.6"/>
        <circle r="11.5" fill="#fff" stroke="#111" stroke-width="2.6"/>
        <circle r="8.6" fill="none" stroke="#111" stroke-width="0.8" stroke-dasharray="1 3.5"/>
        <path class="p-watchhand" d="M0 0 V-7.5" stroke="#111" stroke-width="2" stroke-linecap="round"/>
        <path d="M0 0 H4.5" stroke="#111" stroke-width="2" stroke-linecap="round"/>
        <circle r="1.4" fill="#111"/>
      </g>
      <g class="p-cup">
        <path d="M-9 -9 H9 L7 7 Q0 10 -7 7Z" fill="#fff" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M9 -5 Q15 -4 13 2 Q11 5 8 4" fill="none" stroke="#111" stroke-width="2.2"/>
        <path d="M-8 -3 H8" stroke="#27a35c" stroke-width="2.4"/>
      </g>
      <g class="p-register">
        <path d="M14 166 V140 Q14 136 18 136 H58 Q62 136 62 140 V166Z" fill="#fff" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/>
        <rect x="22" y="124" width="26" height="13" rx="2" fill="#111"/>
        <text x="35" y="134" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="9" fill="#fff6a8">20€</text>
        <g fill="#fff" stroke="#111" stroke-width="1.4"><circle cx="24" cy="146" r="3"/><circle cx="33" cy="146" r="3"/><circle cx="42" cy="146" r="3"/><circle cx="24" cy="154" r="3"/><circle cx="33" cy="154" r="3"/><circle cx="42" cy="154" r="3"/></g>
        <path d="M52 142 V158" stroke="#111" stroke-width="3" stroke-linecap="round"/>
        <g class="p-drawer"><rect x="12" y="160" width="52" height="9" rx="1.5" fill="#27a35c" stroke="#111" stroke-width="2.4"/><circle cx="38" cy="164.5" r="1.8" fill="#111"/></g>
      </g>
      <g class="p-gun">
        <path d="M-2 2 Q-8 14 -4 18 L4 18 Q2 10 6 4Z" fill="#6b4a2b" stroke="#111" stroke-width="2" stroke-linejoin="round"/>
        <rect x="12" y="-10" width="22" height="5.5" rx="1.5" fill="#b5b5b5" stroke="#111" stroke-width="2"/>
        <rect x="2" y="-12" width="12" height="11" rx="3" fill="#8d8d8d" stroke="#111" stroke-width="2"/>
        <path d="M31 -10 v-3 M2 -10 l-5 -4" stroke="#111" stroke-width="2.4" stroke-linecap="round"/>
        <path class="p-flash" d="M36 -7 l8 -7 -1 5 10 0 -9 4 6 6 -9 -3 -1 7 -3 -7Z" fill="#fff6a8" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>
      </g>
    </g>
    <path class="armL" fill="none" stroke="#111" stroke-width="7.5" stroke-linecap="round"/>
    <path class="armR" fill="none" stroke="#111" stroke-width="7.5" stroke-linecap="round"/>
    <g class="p-sign"><rect x="-62" y="-16" width="124" height="32" rx="4" fill="#fff" stroke="#111" stroke-width="3"/><text x="0" y="7" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="17" fill="#111">¡GRACIAS!</text></g>
    <use class="gloveL" href="#glove"/>
    <use class="gloveR" href="#glove"/>
    <g class="fx">
      <g class="p-bell">
        <path d="M150 -60 V12" stroke="#111" stroke-width="2.4"/>
        <g class="p-bellbody">
          <path d="M150 12 Q138 14 138 30 Q138 38 133 42 H167 Q162 38 162 30 Q162 14 150 12Z" fill="#fff" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/>
          <path d="M143 24 Q143 18 147 16" fill="none" stroke="#111" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="150" cy="44" r="3.2" fill="#111"/>
        </g>
      </g>
      <text class="p-ding" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="12" fill="#fff" stroke="#111" stroke-width="3" paint-order="stroke">¡DING!</text>
      <text class="p-bang" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="14" fill="#fff6a8" stroke="#111" stroke-width="3" paint-order="stroke">¡BANG!</text>
      <g class="p-smoke" fill="#fff" fill-opacity="0.85" stroke="#111" stroke-width="1.4"><circle class="s0" r="4"/><circle class="s1" r="5"/><circle class="s2" r="6"/></g>
      <g class="p-sparks"><use class="k0" href="#spark"/><use class="k1" href="#spark"/><use class="k2" href="#spark"/></g>
      <use class="p-fly" href="#card"/>
      <g class="p-steam" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"><path class="v0" d="M0 0 q-4 -5 0 -10 q4 -5 0 -10"/><path class="v1" d="M0 0 q-4 -5 0 -10 q4 -5 0 -10"/><path class="v2" d="M0 0 q-4 -5 0 -10 q4 -5 0 -10"/></g>
      <g class="p-coins"><use class="c0" href="#chip"/><use class="c1" href="#chip"/><use class="c2" href="#chip"/><use class="c3" href="#chip"/></g>
      <g class="p-zzz" font-family="Georgia, serif" font-weight="900" fill="#fff" stroke="#111" stroke-width="2.6" paint-order="stroke" text-anchor="middle"><text class="z0" font-size="13">Z</text><text class="z1" font-size="13">z</text><text class="z2" font-size="13">Z</text></g>
      <text class="p-wake" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="22" fill="#fff6a8" stroke="#111" stroke-width="3" paint-order="stroke">¡!</text>
      <text class="p-min" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="13" fill="#fff" stroke="#111" stroke-width="3" paint-order="stroke">¡1 MIN!</text>
      <text class="p-break" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="12" fill="#fff" stroke="#111" stroke-width="3" paint-order="stroke">DESCANSO</text>
      <text class="p-ching" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="14" fill="#fff6a8" stroke="#111" stroke-width="3" paint-order="stroke">¡CHING!</text>
    </g>
  </g>
</svg>
<svg class="crupier-grain" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 0.18 0 0 0 0 0.13 0 0 0 0 0.04 0 0 0 0.32 0"/></filter>
    <radialGradient id="vig" cx="50%" cy="42%" r="62%"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1d0a" stop-opacity="0.55"/></radialGradient>
  </defs>
  <rect width="200" height="200" filter="url(#grain)"/>
  <rect width="200" height="200" fill="url(#vig)"/>
</svg>`;
}

/** SVG del crupier con los id únicos por instancia, para que varios en la misma página no se pisen. */
export function crupierMarkup(suffix: string, hat: CrupierHat = 'verde') {
  return draw(hat)
    .replace(/id="([\w-]+)"/g, `id="$1${suffix}"`)
    .replace(/url\(#([\w-]+)\)/g, `url(#$1${suffix})`)
    .replace(/href="#([\w-]+)"/g, `href="#$1${suffix}"`);
}
