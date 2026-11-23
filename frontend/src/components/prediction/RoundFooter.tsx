/** Puntos de una columna del cuadro, bajo la columna. */
export default function RoundFooter({ total }: { total: number }) {
  if (total === 0) {
    return <div className="text-[0.85rem] font-bold text-muted pointer-events-none">0 pts</div>;
  }
  return (
    <div className="text-[0.85rem] font-bold text-cyan bg-[color-mix(in_srgb,var(--marker-ink)_8%,transparent)] bg-none inline-block py-0.5 px-2 rounded-[4px] pointer-events-none">
      +{total} pts
    </div>
  );
}
