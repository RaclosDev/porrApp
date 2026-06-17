import { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode } from '../utils/constants';
import { decodeHash } from '../utils/hash';

const searchConditions = [
  { val: "first_group", label: "Queda 1º de grupo", icon: "1️⃣" },
  { val: "second_group", label: "Queda 2º de grupo", icon: "2️⃣" },
  { val: "third_group", label: "Queda 3º de grupo", icon: "3️⃣" },
  { val: "eliminated_groups", label: "Eliminado en Grupos", icon: "❌" },
  { val: "passes_groups", label: "Pasa a 1/16", icon: "✅" },
  { val: "passes_as_third", label: "Pasa como 3º", icon: "✅" },
  { val: "reaches_r16", label: "Llega a Octavos", icon: "⚽" },
  { val: "reaches_qf", label: "Llega a Cuartos", icon: "🔥" },
  { val: "reaches_sf", label: "Llega a Semis", icon: "🥉" },
  { val: "reaches_final", label: "Llega a la Final", icon: "🥈" },
  { val: "is_runnerup", label: "Es Subcampeón", icon: "🥈" },
  { val: "is_champion", label: "Es Campeón", icon: "🏆" }
];

function Search() {
  const { participantsHashes, groupOdds, loading } = useAppContext();
  
  const [step, setStep] = useState(1);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [results, setResults] = useState(null);

  const allTeams = useMemo(() => {
    const teams = [];
    if (groupOdds) {
        Object.keys(groupOdds).forEach(g => {
        groupOdds[g].forEach(t => teams.push(t.name));
        });
    }
    return teams.sort((a, b) => a.localeCompare(b));
  }, [groupOdds]);

  const handleSelectCondition = (cond) => {
      setSelectedCondition(cond);
      setStep(2);
      setResults(null);
  };

  const handleSelectTeam = (teamName) => {
    if (!teamName) return;

    const lowerTeam = teamName.toLowerCase();
    const cond = selectedCondition.val;
    const matches = [];

    participantsHashes.forEach(p => {
        const part = decodeHash(p.hash);
        if (!part) return;
        const userName = part.user || p.key || "Anónimo";

        let match = false;

        if (cond === "first_group" && part.groups) {
            match = Object.values(part.groups).some(g => g[0].toLowerCase() === lowerTeam);
        } else if (cond === "second_group" && part.groups) {
            match = Object.values(part.groups).some(g => g[1].toLowerCase() === lowerTeam);
        } else if (cond === "third_group" && part.groups) {
            match = Object.values(part.groups).some(g => g[2].toLowerCase() === lowerTeam);
        } else if (cond === "eliminated_groups" && part.r32) {
            match = !part.r32.flat().map(t => t.toLowerCase()).includes(lowerTeam);
        } else if (cond === "passes_groups" && part.r32) {
            match = part.r32.flat().map(t => t.toLowerCase()).includes(lowerTeam);
        } else if (cond === "passes_as_third" && part.r32 && part.groups) {
            match = part.r32.flat().map(t => t.toLowerCase()).includes(lowerTeam) && Object.values(part.groups).some(g => g[2] && g[2].toLowerCase() === lowerTeam);
        } else if (cond === "reaches_r16" && part.r16) {
            match = part.r16.flat().map(t => t.toLowerCase()).includes(lowerTeam);
        } else if (cond === "reaches_qf" && part.qf) {
            match = part.qf.flat().map(t => t.toLowerCase()).includes(lowerTeam);
        } else if (cond === "reaches_sf" && part.sf) {
            match = part.sf.flat().map(t => t.toLowerCase()).includes(lowerTeam);
        } else if (cond === "reaches_final" && part.final) {
            match = part.final.map(t => t.toLowerCase()).includes(lowerTeam);
        } else if (cond === "is_runnerup" && part.final && part.champion) {
            match = part.final.map(t => t.toLowerCase()).includes(lowerTeam) && part.champion.toLowerCase() !== lowerTeam;
        } else if (cond === "is_champion" && part.champion) {
            match = part.champion.toLowerCase() === lowerTeam;
        }

        if (match) {
            matches.push(userName);
        }
    });

    setResults(matches);
  };

  const resetSearch = () => {
      setSelectedCondition(null);
      setResults(null);
      setStep(1);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando buscador...</div>;

  return (
    <section id="view-search" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div className="section-header">
          <h2 style={{ color: '#f368e0' }}>Buscador Avanzado</h2>
          <p>Descubre qué ha apostado tu grupo filtrando por equipo y fase.</p>
      </div>

      {step === 1 && (
          <div id="search-step-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '12px', marginBottom: '30px' }}>
              <h3 style={{ color: 'var(--accent-color)', marginTop: 0, textAlign: 'center', marginBottom: '20px' }}>
                  1. ¿Qué quieres buscar?
              </h3>
              <div id="search-conditions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {searchConditions.map(c => (
                      <button 
                          key={c.val}
                          onClick={() => handleSelectCondition(c)} 
                          className="glass-btn" 
                          style={{ padding: '15px', fontSize: '1.1em', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', height: '100%' }}
                      >
                          <span style={{ fontSize: '1.5em' }}>{c.icon}</span>
                          <span>{c.label}</span>
                      </button>
                  ))}
              </div>
          </div>
      )}

      {step === 2 && (
          <div id="search-step-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '25px', borderRadius: '12px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ color: 'var(--accent-color)', margin: 0 }}>
                      2. Elige el Equipo / Jugador ({selectedCondition?.label})
                  </h3>
                  <button onClick={resetSearch} className="glass-btn" style={{ padding: '5px 15px', fontSize: '0.9em', borderColor: 'rgba(255,255,255,0.3)' }}>
                      🔙 Volver
                  </button>
              </div>

              <div id="search-teams-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {allTeams.map(t => (
                      <button 
                          key={t}
                          onClick={() => handleSelectTeam(t)} 
                          className="glass-btn" 
                          style={{ padding: '10px', fontSize: '0.9em', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      >
                          <img src={`https://flagcdn.com/24x18/${getCountryCode(t)}.png`} alt={t} />
                          <span style={{ textAlign: 'center' }}>{t}</span>
                      </button>
                  ))}
              </div>
          </div>
      )}

      {results !== null && (
          <div id="search-results-container" style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px', minHeight: '150px' }}>
              <h3 id="search-results-title" style={{ color: '#00d2d3', marginTop: 0, textAlign: 'center', marginBottom: '25px', fontSize: '1.5em' }}>
                  Resultados ({results.length})
              </h3>
              {results.length > 0 ? (
                  <ul id="search-results-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                      {results.map(r => (
                          <li key={r} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center' }}>
                              <span style={{ background: 'var(--accent-color)', color: 'black', width: '24px', height: '24px', borderRadius: '50%', display: 'inline-flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', marginRight: '10px', fontSize: '0.9em' }}>
                                  {r.charAt(0).toUpperCase()}
                              </span>
                              {r}
                          </li>
                      ))}
                  </ul>
              ) : (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Nadie apostó por esta opción.</p>
              )}
          </div>
      )}
    </section>
  );
}

export default Search;
