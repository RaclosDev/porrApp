import { type ViewerData } from './viewerTypes';
import Flag from '../Flag';
import { isMathematicallyQualified } from '../../utils/groupStatus';

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
      <div className="py-4 px-5 bg-[rgba(255,_255,_255,_0.04)] bg-none border border-[rgba(255,_255,_255,_0.1)] rounded-[12px] mb-5 text-center">
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
                className={`flex items-center justify-between py-3 px-4 rounded-[10px] ${isAdvancing ? 'bg-[rgba(0,_210,_211,_0.08)] bg-none' : 'bg-[rgba(255,_255,_255,_0.03)] bg-none'} ${isAdvancing ? 'border border-[rgba(0,_210,_211,_0.4)]' : 'border border-[rgba(255,_255,_255,_0.08)]'} ${isAdvancing ? 'shadow-[0_4px_15px_rgba(0,_210,_211,_0.15)]' : 'shadow-none'}`}
                key={group}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-[0.75rem] font-extrabold py-[3px] px-2 rounded-[6px] bg-[rgba(255,_255,_255,_0.08)] bg-none text-muted tracking-[0.5px]">
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
                    className="font-bold text-[0.95rem] overflow-hidden text-ellipsis whitespace-nowrap"
                    style={{ color: displayColor }}
                  >
                    {team}
                  </span>
                  {isMathematicallyQualified(status) && (
                    <>
                      <span
                        className="w-2 h-2 bg-[#3498db] bg-none rounded-full inline-block shrink-0"
                        title="Clasificado matemáticamente"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Clasificado matemáticamente</span>
                    </>
                  )}
                </div>
                <span
                  className={`inline-flex items-center justify-center shrink-0 w-6.5 h-6.5 ml-2 rounded-full text-[0.95rem] font-extrabold leading-[1] ${isAdvancing ? 'bg-[rgba(0,_210,_211,_0.16)] bg-none' : 'bg-[rgba(255,_255,_255,_0.05)] bg-none'} ${isAdvancing ? 'text-[#00d2d3]' : 'text-muted'} ${isAdvancing ? 'border border-[rgba(0,_210,_211,_0.4)]' : 'border border-[rgba(255,_255,_255,_0.12)]'}`}
                  role="img"
                  title={
                    isAdvancing
                      ? 'Seleccionado para pasar a dieciseisavos'
                      : 'No seleccionado para pasar a dieciseisavos'
                  }
                  aria-label={
                    isAdvancing
                      ? 'Seleccionado para pasar a dieciseisavos'
                      : 'No seleccionado para pasar a dieciseisavos'
                  }
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
