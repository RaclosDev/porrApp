/** Jugadas del Texas Hold'em de mejor a peor, con un ejemplo de cinco cartas. */
const HANDS: { name: string; text: string; cards: string[] }[] = [
  {
    name: 'Escalera real',
    text: 'Del 10 al as, todas del mismo palo.',
    cards: ['A♠', 'K♠', 'Q♠', 'J♠', '10♠'],
  },
  {
    name: 'Escalera de color',
    text: 'Cinco seguidas del mismo palo.',
    cards: ['9♥', '8♥', '7♥', '6♥', '5♥'],
  },
  { name: 'Póker', text: 'Cuatro cartas del mismo valor.', cards: ['Q♣', 'Q♦', 'Q♥', 'Q♠', '3♦'] },
  { name: 'Full', text: 'Un trío y una pareja.', cards: ['J♠', 'J♥', 'J♦', '4♣', '4♠'] },
  {
    name: 'Color',
    text: 'Cinco del mismo palo, sin ir seguidas.',
    cards: ['A♦', 'J♦', '8♦', '6♦', '2♦'],
  },
  {
    name: 'Escalera',
    text: 'Cinco seguidas de cualquier palo.',
    cards: ['10♣', '9♦', '8♠', '7♥', '6♣'],
  },
  { name: 'Trío', text: 'Tres cartas del mismo valor.', cards: ['7♠', '7♥', '7♦', 'K♣', '2♠'] },
  { name: 'Doble pareja', text: 'Dos parejas distintas.', cards: ['A♥', 'A♣', '9♠', '9♦', '5♣'] },
  { name: 'Pareja', text: 'Dos cartas del mismo valor.', cards: ['K♥', 'K♠', '10♦', '6♣', '3♥'] },
  {
    name: 'Carta alta',
    text: 'Sin jugada: gana la carta más alta.',
    cards: ['A♣', 'J♥', '8♦', '5♠', '2♣'],
  },
];

const red = (card: string) => card.endsWith('♥') || card.endsWith('♦');
/** El selector de texto (U+FE0E) evita que iOS pinte el palo como un emoji de color. */
const TEXT = '︎';

/** Chuleta de jugadas para consultar fuera de la mesa, plegada para no ocupar la portada. */
export default function PokerHands() {
  return (
    <section className="paper-panel album-sheet poker-panel poker-hands">
      <details>
        <summary>
          <h2>Jugadas del póker</h2>
          <span className="poker-note">De la mejor a la peor</span>
        </summary>
        <ol className="poker-hands-list">
          {HANDS.map((hand) => (
            <li key={hand.name}>
              <span className="poker-hands-name">
                <strong>{hand.name}</strong>
                <small>{hand.text}</small>
              </span>
              <span className="poker-hands-cards" aria-label={hand.cards.join(', ')}>
                {hand.cards.map((card) => (
                  <span
                    key={card}
                    className={red(card) ? 'poker-card is-red' : 'poker-card'}
                    aria-hidden="true"
                  >
                    <span className="poker-card-rank">{card.slice(0, -1)}</span>
                    <span className="poker-card-suit">
                      {card.slice(-1)}
                      {TEXT}
                    </span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
        <p className="poker-note">
          Con la misma jugada gana la de cartas más altas. El palo nunca desempata.
        </p>
      </details>
    </section>
  );
}
