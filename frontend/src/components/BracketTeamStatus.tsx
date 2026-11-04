import InkStamp from './InkStamp';

export type BracketOutcome = 'qualified' | 'eliminated';

/** Sello «Clas.» / «Elim.» de un equipo en el cuadro, como los de la fase de grupos. */
export default function BracketTeamStatus({ outcome }: { outcome: BracketOutcome | null }) {
  if (!outcome) return null;
  const qualified = outcome === 'qualified';
  return (
    <InkStamp
      tone={qualified ? 'ink' : 'red'}
      size="sm"
      label={qualified ? 'Clasificado' : 'Eliminado'}
      className="team-slot-status"
    >
      {qualified ? 'Clas.' : 'Elim.'}
    </InkStamp>
  );
}
