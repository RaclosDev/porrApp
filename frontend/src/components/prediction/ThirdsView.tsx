import { type ViewerData } from './viewerTypes';
import Flag from '../Flag';

interface ThirdsViewProps {
  advancingThirds: string[];
  allThirdTeams: { group: string; team: string }[];
  getGroupTeamData: ViewerData['getGroupTeamData'];
}

/** Mejores terceros elegidos y su acierto. */
export default function ThirdsView({
  advancingThirds,
  allThirdTeams,
  getGroupTeamData,
}: ThirdsViewProps) {
  return (
    <div className="mt-2.5">
      <div className="py-4 px-5 bg-[rgba(255,_255,_255,_0.04)] border border-[rgba(255,_255,_255,_0.1)] rounded-[12px] mb-5 text-center">
        <h4 className="mt-0 mb-1.5 mx-0 text-[#a29bfe] text-[1.1rem]">
          Mejores Terceros Seleccionados ({advancingThirds.length}/8 a Dieciseisavos)
        </h4>
        <p className="m-0 text-[0.88rem] text-muted">
          De los 12 equipos situados en 3ª posición en la fase de grupos, estos son los 8 que
          elegiste para avanzar al cuadro.
        </p>
      </div>

      {allThirdTeams.length === 0 ? (
        <p className="text-center text-muted p-7.5">
          No se han encontrado equipos clasificados en 3ª posición.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,_minmax(260px,_1fr))] gap-3">
          {allThirdTeams.map(({ group, team }) => {
            const isAdvancing = advancingThirds.includes(team);
            const { color, status } = getGroupTeamData(group, team, 3);
            const displayColor =
              color === 'inherit' ? (isAdvancing ? '#00d2d3' : 'var(--text-muted)') : color;

            return (
              <div
                key={group}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: isAdvancing ? 'rgba(0, 210, 211, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                  border: isAdvancing
                    ? '1px solid rgba(0, 210, 211, 0.4)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: isAdvancing ? '0 4px 15px rgba(0, 210, 211, 0.15)' : 'none',
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-[0.75rem] font-extrabold py-[3px] px-2 rounded-[6px] bg-[rgba(255,_255,_255,_0.08)] text-muted tracking-[0.5px]">
                    G.{group}
                  </span>
                  <Flag
                    team={team}
                    size="w40"
                    style={{
                      width: 22,
                      height: 16,
                      objectFit: 'cover',
                      borderRadius: '3px',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      color: displayColor,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {team}
                  </span>
                  {status === 5 && (
                    <span
                      className="w-2 h-2 bg-[#3498db] rounded-full inline-block shrink-0"
                      title="Clasificado Matemáticamente"
                    />
                  )}
                </div>
                <span
                  role="img"
                  title={
                    isAdvancing
                      ? 'Seleccionado para avanzar a R32'
                      : 'No seleccionado para avanzar a R32'
                  }
                  aria-label={
                    isAdvancing
                      ? 'Seleccionado para avanzar a R32'
                      : 'No seleccionado para avanzar a R32'
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    width: '26px',
                    height: '26px',
                    marginLeft: '8px',
                    borderRadius: '50%',
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    lineHeight: 1,
                    background: isAdvancing
                      ? 'rgba(0, 210, 211, 0.16)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: isAdvancing ? '#00d2d3' : 'var(--text-muted)',
                    border: isAdvancing
                      ? '1px solid rgba(0, 210, 211, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  {isAdvancing ? '✓' : '×'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
