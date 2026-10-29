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
    <div className="modal-groups-grid grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-3.5 mt-4 w-full max-w-375 self-center">
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
          <div
            className="bg-[linear-gradient(145deg,_rgba(30,_41,_59,_0.92),_rgba(15,_23,_42,_0.88))] border border-[rgba(148,_163,_184,_0.18)] p-3.5 rounded-[12px] text-left min-w-0 shadow-[0_6px_18px_rgba(0,_0,_0,_0.12)]"
            key={g}
          >
            <div className="font-bold text-accent mb-2 text-[1.1em] flex justify-between items-center border-b border-b-[rgba(255,255,255,0.1)] pb-[5px]">
              <span>Grupo {g}</span>
              {groupPts > 0 && (
                <span className="text-[0.85em] bg-[rgba(0,_210,_211,_0.15)] py-0.5 px-2 rounded-[10px]">
                  +{groupPts}
                </span>
              )}
            </div>
            {t1 && renderGroupTeam(g, t1, 1, 'white', '🥇')}
            {t2 && renderGroupTeam(g, t2, 2, '#ddd', '🥈')}
            {t3 && renderGroupTeam(g, t3, 3, '#bbb', '🥉')}
          </div>
        );
      })}
    </div>
  );
}
