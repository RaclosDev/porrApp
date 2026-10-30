import type { ReactNode } from 'react';

interface InkStampProps {
  children: ReactNode;
  /** Rojo para lo que cierra o elimina; tinta para lo que pasa; dorado para el campeón. */
  tone?: 'red' | 'ink' | 'gold';
  /** `sm` cabe en una fila de equipo; `md` en una cabecera; `lg` es el de la portada. */
  size?: 'sm' | 'md' | 'lg';
  /** Sobre papel, tapa lo que pisa. */
  paper?: boolean;
  /** Texto para el lector de pantalla cuando el sello va abreviado. */
  label?: string;
  className?: string;
}

/** Sello de tinta estampado, el mismo que marca el campeón en la portada. */
export default function InkStamp({
  children,
  tone = 'red',
  size = 'md',
  paper = false,
  label,
  className = '',
}: InkStampProps) {
  const classes = [
    'ink-stamp',
    tone !== 'red' ? `ink-stamp-${tone}` : '',
    size !== 'lg' ? `ink-stamp-${size}` : '',
    paper ? 'ink-stamp-paper' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (label) {
    return (
      <>
        <span className={classes} aria-hidden="true">
          {children}
        </span>
        <span className="sr-only">{label}</span>
      </>
    );
  }
  return <span className={classes}>{children}</span>;
}
