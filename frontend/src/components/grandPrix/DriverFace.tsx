import { useState, type CSSProperties } from 'react';

/** «Max Verstappen» → «MV»; «K. Antonelli» → «KA». */
const initials = (name: string) =>
  name
    .replace(/\./g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

const teamRing = (color: string | null | undefined, size: number) =>
  ({
    width: size,
    height: size,
    '--gp-team': color ? `#${color}` : 'var(--border-color)',
  }) as CSSProperties;

/**
 * Cara del piloto (foto de ESPN) con un aro del color de su escudería. Si no hay foto o no carga (un
 * piloto recién llegado), sus iniciales.
 */
export function DriverFace({
  name,
  url,
  color,
  size = 32,
}: {
  name: string;
  url?: string | null;
  color?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        className="gp-face"
        src={url}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        style={teamRing(color, size)}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className="gp-face is-initials"
      aria-hidden="true"
      style={{ ...teamRing(color, size), fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

/** Colores claros (el amarillo de Alpine) llevan el texto oscuro para que se lea. */
function isLight(hex: string): boolean {
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55;
}

/**
 * Escudo de una escudería: ESPN no publica sus logos, así que se pinta con su color y sus iniciales.
 */
export function TeamCrest({
  name,
  color,
  size = 28,
}: {
  name: string;
  color: string | null;
  size?: number;
}) {
  return (
    <span
      className="gp-crest"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.36),
        background: color ? `#${color}` : 'var(--text-muted)',
        color: color && isLight(color) ? '#111827' : '#ffffff',
      }}
    >
      {initials(name)}
    </span>
  );
}
