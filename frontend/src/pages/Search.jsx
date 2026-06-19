import { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { getCountryCode, countryCodeMap } from '../utils/constants';
import { decodeHash } from '../utils/hash';

const searchConditions = [
  { val: "passes_groups", label: "Pasa a 1/16", icon: "✅" },
  { val: "first_group", label: "Pasa como 1º", icon: "1️⃣" },
  { val: "second_group", label: "Pasa como 2º", icon: "2️⃣" },
  { val: "passes_as_third", label: "Pasa como 3º", icon: "🥉" },
  { val: "reaches_r16", label: "Llega a Octavos", icon: "⚽" },
  { val: "reaches_qf", label: "Llega a Cuartos", icon: "🔥" },
  { val: "reaches_sf", label: "Llega a Semis", icon: "💫" },
  { val: "reaches_final", label: "Llega a la Final", icon: "⚔️" },
  { val: "is_champion", label: "Es Campeón", icon: "🏆" },
  { val: "eliminated_groups", label: "Cae en Grupos", icon: "❌" }
];

const topTeams = ["Brasil", "Francia", "Argentina", "España", "Inglaterra", "Alemania", "Portugal", "Bélgica", "Países Bajos"];

// Custom Dropdown Component
function CustomDropdown({ value, onChange, options, placeholder, withFlags = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => (o.val || o) === value);
  const displayLabel = selectedOption ? (selectedOption.label || selectedOption) : "";
  const displayIcon = !searchTerm && selectedOption?.icon;
  const displayFlag = !searchTerm && withFlags && value ? getCountryCode(value) : null;

  const filteredOptions = options.filter(opt => {
      const label = (opt.label || opt).toLowerCase();
      return label.includes(searchTerm.toLowerCase());
  });

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <div 
        onClick={() => { setIsOpen(true); inputRef.current?.focus(); }}
        style={{ width: '100%', padding: '15px 20px', borderRadius: '12px', background: 'rgba(20,20,35,0.9)', border: `1px solid ${isOpen ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'text', transition: 'all 0.2s', boxShadow: isOpen ? '0 0 15px rgba(0, 210, 211, 0.3)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1 }}>
            {displayIcon && <span>{displayIcon}</span>}
            {displayFlag && displayFlag !== 'xx' && <img src={`https://flagcdn.com/20x15/${displayFlag}.png`} alt="" style={{ borderRadius: '2px' }} />}
            <input 
                ref={inputRef}
                type="text"
                value={isOpen ? searchTerm : displayLabel}
                onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
                placeholder={placeholder}
                style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '1.1rem', width: '100%' }}
            />
        </div>
        <span style={{ fontSize: '0.8em', color: 'white', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>▼</span>
      </div>

      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'rgba(20,20,35,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', maxHeight: '300px', overflowY: 'auto', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          {filteredOptions.length > 0 ? filteredOptions.map((opt) => {
            const val = opt.val || opt;
            const label = opt.label || opt;
            const icon = opt.icon;
            const flag = withFlags ? getCountryCode(val) : null;
            return (
              <div 
                key={val}
                onClick={() => { onChange(val); setIsOpen(false); setSearchTerm(''); }}
                style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: 'background 0.2s', background: value === val ? 'rgba(0, 210, 211, 0.2)' : 'transparent', color: 'white' }}
                onMouseOver={(e) => { if(value !== val) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}}
                onMouseOut={(e) => { if(value !== val) e.currentTarget.style.background = 'transparent'}}
              >
                {icon && <span>{icon}</span>}
                {flag && flag !== 'xx' && <img src={`https://flagcdn.com/20x15/${flag}.png`} alt="" style={{ borderRadius: '2px' }} />}
                <span>{label}</span>
              </div>
            );
          }) : (
              <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay resultados</div>
          )}
        </div>
      )}
    </div>
  );
}


