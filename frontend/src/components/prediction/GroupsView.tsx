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
    <div
      className="modal-groups-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '14px',
        marginTop: '16px',
        width: '100%',
        maxWidth: '1500px',
        alignSelf: 'center',
      }}
    >
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
            key={g}
            style={{
              background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.88))',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              padding: '14px',
              borderRadius: '12px',
              textAlign: 'left',
              minWidth: 0,
              boxShadow: '0 6px 18px rgba(0, 0, 0, 0.12)',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: 'var(--accent-color)',
                marginBottom: '8px',
                fontSize: '1.1em',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                paddingBottom: '5px',
              }}
            >
              <span>Grupo {g}</span>
              {groupPts > 0 && (
                <span
                  style={{
                    fontSize: '0.85em',
                    background: 'rgba(0, 210, 211, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                  }}
                >
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
