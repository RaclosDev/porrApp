/** Puntos de una columna del cuadro, bajo la columna. */
export default function RoundFooter({ total }: { total: number }) {
  if (total === 0) {
    return (
      <div className="text-[0.85rem] font-bold text-[rgba(255,255,255,0.3)] pointer-events-none">
        0 pts
      </div>
    );
  }
  return (
    <div className="text-[0.85rem] font-bold text-[#00d2d3] bg-[rgba(0,_210,_211,_0.1)] bg-none inline-block py-0.5 px-2 rounded-[4px] pointer-events-none">
      +{total} pts
    </div>
  );
}
