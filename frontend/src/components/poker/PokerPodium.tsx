import { BadgedAvatar } from './PokerBadges';
import { usePokerProfile } from './PokerFaces';

interface Place {
  playerId: number;
  place?: number;
  name: string;
  /** Lo que se celebra en el cromo: el premio del torneo o las victorias de la liga. */
  value: string;
  rebuys?: number;
  addOns?: number;
}

/** Podio de cromos, como el de la clasificación de las ligas de predicciones. */
export default function PokerPodium({ places, label }: { places: Place[]; label: string }) {
  // Con perfiles, cada cromo se pulsa y gira hasta verse en grande con los números del jugador.
  const openProfile = usePokerProfile();
  return (
    <ol className="ranking-podium poker-podium" aria-label={label}>
      {places.slice(0, 3).map(({ playerId, name, value, place, rebuys, addOns }, index) => (
        <li key={playerId} className={`ranking-podium-place ranking-podium-place-${index + 1}`}>
          <div
            className={`${index === 0 ? 'sticker sticker-featured' : 'sticker'}${openProfile ? ' sticker-zoomable' : ''}`}
            {...(openProfile
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': `Ver el perfil de ${name}: ${place ?? index + 1}.º, ${value}`,
                  onClick: () => openProfile({ playerId, name }),
                  onKeyDown: (event: React.KeyboardEvent) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    openProfile({ playerId, name });
                  },
                }
              : {})}
          >
            <BadgedAvatar
              playerId={playerId}
              name={name}
              size={index === 0 ? 64 : 44}
              rebuys={rebuys}
              addOns={addOns}
            />
            <span
              className={
                name.split(/\s+/).some((word) => word.length > 8)
                  ? 'poster-title poker-podium-name is-long'
                  : 'poster-title poker-podium-name'
              }
            >
              <span className="sticker-rank">{place ?? index + 1}.º</span> {name}
            </span>
            <span className="marker-ink poker-podium-value">{value}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
