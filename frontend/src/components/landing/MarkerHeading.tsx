import { Fragment } from 'react';
import { revealStyle, useReveal } from './motion';

interface MarkerHeadingProps {
  /** Texto normal, en letra de cartel. */
  text: string;
  /** Texto final remarcado en el color de acento. */
  marked?: string;
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
  /** El H1 se anima al cargar; el resto, al entrar en pantalla. */
  onLoad?: boolean;
}

/** Cada palabra sube 0,7 em, una detrás de otra, tras una pequeña espera inicial. */
const wordStyle = (index: number) =>
  revealStyle({
    '--from-y': '0.7em',
    '--dur': '0.5s',
    '--step': '55ms',
    '--base': '50ms',
    '--i': index,
  });

/** Titular de cartel que se escribe palabra a palabra, con una parte remarcada en color. */
export default function MarkerHeading({
  text,
  marked,
  as: Tag = 'h2',
  id,
  className = '',
  onLoad = false,
}: MarkerHeadingProps) {
  const ref = useReveal<HTMLDivElement>(onLoad);
  const words = text.split(' ');

  return (
    <div ref={ref}>
      <Tag id={id} className={`poster-title leading-[0.95] ${className}`}>
        {words.map((word, index) => (
          <Fragment key={`${word}-${index}`}>
            {index > 0 ? ' ' : null}
            <span className="inline-block overflow-hidden pt-[0.16em] -mt-[0.16em] pb-[0.08em]">
              <span className="reveal inline-block" style={wordStyle(index)}>
                {word}
              </span>
            </span>
          </Fragment>
        ))}
        {marked ? (
          <>
            {' '}
            <span className="inline-block">
              <span className="reveal marker-ink inline-block" style={wordStyle(words.length)}>
                {marked}
              </span>
            </span>
          </>
        ) : null}
      </Tag>
    </div>
  );
}
