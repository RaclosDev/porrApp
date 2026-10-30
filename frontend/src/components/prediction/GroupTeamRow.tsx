import Flag from '../Flag';
import InkStamp from '../InkStamp';

interface GroupTeamRowProps {
  teamName: string;
  color: string;
  medal: string;
  /** Clasificado matemáticamente (estado oficial 5). */
  qualified: boolean;
  points: number;
}

/** Equipo dentro de la tabla de un grupo del pronóstico. */
export default function GroupTeamRow({
  teamName,
  color,
  medal,
  qualified,
  points,
}: GroupTeamRowProps) {
  return (
    <div
      style={{
        fontSize: '1em',
        color,
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <span className="mr-1">{medal}</span>{' '}
      <Flag
        team={teamName}
        size="w40"
        style={{
          width: 16,
          height: 12,
          objectFit: 'cover',
          borderRadius: '2px',
          marginRight: '4px',
          flexShrink: 0,
        }}
      />{' '}
      <span className="grow whitespace-nowrap overflow-hidden text-ellipsis flex items-center">
        {teamName}
        {qualified ? (
          <InkStamp tone="ink" size="sm" label="Clasificado matemáticamente" className="ml-1.5">
            Clas.
          </InkStamp>
        ) : null}
      </span>
      {points > 0 && (
        <span className="ml-1.5 text-[0.85em] font-bold text-[rgba(0,_210,_211,_0.9)] bg-[rgba(0,_210,_211,_0.15)] bg-none py-px px-[5px] rounded-[4px]">
          +{points}
        </span>
      )}
    </div>
  );
}