function Search() {
  const { participantsHashes, groupOdds, loading, userName } = useAppContext();
  
  const [searchMode, setSearchMode] = useState('team'); // 'team' or 'user'
  
  // Team Search State
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedCondition, setSelectedCondition] = useState('passes_groups');
  
  // User Search State
  const [selectedUser, setSelectedUser] = useState('');

  const allTeams = useMemo(() => {
    const teams = [];
    if (groupOdds) {
        Object.keys(groupOdds).forEach(g => {
        groupOdds[g].forEach(t => teams.push(t.name));
        });
    }
    return teams.sort((a, b) => a.localeCompare(b));
  }, [groupOdds]);

  const allUsers = useMemo(() => {
      const users = participantsHashes.map(p => {
          const part = decodeHash(p.hash);
          return part ? (part.user || p.key || "Anónimo") : "Anónimo";
      });
      return [...new Set(users)].sort((a, b) => a.localeCompare(b));
  }, [participantsHashes]);

  // Execute Team Search
  const teamResults = useMemo(() => {
      if (!selectedTeam) return null;
      
      const lowerTeam = selectedTeam.toLowerCase();
      const matches = [];

      participantsHashes.forEach(p => {
          const part = decodeHash(p.hash);
          if (!part) return;
          const uName = part.user || p.key || "Anónimo";
          let match = false;

          const cond = selectedCondition;

          if (cond === "first_group" && part.groups) {
              match = Object.values(part.groups).some(g => g[0].toLowerCase() === lowerTeam);
          } else if (cond === "second_group" && part.groups) {
              match = Object.values(part.groups).some(g => g[1].toLowerCase() === lowerTeam);
          } else if (cond === "third_group" && part.groups) {
              match = Object.values(part.groups).some(g => g[2].toLowerCase() === lowerTeam);
          } else if (cond === "eliminated_groups" && part.r32) {
              match = !part.r32.flat().map(t => t?.toLowerCase()).includes(lowerTeam);
          } else if (cond === "passes_groups" && part.r32) {
              match = part.r32.flat().map(t => t?.toLowerCase()).includes(lowerTeam);
          } else if (cond === "passes_as_third" && part.r32 && part.groups) {
              match = part.r32.flat().map(t => t?.toLowerCase()).includes(lowerTeam) && Object.values(part.groups).some(g => g[2] && g[2].toLowerCase() === lowerTeam);
          } else if (cond === "reaches_r16" && part.r16) {
              match = part.r16.flat().map(t => t?.toLowerCase()).includes(lowerTeam);
          } else if (cond === "reaches_qf" && part.qf) {
              match = part.qf.flat().map(t => t?.toLowerCase()).includes(lowerTeam);
          } else if (cond === "reaches_sf" && part.sf) {
              match = part.sf.flat().map(t => t?.toLowerCase()).includes(lowerTeam);
          } else if (cond === "reaches_final" && part.final) {
              match = part.final.map(t => t?.toLowerCase()).includes(lowerTeam);
          } else if (cond === "is_runnerup" && part.final && part.champion) {
              match = part.final.map(t => t?.toLowerCase()).includes(lowerTeam) && part.champion.toLowerCase() !== lowerTeam;
          } else if (cond === "is_champion" && part.champion) {
              match = part.champion.toLowerCase() === lowerTeam;
          }

          if (match) matches.push(uName);
      });

      return matches;
  }, [selectedTeam, selectedCondition, participantsHashes]);

  const globalFrequencies = useMemo(() => {
      const freqs = {};

      const increment = (type, team) => {
          if (!team || team.includes("º")) return;
          const key = `${type}:${team}`;
          freqs[key] = (freqs[key] || 0) + 1;
      };

      participantsHashes.forEach(p => {
          const part = decodeHash(p.hash);
          if (!part) return;

          if (part.groups) {
              Object.values(part.groups).forEach(g => {
                  increment("1st_group", g[0]);
                  increment("2nd_group", g[1]);
                  increment("3rd_group", g[2]);
                  increment("4th_group", g[3]);
              });
          }
          if (part.r32) part.r32.flat().forEach(t => increment("passes_groups", t));
          
          if (part.r32) {
              const r32Flat = part.r32.flat();
              Object.keys(countryCodeMap).forEach(t => {
                  if (t && !t.includes("º") && !r32Flat.includes(t)) {
                      increment("eliminated_groups", t);
                  }
              });
          }

          if (part.r16) part.r16.flat().forEach(t => increment("reaches_r16", t));
          if (part.qf) part.qf.flat().forEach(t => increment("reaches_qf", t));
          if (part.sf) part.sf.flat().forEach(t => increment("reaches_sf", t));
          if (part.final) part.final.forEach(t => increment("reaches_final", t));
          if (part.champion) increment("is_champion", part.champion);
          if (part.scorer) increment("is_scorer", part.scorer);
      });

      return freqs;
  }, [participantsHashes]);

  // Execute User Search & Profiling
  const userStats = useMemo(() => {
      if (!selectedUser) return null;
      const targetHashObj = participantsHashes.find(p => {
          const part = decodeHash(p.hash);
          return part && (part.user || p.key || "Anónimo") === selectedUser;
      });
      if (!targetHashObj) return null;
      
      const targetPart = decodeHash(targetHashObj.hash);
      
      // Calculate Madness (Locuras) -> Non-top teams in QF/SF
      const madness = [];
      if (targetPart.qf) {
          targetPart.qf.flat().forEach(t => {
              if (t && !t.includes("º") && !topTeams.includes(t)) {
                  if (!madness.includes(t)) madness.push(t);
              }
          });
      }

      // Calculate Haters (Decepciones) -> Top teams eliminated in Groups
      const haters = [];
      if (targetPart.r32) {
          const qualified = targetPart.r32.flat();
          topTeams.forEach(t => {
              if (!qualified.includes(t)) haters.push(t);
          });
      }

      // Calculate Asylum (Psiquiatra) -> Picks with frequency === 1
      const asylumMap = {};
      const checkUnique = (type, team, label) => {
          if (!team || team.includes("º")) return;
          if (globalFrequencies[`${type}:${team}`] === 1) {
              if (!asylumMap[team]) asylumMap[team] = [];
              if (!asylumMap[team].includes(label)) asylumMap[team].push(label);
          }
      };

      if (targetPart.groups) {
          Object.values(targetPart.groups).forEach(g => {
              checkUnique("1st_group", g[0], "1º de Grupo");
              checkUnique("2nd_group", g[1], "2º de Grupo");
              checkUnique("3rd_group", g[2], "3º de Grupo");
              checkUnique("4th_group", g[3], "4º de Grupo");
          });
      }
      if (targetPart.r32) targetPart.r32.flat().forEach(t => checkUnique("passes_groups", t, "Pasa de Grupos"));
      
      if (targetPart.r32) {
          const r32Flat = targetPart.r32.flat();
          Object.keys(countryCodeMap).forEach(t => {
              if (t && !t.includes("º") && !r32Flat.includes(t)) {
                  checkUnique("eliminated_groups", t, "Cae en Grupos");
              }
          });
      }
      if (targetPart.r16) targetPart.r16.flat().forEach(t => checkUnique("reaches_r16", t, "A Octavos"));
      if (targetPart.qf) targetPart.qf.flat().forEach(t => checkUnique("reaches_qf", t, "A Cuartos"));
      if (targetPart.sf) targetPart.sf.flat().forEach(t => checkUnique("reaches_sf", t, "A Semis"));
      if (targetPart.final) targetPart.final.forEach(t => checkUnique("reaches_final", t, "A la Final"));
      if (targetPart.champion) checkUnique("is_champion", targetPart.champion, "Campeón");
      if (targetPart.scorer && globalFrequencies[`is_scorer:${targetPart.scorer}`] === 1) {
          if (!asylumMap[targetPart.scorer]) asylumMap[targetPart.scorer] = [];
          asylumMap[targetPart.scorer].push("Pichichi");
      }

      const asylum = Object.entries(asylumMap).map(([team, labels]) => ({ team, labels }));

      // Calculate Similarity with current user
      let similarity = 0;
      if (userName && userName !== selectedUser) {
          const myHashObj = participantsHashes.find(p => {
              const part = decodeHash(p.hash);
              return part && (part.user || p.key) === userName;
          });
          if (myHashObj) {
              const myPart = decodeHash(myHashObj.hash);
              let totalMatches = 0;
              let possibleMatches = 0;
              
              const compareRound = (arr1, arr2) => {
                  if(!arr1 || !arr2) return;
                  const flat1 = arr1.flat().filter(t => t && !t.includes("º"));
                  const flat2 = arr2.flat().filter(t => t && !t.includes("º"));
                  possibleMatches += flat2.length;
                  flat1.forEach(t => { if(flat2.includes(t)) totalMatches++; });
              };

              compareRound(myPart.r32, targetPart.r32);
              compareRound(myPart.r16, targetPart.r16);
              compareRound(myPart.qf, targetPart.qf);
              compareRound(myPart.sf, targetPart.sf);
              compareRound(myPart.final, targetPart.final);
              if (myPart.champion && targetPart.champion && !myPart.champion.includes("º")) {
                  possibleMatches += 2; // Weight champion double
                  if (myPart.champion === targetPart.champion) totalMatches += 2;
              }

              if (possibleMatches > 0) {
                  similarity = Math.round((totalMatches / possibleMatches) * 100);
              }
          }
      }

      return {
          ...targetPart,
          madness,
          haters,
          asylum,
          similarity
      };

  }, [selectedUser, participantsHashes, userName, globalFrequencies]);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando buscador...</div>;

  const totalVotes = participantsHashes.length;
  const teamPercentage = teamResults ? Math.round((teamResults.length / totalVotes) * 100) : 0;

  return (
    <section id="view-search" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div className="section-header" style={{ marginBottom: '30px' }}>
          <h2 style={{ color: '#f368e0', fontSize: '2.5rem', margin: '0 0 10px 0' }}>Central de Inteligencia</h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Investiga las apuestas del grupo o analiza el perfil psicológico de tus rivales.</p>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '40px', justifyContent: 'center' }}>
          <button 
            onClick={() => setSearchMode('team')} 
            className={`glass-btn ${searchMode === 'team' ? 'active' : ''}`}
            style={{ padding: '12px 35px', fontSize: '1.1rem', background: searchMode === 'team' ? 'rgba(243, 104, 224, 0.2)' : 'rgba(255,255,255,0.05)', borderColor: searchMode === 'team' ? '#f368e0' : 'rgba(255,255,255,0.1)', boxShadow: searchMode === 'team' ? '0 0 20px rgba(243, 104, 224, 0.3)' : 'none' }}
          >
              🔍 Por Equipo
          </button>
          <button 
            onClick={() => setSearchMode('user')} 
            className={`glass-btn ${searchMode === 'user' ? 'active' : ''}`}
            style={{ padding: '12px 35px', fontSize: '1.1rem', background: searchMode === 'user' ? 'rgba(0, 210, 211, 0.2)' : 'rgba(255,255,255,0.05)', borderColor: searchMode === 'user' ? '#00d2d3' : 'rgba(255,255,255,0.1)', boxShadow: searchMode === 'user' ? '0 0 20px rgba(0, 210, 211, 0.3)' : 'none' }}
          >
              🧠 Perfil de Jugador
          </button>
      </div>

      {searchMode === 'team' && (
          <div style={{ background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(243, 104, 224, 0.3)', padding: '40px', borderRadius: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '40px', justifyContent: 'center' }}>
                  <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <label style={{ display: 'block', marginBottom: '15px', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem' }}>Selecciona Equipo:</label>
                      <CustomDropdown 
                          value={selectedTeam} 
                          onChange={setSelectedTeam} 
                          options={allTeams} 
                          placeholder="-- Elige un equipo --"
                          withFlags={true}
                      />
                  </div>
                  <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <label style={{ display: 'block', marginBottom: '15px', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem' }}>Selecciona Condición:</label>
                      <CustomDropdown 
                          value={selectedCondition} 
                          onChange={setSelectedCondition} 
                          options={searchConditions} 
                          placeholder="-- Elige condición --"
                      />
                  </div>
              </div>

              {selectedTeam && teamResults && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '25px' }}>
                          <img src={`https://flagcdn.com/48x36/${getCountryCode(selectedTeam)}.png`} alt={selectedTeam} style={{ borderRadius: '4px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)' }} />
                          <h3 style={{ margin: 0, fontSize: '2rem' }}>{selectedTeam}</h3>
                      </div>
                      
                      <div style={{ textAlign: 'center', marginBottom: '35px' }}>
                          <div style={{ fontSize: '1.3rem', color: 'var(--text-muted)' }}>
                              <strong style={{ color: '#f368e0', fontSize: '2rem' }}>{teamPercentage}%</strong> del grupo piensa esto ({teamResults.length} de {totalVotes})
                          </div>
                          <div style={{ width: '100%', maxWidth: '500px', margin: '15px auto 0', background: 'rgba(255,255,255,0.1)', height: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                              <div style={{ width: `${teamPercentage}%`, background: '#f368e0', height: '100%', transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 15px #f368e0' }}></div>
                          </div>
                      </div>

                      {teamResults.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                              {teamResults.map(r => (
                                  <div key={r} style={{ background: 'rgba(243, 104, 224, 0.1)', border: '1px solid rgba(243, 104, 224, 0.3)', padding: '10px 20px', borderRadius: '25px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem' }}>
                                      <span style={{ background: '#f368e0', color: 'white', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                          {r.charAt(0).toUpperCase()}
                                      </span>
                                      {r}
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '1.2rem' }}>Nadie ha apostado por esta combinación.</div>
                      )}
                  </div>
              )}
          </div>
      )}

      {searchMode === 'user' && (
          <div style={{ background: 'rgba(20,20,35,0.8)', border: '1px solid rgba(0, 210, 211, 0.3)', padding: '40px', borderRadius: '16px' }}>
              <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <label style={{ display: 'block', marginBottom: '15px', color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem' }}>Selecciona Jugador para ver su Perfil:</label>
                  <CustomDropdown 
                      value={selectedUser} 
                      onChange={setSelectedUser} 
                      options={allUsers} 
                      placeholder="-- Elige un jugador --"
                  />
              </div>

              {selectedUser && userStats && (
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '30px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '30px' }}>
                          <h3 style={{ margin: '0 0 10px 0', color: '#00d2d3', fontSize: '2rem', textAlign: 'center' }}>Perfil de {selectedUser}</h3>
                          
                          {userName && userName !== selectedUser && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0, 210, 211, 0.1)', padding: '10px 20px', borderRadius: '20px', border: '1px solid rgba(0, 210, 211, 0.3)' }}>
                                  <span style={{ fontSize: '1.5rem' }}>🎯</span>
                                  <span style={{ fontSize: '1.1rem' }}>Similitud con tu porra: <strong>{userStats.similarity}%</strong></span>
                              </div>
                          )}
                          {userName === selectedUser && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(241, 196, 15, 0.1)', padding: '10px 20px', borderRadius: '20px', border: '1px solid rgba(241, 196, 15, 0.3)', color: '#f1c40f' }}>
                                  <span style={{ fontSize: '1.5rem' }}>👑</span>
                                  <span style={{ fontSize: '1.1rem' }}>Este eres tú. ¡Mucha suerte!</span>
                              </div>
                          )}
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🏆</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Campeón</div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
                                  {!userStats.champion?.includes("º") && <img src={`https://flagcdn.com/24x18/${getCountryCode(userStats.champion)}.png`} alt="" style={{ borderRadius: '2px' }}/>}
                                  {userStats.champion || "No elegido"}
                              </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👟</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Pichichi</div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.3rem', marginTop: '10px' }}>
                                  {userStats.scorer || "No elegido"}
                              </div>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚔️</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Su Final</div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '10px' }}>
                                  {userStats.final && userStats.final.length === 2 ? (
                                      <>
                                        {!userStats.final[0].includes("º") && <img src={`https://flagcdn.com/20x15/${getCountryCode(userStats.final[0])}.png`} alt="" style={{ borderRadius: '2px' }}/>}
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>vs</span>
                                        {!userStats.final[1].includes("º") && <img src={`https://flagcdn.com/20x15/${getCountryCode(userStats.final[1])}.png`} alt="" style={{ borderRadius: '2px' }}/>}
                                      </>
                                  ) : "No completada"}
                              </div>
                          </div>
                      </div>

                      {/* Psicología */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                          <div style={{ background: 'rgba(232, 67, 147, 0.1)', border: '1px solid rgba(232, 67, 147, 0.3)', padding: '20px', borderRadius: '12px' }}>
                              <h4 style={{ color: '#e84393', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>🦄 Sus "Locuras"</h4>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}>Equipos no favoritos que ha metido en Cuartos o Semis.</p>
                              {userStats.madness.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                      {userStats.madness.map(t => (
                                          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: '15px', fontSize: '0.95rem' }}>
                                              <img src={`https://flagcdn.com/16x12/${getCountryCode(t)}.png`} alt="" />
                                              {t}
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>Es muy conservador. Cero locuras.</div>
                              )}
                          </div>

                          <div style={{ background: 'rgba(155, 89, 182, 0.1)', border: '1px solid rgba(155, 89, 182, 0.3)', padding: '20px', borderRadius: '12px' }}>
                              <h4 style={{ color: '#9b59b6', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>💀 Sus "Haters"</h4>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}>Equipos top que ha fulminado en Fase de Grupos.</p>
                              {userStats.haters.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                      {userStats.haters.map(t => (
                                          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.4)', padding: '6px 12px', borderRadius: '15px', fontSize: '0.95rem' }}>
                                              <img src={`https://flagcdn.com/16x12/${getCountryCode(t)}.png`} alt="" />
                                              {t}
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>Respeta mucho a los favoritos. Todos pasan.</div>
                              )}
                          </div>

                          <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', padding: '20px', borderRadius: '12px' }}>
                              <h4 style={{ color: '#e74c3c', marginTop: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem' }}>🏥 ¡Al Psiquiatra!</h4>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '15px' }}>Pronósticos que ha hecho y que <strong>nadie más</strong> ha elegido en todo el grupo.</p>
                              {userStats.asylum && userStats.asylum.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      {userStats.asylum.map(item => (
                                          <div key={item.team} style={{ background: 'rgba(0,0,0,0.4)', padding: '10px', borderRadius: '10px', fontSize: '0.9rem' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: '#e74c3c', marginBottom: '4px' }}>
                                                  <img src={`https://flagcdn.com/16x12/${getCountryCode(item.team)}.png`} alt="" />
                                                  {item.team}
                                              </div>
                                              <div style={{ color: 'rgba(255,255,255,0.8)' }}>
                                                  Único en predecir: <span style={{ fontStyle: 'italic' }}>{item.labels.join(', ')}</span>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.4)' }}>Persona muy normal. Todo lo que dice ya se le había ocurrido a alguien más.</div>
                              )}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      )}
    </section>
  );
}

export default Search;
