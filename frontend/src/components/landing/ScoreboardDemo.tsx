import { useState, type FormEvent } from 'react';

const PLAYERS = ['Ana', 'Berto', 'Carla'];
const START: number[][] = [
  [12, 8, 10],
  [6, 14, 9],
];

const total = (rounds: number[][], index: number) =>
  rounds.reduce((sum, round) => sum + round[index], 0);

/**
 * Hoja de puntos de prueba para la página pública de juegos de mesa: se apuntan rondas y se ve quién
 * va ganando, sin cuenta y sin guardar nada.
 */
export default function ScoreboardDemo() {
  const [rounds, setRounds] = useState(START);
  const [draft, setDraft] = useState(['', '', '']);
  const totals = PLAYERS.map((_, index) => total(rounds, index));
  const best = Math.max(...totals);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const round = draft.map((value) => Number(value) || 0);
    if (round.every((value) => value === 0)) return;
    setRounds([...rounds, round]);
    setDraft(['', '', '']);
  };

  return (
    <section
      id="demo"
      aria-labelledby="scoreboard-demo-title"
      className="landing-poster landing-tape rotate-1 mt-12 p-6 sm:p-8 max-w-160 mx-auto flex flex-col gap-4"
    >
      <h2 id="scoreboard-demo-title" className="poster-title text-3xl sm:text-4xl">
        Pruébalo aquí mismo
      </h2>
      <p className="text-[#1f2937] leading-snug">
        Una partida de ejemplo: apunta los puntos de la siguiente ronda y mira cómo cambia quién va
        ganando. No se guarda nada.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[#1f2937] text-left border-collapse">
          <caption className="sr-only">Hoja de puntos de ejemplo</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 pr-3">
                Ronda
              </th>
              {PLAYERS.map((name) => (
                <th key={name} scope="col" className="py-1 pr-3">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, number) => (
              <tr key={number} className="border-t border-[#1f2937]/20">
                <th scope="row" className="py-1 pr-3 font-normal">
                  {number + 1}
                </th>
                {round.map((points, index) => (
                  <td key={PLAYERS[index]} className="py-1 pr-3 tabular-nums">
                    {points}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#1f2937]">
              <th scope="row" className="py-1 pr-3">
                Total
              </th>
              {totals.map((points, index) => (
                <td key={PLAYERS[index]} className="py-1 pr-3 font-bold tabular-nums">
                  {points}
                  {points === best && (
                    <>
                      <span aria-hidden="true"> ★</span>
                      <span className="sr-only"> (va ganando)</span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3" noValidate>
        {PLAYERS.map((name, index) => (
          <label key={name} className="flex flex-col text-sm text-[#1f2937]">
            Puntos de {name}
            <input
              type="number"
              inputMode="numeric"
              className="mt-1 w-20 rounded border border-[#1f2937]/40 bg-white px-2 py-1 text-base"
              value={draft[index]}
              onChange={(event) =>
                setDraft(draft.map((value, at) => (at === index ? event.target.value : value)))
              }
            />
          </label>
        ))}
        <button type="submit" className="landing-btn landing-btn-ink">
          Apuntar ronda
        </button>
        {rounds.length > START.length && (
          <button type="button" className="landing-btn" onClick={() => setRounds(START)}>
            Empezar de nuevo
          </button>
        )}
      </form>
    </section>
  );
}
