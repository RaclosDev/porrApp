import { useState, useEffect, type ReactNode } from 'react';
import BoringAvatar from 'boring-avatars';

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

/** Colores de la app para los avatares generados. */
const GENERATED_AVATAR_COLORS = ['#00d2d3', '#f368e0', '#ff9f43', '#feca57', '#54a0ff'];

/**
 * Semilla estable del avatar generado: el id si se conoce (no cambia al renombrarse),
 * si no el nombre.
 */
function avatarSeed(userId?: number | string | null, name?: string | null): string {
  if (userId !== null && userId !== undefined && String(userId) !== '') return `user-${userId}`;
  return name?.trim() || 'anonimo';
}

/**
 * Foto de perfil; sin foto (o si falla la carga) muestra un avatar generado en el cliente
 * a partir del id o del nombre. Es decorativa junto al nombre, así que no lleva texto alternativo.
 */
export function UserAvatar({
  url,
  name,
  userId,
  size = 32,
}: {
  url: string | null | undefined;
  name?: string | null;
  userId?: number | string | null;
  size?: number;
}) {
  return (
    <Img
      src={url}
      size={size}
      radius="50%"
      fallback={
        <BoringAvatar
          name={avatarSeed(userId, name)}
          variant="beam"
          colors={GENERATED_AVATAR_COLORS}
          size={size}
          aria-hidden="true"
          data-testid="avatar-generated"
        />
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
