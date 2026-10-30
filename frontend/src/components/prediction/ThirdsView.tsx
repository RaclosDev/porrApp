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
    <div style={{ marginTop: '10px' }}>
      <div
        style={{
          padding: '16px 20px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          marginBottom: '20px',
          textAlign: 'center',
        }}
      >
        <h4 style={{ margin: '0 0 6px 0', color: '#a29bfe', fontSize: '1.1rem' }}>
          Mejores Terceros Seleccionados ({advancingThirds.length}/8 a Dieciseisavos)
        </h4>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
          De los 12 equipos situados en 3ª posición en la fase de grupos, estos son los 8 que
          elegiste para avanzar al cuadro.
        </p>
      </div>

      {allThirdTeams.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>
          No se han encontrado equipos clasificados en 3ª posición.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.5px',
                    }}
                  >
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
                      title="Clasificado Matemáticamente"
                      style={{
                        width: '8px',
                        height: '8px',
                        background: '#3498db',
                        borderRadius: '50%',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
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
