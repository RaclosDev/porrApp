import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { decodeHash } from '../utils/hash';

function Stats() {
  const { participantsHashes, loading } = useAppContext();
  const [modalData, setModalData] = useState(null);

  const stats = useMemo(() => {
    const scorersMap = {};
    const championsMap = {};
    const finalsMap = {};

    participantsHashes.forEach(p => {
      const part = decodeHash(p.hash);
      if (!part) return;
      const userName = part.user || p.key || "Anónimo";

      if (part.scorer) {
        if (!scorersMap[part.scorer]) scorersMap[part.scorer] = [];
        scorersMap[part.scorer].push(userName);
      }

      if (part.champion) {
        if (!championsMap[part.champion]) championsMap[part.champion] = [];
        championsMap[part.champion].push(userName);
      }

      if (part.final && part.final.length === 2) {
        const f1 = part.final[0];
        const f2 = part.final[1];
        if (f1 && f2) {
          const sortedFinal = [f1, f2].sort().join(" vs ");
          if (!finalsMap[sortedFinal]) finalsMap[sortedFinal] = [];
          finalsMap[sortedFinal].push(userName);
        }
      }
    });

    const getTop = (map, limit = 10) => {
      return Object.entries(map)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, limit);
    };

    return {
      scorers: getTop(scorersMap, 10),
      champions: getTop(championsMap, 10),
      finals: getTop(finalsMap, 10)
    };
  }, [participantsHashes]);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando estadísticas...</div>;

  const renderListItem = (name, usersArray, icon, isFinals = false, isChampion = false) => {
    let flagHtml = null;
    let cleanName = name;

    if (isFinals) {
      const teams = name.split(" vs ");
      const t1 = teams[0], t2 = teams[1];
      const f1 = t1.includes("º") ? null : <img src={`https://flagcdn.com/16x12/${getCountryCode(t1)}.png`} alt="" />;
      const f2 = t2.includes("º") ? null : <img src={`https://flagcdn.com/16x12/${getCountryCode(t2)}.png`} alt="" />;
      cleanName = <>{f1} {t1} vs {t2} {f2}</>;
    } else if (isChampion && !name.includes("º")) {
      flagHtml = <img src={`https://flagcdn.com/16x12/${getCountryCode(name)}.png`} alt="" style={{ marginRight: '8px' }} />;
    }

    const count = usersArray.length;

    return (
      <div 
        key={name}
        onClick={() => setModalData({ title: name, users: usersArray })}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', transition: 'background 0.2s' }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      >
        <div style={{ fontWeight: 'bold', fontSize: '1.05em', display: 'flex', alignItems: 'center' }}>
          {icon}{flagHtml}{cleanName}
        </div>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.9em' }}>
          {count} {count === 1 ? 'voto' : 'votos'}
        </div>
      </div>
    );
  };

  return (
    <section id="view-stats" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div className="section-header">
          <h2 style={{ color: '#00d2d3' }}>Más Elegidos</h2>
          <p>Resumen de los pronósticos de todos los participantes.</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '20px' }}>
          <div className="group-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ color: '#ffd32a' }}>👟 Máximo Goleador</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.scorers.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>No hay datos suficientes todavía.</div> : stats.scorers.map(([name, users]) => renderListItem(name, users, ''))}
              </div>
          </div>

          <div className="group-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ color: '#ff9f43' }}>🏆 Ganadores (Campeón)</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.champions.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>No hay datos suficientes todavía.</div> : stats.champions.map(([name, users]) => renderListItem(name, users, '', false, true))}
              </div>
          </div>

          <div className="group-card" style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ color: '#ff4757' }}>⚔️ Finales Más Repetidas</h3>
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {stats.finals.length === 0 ? <div style={{ color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>No hay datos suficientes todavía.</div> : stats.finals.map(([name, users]) => renderListItem(name, users, '', true, false))}
              </div>
          </div>
      </div>

      {/* Stats Detail Modal */}
      <div className="modal" style={{ display: modalData ? 'flex' : 'none', zIndex: 999999 }} onClick={() => setModalData(null)}>
          <div className="modal-content" style={{ maxWidth: '400px', padding: '0', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div style={{ background: 'var(--bg-card)', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ color: 'var(--accent-color)', margin: 0, fontSize: '1.2rem' }}>
                    Han votado por {modalData?.title}:
                  </h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' }}>
                {modalData?.users.map((u, i) => (
                  <li key={i} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }}>
                    <span style={{ background: 'var(--accent-color)', color: 'black', width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', marginRight: '12px', fontSize: '0.9em' }}>
                      {u.charAt(0).toUpperCase()}
                    </span>
                    {u}
                  </li>
                ))}
              </ul>
              <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.2)', textAlign: 'right' }}>
                  <button onClick={() => setModalData(null)} className="glass-btn primary-btn" style={{ padding: '8px 20px' }}>
                      Cerrar
                  </button>
              </div>
          </div>
      </div>
    </section>
  );
}

export default Stats;
