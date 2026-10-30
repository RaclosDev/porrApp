import type { ReactNode } from 'react';
import type { ViewerPrediction } from '../../utils/predictionData';
import { getTeamVal, type ViewerData } from './viewerTypes';

interface GroupsViewProps {
  part: ViewerPrediction;
  points: ViewerData['points'];
  renderGroupTeam: (
    groupName: string,
    teamName: string,
    expectedPos: number,
    defaultColor: string,
    medal: string,
  ) => ReactNode;
}

/** Tablas de grupos del pronóstico con los puntos de cada uno. */
export default function GroupsView({ part, points, renderGroupTeam }: GroupsViewProps) {
  return (
    <div className="modal-groups-grid mt-4 w-full max-w-375 self-center">
      {Object.keys(part.groups ?? {}).map((g) => {
        let groupPts = 0;
        points?.log
          ?.filter(
            (l) =>
              l.stage === 'r1' &&
              (l.msg.includes(`Grupo ${g}`) || l.msg.includes(`Grupo ${g.toUpperCase()}`)),
          )
          .forEach((l) => {
            groupPts += l.amount;
          });

        const groupVal = part.groups?.[g];
        const t1 = getTeamVal(groupVal, 0, 'first');
        const t2 = getTeamVal(groupVal, 1, 'second');
        const t3 = getTeamVal(groupVal, 2, 'third');

        return (
          <div className="viewer-group" key={g}>
            <div className="album-sheet-title text-[1.05rem] mb-1.5 flex justify-between items-center border-b border-b-line pb-1">
              <span>Grupo {g}</span>
              {groupPts > 0 && (
                <span className="marker-ink text-[0.95rem] normal-case">+{groupPts}</span>
              )}
            </div>
            {t1 && renderGroupTeam(g, t1, 1, 'inherit', '🥇')}
            {t2 && renderGroupTeam(g, t2, 2, 'inherit', '🥈')}
            {t3 && renderGroupTeam(g, t3, 3, 'inherit', '🥉')}
          </div>
        );
      })}
    </div>
  );
}
