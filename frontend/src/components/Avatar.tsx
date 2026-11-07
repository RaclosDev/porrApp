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

/** Inicial del nombre (primer carácter completo, para no partir tildes ni emojis). */
function initialOf(name?: string | null): string {
  const first = Array.from(name?.trim() ?? '')[0];
  return first ? first.toLocaleUpperCase('es') : '?';
}

/**
 * Foto de perfil; sin foto (o si falla la carga) muestra la inicial del nombre escrita a
 * rotulador, como el resto de la app. Es decorativa junto al nombre, así que no lleva texto
 * alternativo.
 */
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
          className="marker-ink relative w-full h-full rounded-full bg-[rgba(255,_255,_255,_0.06)] flex items-center justify-center leading-[1]"
          style={{ fontSize: Math.round(size * 0.52) }}
          aria-hidden="true"
          data-testid="avatar-generated"
        >
          {/* Aro en el color de la tinta; sin color-mix(), que html2canvas no sabe leer. */}
          <span className="absolute inset-0 rounded-full border-[1.5px] border-current opacity-35" />
          {initialOf(name)}
        </span>
      }
    />
  );
}

/**
 * Imagen de liga. Sin imagen muestra la bandera de su competición si la tiene y, si no, la
 * inicial de la liga como monograma en letra de cartel.
 */
export function LeagueAvatar({
  url,
  badge,
  name,
  size = 32,
}: {
  url: string | null | undefined;
  badge?: string | null;
  name?: string | null;
  size?: number;
}) {
  const monogram = name?.trim().charAt(0).toLocaleUpperCase('es') || 'P';
  return (
    <Img
      src={url}
      size={size}
      radius={Math.round(size * 0.28)}
      fallback={
        <span
          className={`w-full h-full bg-[rgba(255,_255,_255,_0.06)] bg-none flex items-center justify-center leading-[1] ${badge ? '' : 'poster-title'}`}
          style={{ fontSize: Math.round(size * (badge ? 0.6 : 0.5)) }}
          aria-hidden="true"
        >
          {badge || monogram}
        </span>
      }
    />
  );
}
