import { Fragment } from 'react';
import { revealStyle, useReveal } from './motion';

interface MarkerHeadingProps {
  /** Texto normal, en letra de cartel. */
  text: string;
  /** Texto final remarcado a rotulador; se subraya cuando el titular ya está escrito. */
  marked?: string;
  as?: 'h1' | 'h2';
  /** Alineación del subrayado con el texto de cartel, que es más alto que el de rotulador. */
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

/** Titular de cartel que se escribe palabra a palabra, con una parte remarcada a rotulador. */
export default function MarkerHeading({
  text,
  marked,
  as: Tag = 'h2',
  className = '',
  onLoad = false,
}: MarkerHeadingProps) {
  const ref = useReveal<HTMLDivElement>(onLoad);
  const words = text.split(' ');

  return (
    <div ref={ref}>
      <Tag className={`poster-title leading-[0.95] ${className}`}>
        {words.map((word, index) => (
          <Fragment key={`${word}-${index}`}>
            {index > 0 ? ' ' : null}
            <span className="inline-block overflow-hidden pb-[0.08em]">
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
              <span
                className="reveal marker-ink relative inline-block"
                style={wordStyle(words.length)}
              >
                {marked}
                <svg
                  className="absolute left-[-2%] bottom-[-0.1em] w-[104%] h-[0.3em]"
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8 C 20 4, 45 10, 60 6 S 90 3, 98 7"
                    pathLength={1}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    className="marker-stroke"
                    style={revealStyle({ '--words': words.length })}
                  />
                </svg>
              </span>
            </span>
          </>
        ) : null}
      </Tag>
    </div>
  );
}
