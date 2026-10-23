import { useMemo } from 'react';
import Flag from '../Flag';
import { compareTeams } from '../../utils/points';

function BestThirdsPanel({ officialPoints, allGames, nameToIdMap }) {
  const thirds = useMemo(() => {
    if (!officialPoints || Object.keys(officialPoints).length === 0) return [];

    const arr = [];
    Object.keys(officialPoints).forEach((groupName) => {
      const teamsWithStats = Object.keys(officialPoints[groupName]).map((teamName) => ({
        name: teamName,
        ...officialPoints[groupName][teamName],
      }));

      teamsWithStats.sort((a, b) =>
        compareTeams(a, b, groupName, officialPoints, allGames, nameToIdMap),
      );

      if (teamsWithStats.length >= 3) {
        arr.push({ group: groupName, ...teamsWithStats[2] });
      }
    });

    arr.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.gls !== a.gls) return b.gls - a.gls;

      const fpA = a.fp || 0;
      const fpB = b.fp || 0;
      if (fpB !== fpA) return fpB - fpA;

      return a.name.localeCompare(b.name);
    });

    return arr;
  }, [officialPoints, allGames, nameToIdMap]);

  if (thirds.length === 0) return null;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '580px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          color: '#00cec9',
          fontSize: '1rem',
          fontWeight: 'bold',
          padding: '6px',
          background: 'rgba(0, 206, 201, 0.1)',
          border: '1px solid rgba(0, 206, 201, 0.3)',
          borderRadius: '12px',
        }}
      >
        🥉 MEJORES TERCEROS
      </div>
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '10px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 1fr 25px 30px 28px',
                gap: '6px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              <span>#</span>
              <span style={{ textAlign: 'left' }}>Equipo</span>
              <span>PT</span>
              <span>DF</span>
              <span title="Fair Play (Tarjetas)">FP</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {thirds.slice(0, 6).map((t, idx) => {
                const isTop8 = idx < 8;
                const rank = idx + 1;

                return (
                  <div
                    key={t.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 25px 30px 28px',
                      gap: '6px',
                      padding: '5px 0',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span
                      style={{
                        color: isTop8 ? '#00b894' : 'var(--text-muted)',
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}
                    >
                      {rank}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontWeight: 'bold',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                      }}
                    >
                      {t.pts}
                    </span>
                    <span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </span>
                    <span
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                      }}
                      title="Puntos de Fair Play"
                    >
                      {t.fp || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 1fr 25px 30px 28px',
                gap: '6px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 'bold',
                textAlign: 'center',
              }}
            >
              <span>#</span>
              <span style={{ textAlign: 'left' }}>Equipo</span>
              <span>PT</span>
              <span>DF</span>
              <span title="Fair Play (Tarjetas)">FP</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {thirds.slice(6, 12).map((t, idx) => {
                const globalIdx = idx + 6;
                const hasPlayed = t.mp > 0;
                const isTop8 = hasPlayed && globalIdx < 8;
                const rank = hasPlayed ? globalIdx + 1 : '-';

                return (
                  <div
                    key={t.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '20px 1fr 25px 30px 28px',
                      gap: '6px',
                      padding: '5px 0',
                      alignItems: 'center',
                      fontSize: '0.85rem',
                      borderBottom: globalIdx === 7 ? '2px dashed rgba(255, 71, 87, 0.5)' : 'none',
                      opacity: isTop8 ? 1 : hasPlayed ? 0.5 : 0.3,
                    }}
                  >
                    <span
                      style={{
                        color: isTop8 ? '#00b894' : 'var(--text-muted)',
                        fontWeight: 'bold',
                        textAlign: 'center',
                      }}
                    >
                      {rank}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        overflow: 'hidden',
                      }}
                    >
                      <Flag team={t.name} style={{ borderRadius: '2px', flexShrink: 0 }} />
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {t.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontWeight: 'bold',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                      }}
                    >
                      {t.pts}
                    </span>
                    <span style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {t.diff > 0 ? `+${t.diff}` : t.diff}
                    </span>
                    <span
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                      }}
                      title="Puntos de Fair Play"
                    >
                      {t.fp || 0}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BestThirdsPanel;
