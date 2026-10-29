import { useState, useEffect, type ReactNode } from 'react';

interface ImgProps {
  src: string | null | undefined;
  size: number;
  radius: number | string;
  fallback: ReactNode;
  label?: string;
}

function Img({ src, size, radius, fallback, label = '' }: ImgProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const box = {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: radius,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
  if (src && !failed) {
    return (
      <span style={box} data-testid="avatar-image">
        <img
          className="w-full h-full object-cover block"
          src={src}
          alt={label || ''}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return <span style={box}>{fallback}</span>;
}

/** Foto de perfil con inicial como respaldo. `alt` vacío por defecto: es decorativa junto al nombre. */
export function UserAvatar({
  url,
  name,
  size = 32,
}: {
  url: string | null | undefined;
  name?: string | null;
  size?: number;
}) {
  return (
    <Img
      src={url}
      size={size}
      radius="50%"
      fallback={
        <span
          className="w-full h-full bg-[rgba(0,_210,_211,_0.15)] bg-none text-[#00d2d3] flex items-center justify-center font-bold"
          style={{ fontSize: Math.max(11, Math.round(size * 0.42)) }}
        >
          {name ? name.charAt(0).toUpperCase() : 'U'}
        </span>
      }
    />
  );
}

/** Imagen de liga con un emoji (insignia de la competición) como respaldo. */
export function LeagueAvatar({
  url,
  badge = '🏆',
  size = 32,
}: {
  url: string | null | undefined;
  badge?: string;
  size?: number;
}) {
  return (
    <Img
      src={url}
      size={size}
      radius={Math.round(size * 0.28)}
      fallback={
        <span
          className="w-full h-full bg-[rgba(255,_255,_255,_0.06)] bg-none flex items-center justify-center leading-[1]"
          style={{ fontSize: Math.round(size * 0.6) }}
        >
          {badge}
        </span>
      }
    />
  );
}
