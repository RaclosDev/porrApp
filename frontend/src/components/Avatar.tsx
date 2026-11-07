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

/** Número de tintas de avatar definidas en paper.css (`.user-avatar-ink[data-ink]`). */
const AVATAR_INKS = 5;

const LETTER = /\p{L}/u;

/**
 * Letras del avatar: las iniciales de las dos primeras palabras («Giorgi Winamax» → «GW») o,
 * con una sola palabra, sus dos primeras letras («Jaime» → «Ja», «Jokin» → «Jo»), para que dos
 * nombres con la misma inicial no se confundan. Si empieza por un emoji, el emoji solo.
 */
export function avatarLetters(name?: string | null): string {
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => Array.from(word))
    .filter((chars) => chars.length > 0 && !/^\p{P}+$/u.test(chars.join('')));
  const first = words[0];
  if (!first) return '?';
  if (!LETTER.test(first[0])) return first[0];
  const second = words[1]?.[0];
  if (second && LETTER.test(second)) {
    return (first[0] + second).toLocaleUpperCase('es');
  }
  const next = first[1] && LETTER.test(first[1]) ? first[1].toLocaleLowerCase('es') : '';
  return first[0].toLocaleUpperCase('es') + next;
}

/**
 * Tinta estable del avatar: sale del id si se conoce (no cambia al renombrarse) y si no del
 * nombre, para que también se distinga por color a quien comparte letras.
 */
export function avatarInk(userId?: number | string | null, name?: string | null): number {
  const seed =
    userId !== null && userId !== undefined && String(userId) !== ''
      ? `user-${userId}`
      : name?.trim() || '';
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash % AVATAR_INKS;
}

/**
 * Foto de perfil; sin foto (o si falla la carga) muestra las letras del nombre escritas a
 * rotulador, como el resto de la app, en una tinta propia de cada usuario. Es decorativa junto
 * al nombre, así que no lleva texto alternativo.
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
  const letters = avatarLetters(name);
  return (
    <Img
      src={url}
      size={size}
      radius="50%"
      fallback={
        <span
          className="user-avatar-ink relative w-full h-full rounded-full bg-[rgba(255,_255,_255,_0.06)] flex items-center justify-center leading-[1]"
          style={{ fontSize: Math.round(size * (Array.from(letters).length > 1 ? 0.4 : 0.52)) }}
          data-ink={avatarInk(userId, name)}
          aria-hidden="true"
          data-testid="avatar-generated"
        >
          {/* Aro en el color de la tinta; sin color-mix(), que html2canvas no sabe leer. */}
          <span className="absolute inset-0 rounded-full border-[1.5px] border-current opacity-35" />
          {letters}
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
