import { useId, type ReactNode } from 'react';
import { Crupier, type CrupierCue } from './crupier/Crupier';

/**
 * Mesa sin torneo: la tarjeta entera es la escena del crupier, con su pared arriba y la mesa de lado a lado, y debajo
 * la llamada a preparar el siguiente.
 */
export default function PokerFreeTable({
  heading,
  title = 'La mesa está libre',
  className,
  sides,
  holding = false,
  asleep = false,
  cue = null,
  corner,
  children,
}: {
  /** Título pintado en la pared, sobre el crupier, cuando no lo pone ya el panel que la contiene. */
  heading?: ReactNode;
  /** Rótulo grande bajo la mesa; con torneo programado, su fecha. */
  title?: string | null;
  className?: string;
  /** Lo que va pintado en la pared a cada lado del crupier. */
  sides?: [ReactNode, ReactNode];
  /** El crupier sujeta el cartel que va justo debajo, en `children`. */
  holding?: boolean;
  /** Con el torneo en marcha: duerme en los descansos y reacciona a los avisos. */
  asleep?: boolean;
  cue?: CrupierCue | null;
  /** Botón pequeño en la esquina de arriba a la derecha de la pared (p. ej. editar el torneo). */
  corner?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      className={className ? `poker-felt poker-empty ${className}` : 'poker-felt poker-empty'}
      aria-labelledby={heading ? headingId : undefined}
      aria-label={heading ? undefined : (title ?? undefined)}
    >
      <div className="poker-empty-stage">
        {corner && <div className="poker-empty-corner">{corner}</div>}
        {heading && <h2 id={headingId}>{heading}</h2>}
        {sides ? (
          <div className="poker-empty-row">
            <div className="poker-empty-side">{sides[0]}</div>
            <Crupier
              bare
              holding={holding}
              asleep={asleep}
              cue={cue}
              auto={!holding}
              className="poker-empty-crupier"
            />
            <div className="poker-empty-side">{sides[1]}</div>
          </div>
        ) : (
          <Crupier
            bare
            holding={holding}
            asleep={asleep}
            cue={cue}
            auto={!holding}
            className="poker-empty-crupier"
          />
        )}
      </div>
      {title && <p className="poster-title poker-empty-title first-letter:uppercase">{title}</p>}
      {children}
    </section>
  );
}
