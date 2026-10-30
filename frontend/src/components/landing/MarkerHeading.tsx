import { Fragment } from 'react';
import { motion } from 'motion/react';
import { inViewOnce, useLandingMotion, wordItem, wordsContainer } from './motion';

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

/** Titular de cartel que se escribe palabra a palabra, con una parte remarcada a rotulador. */
export default function MarkerHeading({
  text,
  marked,
  as: Tag = 'h2',
  className = '',
  onLoad = false,
}: MarkerHeadingProps) {
  const { reduced } = useLandingMotion();
  const words = text.split(' ');
  const trigger = onLoad ? { animate: 'show' as const } : { whileInView: 'show' as const };

  return (
    <motion.div
      variants={wordsContainer}
      initial={reduced ? 'show' : 'hidden'}
      viewport={inViewOnce}
      {...trigger}
    >
      <Tag className={`landing-display leading-[0.95] ${className}`}>
        {words.map((word, index) => (
          <Fragment key={`${word}-${index}`}>
            {index > 0 ? ' ' : null}
            <span className="inline-block overflow-hidden pb-[0.08em]">
              <motion.span variants={wordItem} className="inline-block">
                {word}
              </motion.span>
            </span>
          </Fragment>
        ))}
        {marked ? (
          <>
            {' '}
            <span className="inline-block">
              <motion.span variants={wordItem} className="landing-marker relative inline-block">
                {marked}
                <motion.svg
                  className="absolute left-[-2%] bottom-[-0.1em] w-[104%] h-[0.3em]"
                  viewBox="0 0 100 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <motion.path
                    d="M2 8 C 20 4, 45 10, 60 6 S 90 3, 98 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                    initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
                    variants={{
                      show: {
                        pathLength: 1,
                        transition: { duration: 0.5, delay: 0.1 + words.length * 0.055 },
                      },
                    }}
                  />
                </motion.svg>
              </motion.span>
            </span>
          </>
        ) : null}
      </Tag>
    </motion.div>
  );
}
