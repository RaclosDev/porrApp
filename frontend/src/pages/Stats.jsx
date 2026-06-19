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
    const semisMap = {};
    const runnerupMap = {};
    const disappointmentsMap = {};
    const thirdsMap = {};
    const darkHorsesMap = {};
    const kingsMap = {};

    // Equipos considerados "Cabezas de serie" o favoritos que sería una decepción que cayeran en grupos
    const topTeams = ["Brasil", "Francia", "Argentina", "España", "Inglaterra", "Alemania", "Portugal", "Bélgica", "Países Bajos"];

    let totalVotes = 0;

    participantsHashes.forEach(p => {
      const part = decodeHash(p.hash);
      if (!part) return;
      const userName = part.user || p.key || "Anónimo";
      totalVotes++;

      if (part.scorer) {
        if (!scorersMap[part.scorer]) scorersMap[part.scorer] = [];
        scorersMap[part.scorer].push(userName);
      }

      if (part.champion) {
        if (!championsMap[part.champion]) championsMap[part.champion] = [];
        championsMap[part.champion].push(userName);
      }

      if (part.sf) {
        const sfTeams = part.sf.flat();
        sfTeams.forEach(t => {
          if (!t || t.includes("º")) return;
          if (!semisMap[t]) semisMap[t] = [];
          semisMap[t].push(userName);
        });
      }

      if (part.qf) {
        const qfTeams = part.qf.flat();
        qfTeams.forEach(t => {
          if (!t || t.includes("º")) return;
          if (!topTeams.includes(t)) {
              if (!darkHorsesMap[t]) darkHorsesMap[t] = [];
              if (!darkHorsesMap[t].includes(userName)) {
                  darkHorsesMap[t].push(userName);
              }
          }
        });
      }

      if (part.final && part.final.length === 2) {
        const f1 = part.final[0];
        const f2 = part.final[1];
        if (f1 && f2) {
          const sortedFinal = [f1, f2].sort().join(" vs ");
          if (!finalsMap[sortedFinal]) finalsMap[sortedFinal] = [];
          finalsMap[sortedFinal].push(userName);

          if (part.champion) {
            const runnerup = f1 === part.champion ? f2 : f1;
            if (!runnerup.includes("º")) {
                if (!runnerupMap[runnerup]) runnerupMap[runnerup] = [];
                runnerupMap[runnerup].push(userName);
            }
          }
        }
      }

      if (part.r32) {
        const qualified = part.r32.flat();
        topTeams.forEach(top => {
            if (!qualified.includes(top)) {
                if (!disappointmentsMap[top]) disappointmentsMap[top] = [];
                disappointmentsMap[top].push(userName);
            }
        });
      }

      if (part.groups) {
          Object.values(part.groups).forEach(g => {
              // 1º de grupo
              if (g[0] && !g[0].includes("º")) {
                  if (!kingsMap[g[0]]) kingsMap[g[0]] = [];
                  kingsMap[g[0]].push(userName);
              }
              // Mejores terceros
              if (g[2] && !g[2].includes("º") && part.r32 && part.r32.flat().includes(g[2])) {
                  if (!thirdsMap[g[2]]) thirdsMap[g[2]] = [];
                  thirdsMap[g[2]].push(userName);
              }
          });
      }
    });

    const validParticipants = participantsHashes.map(p => {
        const part = decodeHash(p.hash);
        if (!part) return null;
        return { part, userName: part.user || p.key || "Anónimo" };
    }).filter(p => p !== null);

    const getSimilarity = (partA, partB) => {
        let totalMatches = 0;
        let possibleMatches = 0;
        
        const compareRound = (arr1, arr2) => {
            if(!arr1 || !arr2) return;
            const flat1 = arr1.flat().filter(t => t && !t.includes("º"));
            const flat2 = arr2.flat().filter(t => t && !t.includes("º"));
            possibleMatches += flat2.length;
            flat1.forEach(t => { if(flat2.includes(t)) totalMatches++; });
        };

        compareRound(partA.r32, partB.r32);
        compareRound(partA.r16, partB.r16);
        compareRound(partA.qf, partB.qf);
        compareRound(partA.sf, partB.sf);
        compareRound(partA.final, partB.final);
        
        if (partA.champion && partB.champion && !partA.champion.includes("º")) {
            possibleMatches += 2;
            if (partA.champion === partB.champion) totalMatches += 2;
        }

        if (possibleMatches > 0) return Math.round((totalMatches / possibleMatches) * 100);
        return 0;
    };

    const twinsListRaw = [];
    for (let i = 0; i < validParticipants.length; i++) {
        for (let j = i + 1; j < validParticipants.length; j++) {
            const pA = validParticipants[i];
            const pB = validParticipants[j];
            const sim = getSimilarity(pA.part, pB.part);
            twinsListRaw.push({
                name: `${pA.userName} 🤝 ${pB.userName}`,
                usersArray: [pA.userName, pB.userName],
                overridePercentage: sim
            });
        }
    }
    twinsListRaw.sort((a, b) => b.overridePercentage - a.overridePercentage);
    
    // Map to expected format [name, usersArray, overridePercentage]
    const twinsList = twinsListRaw.map(t => [t.name, t.usersArray, t.overridePercentage]);

    const getTop = (map, limit = 999) => {
      return Object.entries(map)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, limit);
    };

    return {
      total: totalVotes,
      scorers: getTop(scorersMap),
      champions: getTop(championsMap),
      finals: getTop(finalsMap),
      semis: getTop(semisMap),
      runnerups: getTop(runnerupMap),
      disappointments: getTop(disappointmentsMap).filter(d => d[1].length > 0),
      thirds: getTop(thirdsMap),
      darkHorses: getTop(darkHorsesMap),
      kings: getTop(kingsMap),
      twins: twinsList
    };
  }, [participantsHashes]);

  const [expandedCard, setExpandedCard] = useState(null);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando estadísticas...</div>;

  const ProgressBarItem = ({ name, usersArray, total, icon, isFinals = false, color = "var(--accent-color)", overridePercentage }) => {
    let flagHtml = null;
    let cleanName = name;
    const isTwins = name && typeof name === 'string' && name.includes(" 🤝 ");

    if (isTwins) {
        // Almas Gemelas format
        cleanName = <span>{name}</span>;
    } else if (isFinals) {
      const teams = name.split(" vs ");
      const t1 = teams[0], t2 = teams[1];
      const f1 = t1.includes("º") ? null : <img src={`https://flagcdn.com/16x12/${getCountryCode(t1)}.png`} alt="" style={{ borderRadius: '2px' }} />;
      const f2 = t2.includes("º") ? null : <img src={`https://flagcdn.com/16x12/${getCountryCode(t2)}.png`} alt="" style={{ borderRadius: '2px' }} />;
      cleanName = <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>{f1} {t1} <span>vs</span> {t2} {f2}</span>;
    } else if (!name.includes("º")) {
      flagHtml = <img src={`https://flagcdn.com/16x12/${getCountryCode(name)}.png`} alt="" style={{ marginRight: '8px', borderRadius: '2px' }} />;
    }

    const count = usersArray.length;
    const percentage = overridePercentage !== undefined ? overridePercentage : (total > 0 ? Math.round((count / total) * 100) : 0);

    return (
      <div 
        onClick={() => setModalData({ title: name, users: usersArray, percentage, count, isTwins })}
        style={{ cursor: 'pointer', marginBottom: '15px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.95rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>
            {icon && <span style={{ marginRight: '8px' }}>{icon}</span>}
            {flagHtml}{cleanName}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <span style={{ color: 'white', fontWeight: 'bold' }}>{percentage}%</span> {!isTwins && `(${count})`}
          </div>
        </div>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
          <div 
            style={{ 
                height: '100%', 
                width: `${percentage}%`, 
                background: color,
                borderRadius: '10px',
                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 0 10px ${color}`
            }} 
          />
        </div>
      </div>
    );
  };

  const renderCard = (title, icon, dataList, color, isFinals = false) => {
    const top5 = dataList.slice(0, 5);
    const hasMore = dataList.length > 5;

    return (
      <div className="group-card" style={{ flex: 1, minWidth: '300px', background: 'rgba(20,20,35,0.8)', border: `1px solid ${color}40`, padding: '25px', borderRadius: '16px' }}>
          <h3 
            onClick={() => hasMore && setExpandedCard({ title, icon, dataList, color, isFinals })}
            style={{ color: color, marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', cursor: hasMore ? 'pointer' : 'default' }}
          >
              {icon} {title}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dataList.length === 0 ? (
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                      Sin datos suficientes
                  </div>
              ) : (
                  <>
                    {top5.map(([name, users, override]) => (
                        <ProgressBarItem key={name} name={name} usersArray={users} total={stats.total} isFinals={isFinals} color={color} overridePercentage={override} />
                    ))}
                    {hasMore && (
                        <button 
                            onClick={() => setExpandedCard({ title, icon, dataList, color, isFinals })}
                            className="glass-btn" 
                            style={{ marginTop: '10px', padding: '8px', fontSize: '0.9rem', color: color, borderColor: `${color}40`, background: 'rgba(255,255,255,0.05)', width: '100%' }}
                        >
                            Ver {dataList.length - 5} más...
                        </button>
                    )}
                  </>
              )}
          </div>
      </div>
    );
  };

  return (
    <section id="view-stats" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div className="section-header" style={{ marginBottom: '40px' }}>
          <h2 style={{ color: '#00d2d3', fontSize: '2.5rem', margin: '0 0 10px 0' }}>Estadísticas Globales</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Análisis de las {stats.total} porras registradas en el servidor.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px', marginTop: '20px' }}>
          {renderCard("Campeón del Mundo", "🏆", stats.champions, "#f1c40f")}
          {renderCard("Subcampeón", "🥈", stats.runnerups, "#95a5a6")}
          {renderCard("Reyes del Grupo (1ºs)", "👑", stats.kings, "#1abc9c")}
          {renderCard("Supervivientes (3ºs)", "🛟", stats.thirds, "#f39c12")}
          {renderCard("Caballos Oscuros (En Cuartos)", "🦄", stats.darkHorses, "#e84393")}
          {renderCard("Llegan a Semifinales", "💫", stats.semis, "#e67e22")}
          {renderCard("Finales Más Repetidas", "⚔️", stats.finals, "#e74c3c", true)}
          {renderCard("Pichichi", "👟", stats.scorers, "#3498db")}
          {renderCard("Decepciones (Caen en Grupos)", "💀", stats.disappointments, "#9b59b6")}
          {renderCard("Almas Gemelas", "👯", stats.twins, "#00d8d6")}
      </div>

      {/* Expanded Card Modal */}
      {expandedCard && (
        <div className="modal" style={{ display: 'flex', zIndex: 999990, backdropFilter: 'blur(5px)' }} onClick={() => setExpandedCard(null)}>
            <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '0', overflow: 'hidden', background: '#1e1e2e', border: `1px solid ${expandedCard.color}40`, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center', flexShrink: 0 }}>
                    <h3 style={{ color: expandedCard.color, margin: 0, fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      {expandedCard.icon} {expandedCard.title}
                    </h3>
                </div>
                <div style={{ padding: '20px', overflowY: 'auto', flexGrow: 1 }}>
                    {expandedCard.dataList.map(([name, users]) => (
                        <ProgressBarItem key={name} name={name} usersArray={users} total={stats.total} isFinals={expandedCard.isFinals} color={expandedCard.color} />
                    ))}
                </div>
                <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    <button onClick={() => setExpandedCard(null)} className="glass-btn primary-btn" style={{ width: '100%', padding: '10px', fontSize: '1.1rem' }}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Stats Detail Modal */}
      {modalData && (
        <div className="modal" style={{ display: 'flex', zIndex: 999999, backdropFilter: 'blur(5px)' }} onClick={() => setModalData(null)}>
            <div className="modal-content" style={{ maxWidth: '400px', padding: '0', overflow: 'hidden', background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '25px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                    <h3 style={{ color: 'white', margin: '0 0 10px 0', fontSize: '1.4rem' }}>
                      {modalData.title}
                    </h3>
                    <div style={{ display: 'inline-block', background: 'rgba(0, 210, 211, 0.1)', color: '#00d2d3', padding: '5px 15px', borderRadius: '20px', fontWeight: 'bold' }}>
                        {modalData.percentage}% de los votos ({modalData.count} personas)
                    </div>
                </div>
                <ul style={{ listStyle: 'none', padding: '10px 0', margin: 0, maxHeight: '350px', overflowY: 'auto' }}>
                  {modalData.users.map((u, i) => (
                    <li key={i} style={{ padding: '12px 25px', display: 'flex', alignItems: 'center' }}>
                      <span style={{ background: 'var(--accent-color)', color: 'black', width: '32px', height: '32px', borderRadius: '50%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', marginRight: '15px', fontSize: '1rem', boxShadow: '0 2px 10px rgba(0,210,211,0.3)' }}>
                        {u.charAt(0).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '1.05rem', color: '#e2e8f0' }}>{u}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => setModalData(null)} className="glass-btn primary-btn" style={{ width: '100%', padding: '12px', fontSize: '1.1rem' }}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      )}
    </section>
  );
}

export default Stats;
