import { BadgedAvatar } from './PokerBadges';

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
  return (
    <ol className="ranking-podium poker-podium" aria-label={label}>
      {places.slice(0, 3).map(({ playerId, name, value, place, rebuys, addOns }, index) => (
        <li key={playerId} className={`ranking-podium-place ranking-podium-place-${index + 1}`}>
          <div className={index === 0 ? 'sticker sticker-featured' : 'sticker'}>
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
