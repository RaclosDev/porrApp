import { useId } from 'react';
import './support.css';

/** Botellas de las baldas: [x, base, color]. */
const BOTTLES = [
  [14, 60, '#2f5d3a'],
  [26, 60, '#111'],
  [38, 60, '#7a3b1d'],
  [50, 60, '#2f5d3a'],
  [152, 46, '#7a3b1d'],
  [176, 46, '#111'],
  [188, 46, '#2f5d3a'],
] as const;

const bottle = (x: number, b: number) =>
  `M${x - 4} ${b}V${b - 10}Q${x - 4} ${b - 13} ${x - 1.5} ${b - 14}V${b - 19}H${x + 1.5}V${b - 14}Q${x + 4} ${b - 13} ${x + 4} ${b - 10}V${b}Z`;

/**
 * El camarero de PorrApp: el mismo muñeco que el crupier, con chaleco, bigote y el trapo al hombro, tirando una caña
 * en la barra. Es decorativo: lo que se agradece ya está escrito debajo.
 */
export default function BarScene() {
  const clip = `bar-glass-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <div className="bar-scene" aria-hidden="true">
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="bar-scene-art">
        <defs>
          <clipPath id={clip}>
            <path d="M101 122H123L120 150H104Z" />
          </clipPath>
          <g id={`${clip}-glove`}>
            <path
              d="M-7 8Q-9 14-6 16H6Q9 14 7 8Z"
              fill="#fff"
              stroke="#111"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
            <circle r="10.5" fill="#fff" stroke="#111" strokeWidth="3" />
            <path
              d="M-4.5-6v6M0-7v7M4.5-6v6"
              stroke="#111"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
        </defs>

        {/* Baldas con botellas a los lados de la cabeza. */}
        <g stroke="#111" strokeWidth="2" strokeLinejoin="round">
          <rect x="6" y="60" width="52" height="5" fill="#8a5a2b" />
          <rect x="142" y="46" width="54" height="5" fill="#8a5a2b" />
          {BOTTLES.map(([x, b, color]) => (
            <g key={x}>
              <path d={bottle(x, b)} fill={color} />
              <rect x={x - 3} y={b - 9} width="6" height="5" fill="#f3ecdc" strokeWidth="1.2" />
            </g>
          ))}
        </g>

        <g className="bar-body">
          {/* El cuello sale del cuerpo y se mete bajo la camisa: al cabecear la cabeza no se despega. */}
          <path d="M92 100V122H108V100" fill="#fff" stroke="#111" strokeWidth="2.6" />
          <path
            d="M62 152Q60 118 100 110Q140 118 138 152Z"
            fill="#fff"
            stroke="#111"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M100 116V138" stroke="#111" strokeWidth="1.2" />
          <circle cx="100" cy="125" r="1.4" fill="#111" />
          <circle cx="100" cy="132" r="1.4" fill="#111" />
          {/* Chaleco. */}
          <path
            d="M65 152Q63 124 86 113L100 139V152ZM135 152Q137 124 114 113L100 139V152Z"
            fill="#141414"
            stroke="#111"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <circle cx="100" cy="145" r="2.2" fill="#fff" stroke="#111" strokeWidth="1.2" />
          {/* Trapo al hombro. */}
          <path
            d="M71 113Q64 118 63 141L73 142Q74 123 81 116Z"
            fill="#fff"
            stroke="#111"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M64 128L73.6 129M63.6 134L73.3 135" stroke="#b5462e" strokeWidth="2" />
          {/* Pajarita. */}
          <g stroke="#111" strokeWidth="2" strokeLinejoin="round">
            <path d="M100 117L87 109Q85 117 87 125ZM100 117L113 109Q115 117 113 125Z" fill="#111" />
            <path
              d="M88.5 112Q87.5 117 88.5 122M111.5 112Q112.5 117 111.5 122"
              stroke="#fff"
              strokeWidth="1.2"
              fill="none"
            />
            <ellipse
              cx="100"
              cy="117"
              rx="3.6"
              ry="4"
              fill="#111"
              stroke="#fff"
              strokeWidth="1.2"
            />
          </g>
        </g>

        <g className="bar-head">
          <circle cx="68" cy="80" r="6.5" fill="#fff" stroke="#111" strokeWidth="2.6" />
          <circle cx="132" cy="80" r="6.5" fill="#fff" stroke="#111" strokeWidth="2.6" />
          <ellipse cx="100" cy="76" rx="32" ry="31" fill="#fff" stroke="#111" strokeWidth="3" />
          {/* Pelo con raya, engominado. */}
          <path
            d="M69 68Q70 44 100 43Q130 44 131 68Q127 57 116 55Q106 53 102 46Q99 52 90 54Q76 56 69 68Z"
            fill="#111"
          />
          <path
            d="M106 49Q116 49 124 56"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.5"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          {/* Ojos abiertos de dibujo de los años 30, con su brillo, y las cejas arriba: está contento. */}
          <ellipse cx="89" cy="80" rx="5.6" ry="9.6" fill="#111" />
          <ellipse cx="111" cy="80" rx="5.6" ry="9.6" fill="#111" />
          <path d="M88.5 74.5l2.6 3.6l-3.2 1.2ZM110.5 74.5l2.6 3.6l-3.2 1.2Z" fill="#fff" />
          <path
            d="M82 66Q89 61.5 96 65.5M104 65.5Q111 61.5 118 66"
            fill="none"
            stroke="#111"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <ellipse cx="100" cy="91" rx="6" ry="4.3" fill="#111" />
          {/* Bigote de manillar y una sonrisa debajo. */}
          <path
            d="M83 93Q85 99 91 96.5Q96 94 100 96.5Q104 94 109 96.5Q115 99 117 93Q116 98 111 99Q104 100 100 98.5Q96 100 89 99Q84 98 83 93Z"
            fill="#111"
          />
          <path
            d="M93 102.5Q100 107 107 102.5"
            fill="none"
            stroke="#111"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>

        {/* Grifo de cerveza delante del camarero, en la barra. */}
        <g stroke="#111" strokeLinejoin="round">
          <path d="M124 117H115Q112 117 112 120V122" fill="none" strokeWidth="6" />
          <path d="M124 117H115Q112 117 112 120V121" fill="none" stroke="#d8d8d8" strokeWidth="3" />
          <rect x="124" y="114" width="13" height="37" rx="3" fill="#d8d8d8" strokeWidth="2.4" />
          <path d="M128 118V147" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" />
        </g>
        <g className="bar-handle">
          <path d="M128 116L127 102Q127 97 130.5 97Q134 97 134 102L133 116Z" fill="#111" />
          <rect
            x="127"
            y="111"
            width="7"
            height="5"
            fill="#d9b45a"
            stroke="#111"
            strokeWidth="1.4"
          />
        </g>

        {/* Caña que se llena bajo el grifo. */}
        <rect className="bar-stream" x="111.2" y="121" width="1.6" height="29" fill="#f2b233" />
        <g clipPath={`url(#${clip})`}>
          <g className="bar-level">
            <rect x="99" y="122" width="26" height="40" fill="#f2b233" />
            <path
              d="M107 146v-2M117 140v-2M112 133v-2"
              stroke="#fff6a8"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <rect x="99" y="120" width="26" height="6" fill="#fff" />
          </g>
        </g>
        <path
          className="bar-foam"
          d="M101 123Q101 115 108 116Q112 112 117 116Q125 116 123 123Z"
          fill="#fff"
          stroke="#111"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M101 122H123L120 150H104Z"
          fill="#fff"
          fillOpacity="0.18"
          stroke="#111"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />

        {/* Brazo izquierdo apoyado junto a la caña servida; el derecho, tirando del grifo. */}
        <path
          d="M72 122Q52 126 50 138"
          fill="none"
          stroke="#111"
          strokeWidth="7.5"
          strokeLinecap="round"
        />
        <g className="bar-arm">
          <path
            d="M137 124Q152 120 135 103"
            fill="none"
            stroke="#111"
            strokeWidth="7.5"
            strokeLinecap="round"
          />
          <use href={`#${clip}-glove`} x="132" y="101" />
        </g>

        {/* Caña servida, con su espuma y burbujas. */}
        <g stroke="#111" strokeLinejoin="round">
          <path d="M29 122H45L42.6 148H31.4Z" fill="#f2b233" strokeWidth="2.4" />
          <path
            d="M29 124Q28 116 34 117Q38 113 42 117Q47 117 45 124Z"
            fill="#fff"
            strokeWidth="2"
          />
          <g className="bar-bubbles" fill="#fff6a8" stroke="none">
            <circle cx="34" cy="144" r="1" />
            <circle cx="39" cy="142" r="0.9" />
            <circle cx="36.5" cy="146" r="0.8" />
          </g>
        </g>
        <use href={`#${clip}-glove`} x="50" y="139" />

        {/* Barra. */}
        <path d="M0 150H200V158H0Z" fill="#a8743f" />
        <path d="M0 150H200M0 158H200" stroke="#111" strokeWidth="3" />
        <rect x="0" y="158" width="200" height="42" fill="#6b4423" />
        <path d="M0 190H200" stroke="#111" strokeWidth="5" />
        <path d="M0 190H200" stroke="#d9b45a" strokeWidth="2.6" />
        <rect
          x="46"
          y="161"
          width="108"
          height="24"
          rx="4"
          fill="#f3ecdc"
          stroke="#111"
          strokeWidth="2.4"
        />
        <text
          x="100"
          y="178"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="900"
          fontSize="13"
          textLength="94"
          lengthAdjust="spacingAndGlyphs"
          fill="#111"
        >
          BAR PORRAPP
        </text>

        <text
          className="bar-salud"
          x="100"
          y="30"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="900"
          fontSize="16"
          fill="#fff6a8"
          stroke="#111"
          strokeWidth="3"
          paintOrder="stroke"
        >
          ¡SALUD!
        </text>
      </svg>
    </div>
  );
}
