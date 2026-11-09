import { createElement, type CSSProperties, type HTMLAttributes } from 'react';
import { useReveal } from './motion';

interface RevealProps extends Omit<HTMLAttributes<HTMLElement>, 'onLoad'> {
  as?: 'div' | 'article' | 'section' | 'ol' | 'ul';
  /** Se anima al cargar en vez de al entrar en pantalla. */
  onLoad?: boolean;
  /** Contenedor de elementos `.reveal`: ellos se animan, él no. */
  group?: boolean;
  style?: CSSProperties;
}

/** Bloque que sube y aparece una sola vez (ver `landing-motion.css`). */
export default function Reveal({
  as = 'div',
  onLoad = false,
  group = false,
  className = '',
  ...rest
}: RevealProps) {
  const ref = useReveal<HTMLElement>(onLoad);
  return createElement(as, { ...rest, ref, className: group ? className : `reveal ${className}` });
}
