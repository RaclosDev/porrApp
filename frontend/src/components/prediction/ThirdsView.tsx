import { type ViewerData } from './viewerTypes';
import Flag from '../Flag';
import { isMathematicallyQualified } from '../../utils/groupStatus';
import InkStamp from '../InkStamp';

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
      <div className="mb-5">
        <h4 className="album-sheet-title mb-1">
          Mejores terceros{' '}
          <span className="marker-ink normal-case">
            {advancingThirds.length} de 8 a dieciseisavos
          </span>
        </h4>
        <p className="m-0 text-[0.9rem] text-muted">
          De los 12 terceros de grupo, estos son los 8 que elegiste para pasar al cuadro.
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
              color === 'inherit' ? (isAdvancing ? 'var(--ink)' : 'var(--text-muted)') : color;

            return (
              <div
                className={`viewer-group flex items-center justify-between py-3 px-4 ${isAdvancing ? 'border-[var(--hit)] bg-[rgba(21,_128,_61,_0.06)]' : 'border-line bg-transparent'}`}
                key={group}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="poster-title text-[0.85rem] text-muted">G.{group}</span>
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
                    <InkStamp tone="ink" size="sm" label="Clasificado matemáticamente">
                      Clas.
                    </InkStamp>
                  )}
                </div>
                <InkStamp
                  tone={isAdvancing ? 'ink' : 'red'}
                  size="sm"
                  label={
                    isAdvancing
                      ? 'Seleccionado para pasar a dieciseisavos'
                      : 'No seleccionado para pasar a dieciseisavos'
                  }
                  className="ml-2 shrink-0"
                >
                  {isAdvancing ? 'Pasa' : 'No'}
                </InkStamp>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
