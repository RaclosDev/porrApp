import { PokerAvatar } from './PokerFaces';

interface Place {
  playerId: number;
  name: string;
  /** Lo que se celebra en el cromo: el premio del torneo o las victorias de la liga. */
  value: string;
}

/** Podio de cromos, como el de la clasificación de las ligas de predicciones. */
export default function PokerPodium({ places, label }: { places: Place[]; label: string }) {
  return (
    <ol className="ranking-podium poker-podium" aria-label={label}>
      {places.slice(0, 3).map(({ playerId, name, value }, index) => (
        <li key={playerId} className={`ranking-podium-place ranking-podium-place-${index + 1}`}>
          <div className={index === 0 ? 'sticker sticker-featured' : 'sticker'}>
            <PokerAvatar playerId={playerId} name={name} size={index === 0 ? 64 : 44} />
            <span className="poster-title poker-podium-name">
              <span className="sticker-rank">{index + 1}.º</span> {name}
            </span>
            <span className="marker-ink poker-podium-value">{value}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
