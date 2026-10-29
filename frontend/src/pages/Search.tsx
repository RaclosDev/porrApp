import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import Flag from '../components/Flag';
import { useSearchStats } from '../hooks/useSearchStats';
import WhatsAppIcon from '../components/WhatsAppIcon';

const searchConditions = [
  { val: 'passes_groups', label: 'Pasa a 1/16', icon: '✅' },
  { val: 'first_group', label: 'Pasa como 1º', icon: '1️⃣' },
  { val: 'second_group', label: 'Pasa como 2º', icon: '2️⃣' },
  { val: 'passes_as_third', label: 'Pasa como 3º', icon: '🥉' },
  { val: 'reaches_r16', label: 'Llega a Octavos', icon: '⚽' },
  { val: 'reaches_qf', label: 'Llega a Cuartos', icon: '🔥' },
  { val: 'reaches_sf', label: 'Llega a Semis', icon: '💫' },
  { val: 'reaches_final', label: 'Llega a la Final', icon: '⚔️' },
  { val: 'is_champion', label: 'Es Campeón', icon: '🏆' },
  { val: 'eliminated_groups', label: 'Cae en Grupos', icon: '❌' },
];

/**
 * Componente de menú desplegable personalizado con buscador integrado.
 *
 * @param {Object} props
 * @param {string} props.value - Valor seleccionado actualmente.
 * @param {Function} props.onChange - Función a llamar cuando el valor cambia.
 * @param {Array} props.options - Opciones disponibles a seleccionar.
 * @param {string} props.placeholder - Texto a mostrar cuando no hay nada seleccionado.
 * @param {boolean} [props.withFlags=false] - Indica si mostrar banderas (si las opciones son países).
 * @returns {JSX.Element} Un dropdown con buscador interno.
 */
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => (o.val || o) === value);
  const displayLabel = selectedOption ? selectedOption.label || selectedOption : '';
  const displayIcon = !searchTerm && selectedOption?.icon;

  const filteredOptions = options.filter((opt) => {
    const label = (opt.label || opt).toLowerCase();
    return label.includes(searchTerm.toLowerCase());
  });

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          width: '100%',
          padding: '15px 20px',
          borderRadius: '12px',
          background: 'rgba(20,20,35,0.9)',
          border: `1px solid ${isOpen ? 'var(--accent-color)' : 'rgba(255,255,255,0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'text',
          transition: 'all 0.2s',
          boxShadow: isOpen ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1 }}>
          {displayIcon && <span>{displayIcon}</span>}
          {!searchTerm && withFlags && value && (
            <Flag
              team={value}
              size="w80"
              style={{
                width: 20,
                height: 15,
                objectFit: 'cover',
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={isOpen ? searchTerm : displayLabel}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            placeholder={placeholder}
            aria-label={placeholder || 'Buscar'}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              outline: 'none',
              fontSize: '1.1rem',
              width: '100%',
            }}
          />
        </div>
        <span
          role="button"
          tabIndex={0}
          aria-label="Alternar menú desplegable"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
            }
          }}
          style={{
            fontSize: '0.8em',
            color: 'white',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
        >
          ▼
        </span>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '8px',
            background: 'rgba(20,20,35,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 100,
            boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const val = opt.val || opt;
              const label = opt.label || opt;
              const icon = opt.icon;
              return (
                <div
                  key={val}
                  role="option"
                  tabIndex={0}
                  aria-selected={value === val}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onChange(val);
                      setIsOpen(false);
                      setSearchTerm('');
                    }
                  }}
                  onClick={() => {
                    onChange(val);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  style={{
                    padding: '12px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    background: value === val ? 'rgba(0, 210, 211, 0.2)' : 'transparent',
                    color: 'white',
                  }}
                  onMouseOver={(e) => {
                    if (value !== val) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseOut={(e) => {
                    if (value !== val) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {icon && <span>{icon}</span>}
                  {withFlags && (
                    <Flag
                      team={val}
                      size="w80"
                      style={{
                        width: 20,
                        height: 15,
                        objectFit: 'cover',
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span>{label}</span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '12px 20px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No hay resultados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Componente que muestra la página de Búsqueda y Análisis de pronósticos.
 * Permite buscar por equipo y condición o ver el perfil psicológico de un usuario.
 *
 * @component
 * @returns {JSX.Element} La vista de la central de inteligencia.
 */
function Search() {
  const {
    participantsHashes,
    groupOdds,
    loading,
    userName,
    setViewerPredictionId,
    activeGroupPichichi,
  } = useAppContext();

  // Read initial state from URL parameters (if shared link), fallback to localStorage, then default
  const urlParams = new URLSearchParams(window.location.search);
  const [searchMode, setSearchMode] = useState(
    urlParams.get('mode') || localStorage.getItem('searchMode') || 'team',
  );
  const [selectedTeam, setSelectedTeam] = useState(
    urlParams.get('team') || localStorage.getItem('searchTeam') || '',
  );
  const [selectedCondition, setSelectedCondition] = useState(
    urlParams.get('condition') || localStorage.getItem('searchCondition') || 'passes_groups',
  );
  const [selectedUser, setSelectedUser] = useState(
    urlParams.get('user') || localStorage.getItem('searchUser') || '',
  );

  // Update localStorage when state changes (keeps URL clean)
  useEffect(() => {
    localStorage.setItem('searchMode', searchMode);
    if (searchMode === 'team') {
      if (selectedTeam) localStorage.setItem('searchTeam', selectedTeam);
      if (selectedCondition) localStorage.setItem('searchCondition', selectedCondition);
    } else {
      if (selectedUser) localStorage.setItem('searchUser', selectedUser);
    }

    // Optional: Clean up URL if they arrived from a shared link, to keep it clean.
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchMode, selectedTeam, selectedCondition, selectedUser]);

  const handleShareTeam = () => {
    const url = `https://porra.raclos.es/search?mode=team&team=${encodeURIComponent(selectedTeam)}&condition=${encodeURIComponent(selectedCondition)}`;
    const text = `¡Mira lo que la gente ha votado sobre ${selectedTeam} en PorrApp!\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareUser = () => {
    const url = `https://porra.raclos.es/search?mode=user&user=${encodeURIComponent(selectedUser)}`;
    const text = `¡Mira el perfil psicológico de ${selectedUser} en PorrApp!\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const { allTeams, allUsers, teamResults, teamNegativeResults, userStats } = useSearchStats(
    participantsHashes,
    groupOdds,
    userName,
    selectedTeam,
    selectedCondition,
    selectedUser,
  );

  if (loading)
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Cargando buscador...</div>;

  const totalVotes = participantsHashes.length;
  const teamPercentage = teamResults ? Math.round((teamResults.length / totalVotes) * 100) : 0;

  return (
    <section id="view-search" className="view-section" style={{ display: 'block', opacity: 1 }}>
      <div className="section-header" style={{ marginBottom: '30px' }}>
        <h2 style={{ color: '#f368e0', fontSize: '2.5rem', margin: '0 0 10px 0' }}>
          Central de Inteligencia
        </h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>
          Investiga los pronósticos del grupo o analiza el perfil psicológico de tus rivales.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '35px' }}>
        <div
          style={{
            display: 'flex',
            background: 'rgba(15, 23, 42, 0.8)',
            padding: '5px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            position: 'relative',
            gap: '6px',
          }}
        >
          <button
            onClick={() => setSearchMode('team')}
            style={{
              padding: '10px 30px',
              fontWeight: 800,
              fontSize: '1.05rem',
              background: searchMode === 'team' ? 'var(--accent-color)' : 'transparent',
              border: 'none',
              color: searchMode === 'team' ? '#ffffff' : 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: searchMode === 'team' ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '0.5px',
            }}
          >
            🔍 Por Equipo
          </button>
          <button
            onClick={() => setSearchMode('user')}
            style={{
              padding: '10px 30px',
              fontWeight: 800,
              fontSize: '1.05rem',
              background: searchMode === 'user' ? 'var(--accent-cyan)' : 'transparent',
              border: 'none',
              color: searchMode === 'user' ? '#000000' : 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '12px',
              transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              boxShadow: searchMode === 'user' ? '0 4px 12px rgba(0, 0, 0, 0.25)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              letterSpacing: '0.5px',
            }}
          >
            🧠 Perfil de Jugador
          </button>
        </div>
      </div>

      {searchMode === 'team' && (
        <div
          style={{
            background: 'rgba(20,20,35,0.8)',
            border: '1px solid rgba(243, 104, 224, 0.3)',
            padding: '40px',
            borderRadius: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              marginBottom: '40px',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                flex: '1 1 300px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <label
                style={{
                  display: 'block',
                  marginBottom: '15px',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                }}
              >
                Selecciona Equipo:
              </label>
              <CustomDropdown
                value={selectedTeam}
                onChange={setSelectedTeam}
                options={allTeams}
                placeholder="-- Elige un equipo --"
                withFlags={true}
              />
            </div>
            <div
              style={{
                flex: '1 1 300px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <label
                style={{
                  display: 'block',
                  marginBottom: '15px',
                  color: 'var(--text-muted)',
                  fontWeight: 'bold',
                  fontSize: '1.1rem',
                }}
              >
                Selecciona Condición:
              </label>
              <CustomDropdown
                value={selectedCondition}
                onChange={setSelectedCondition}
                options={searchConditions}
                placeholder="-- Elige condición --"
              />
            </div>
          </div>

          {selectedTeam && teamResults && (
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                padding: '30px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '15px',
                  marginBottom: '25px',
                }}
              >
                <Flag
                  team={selectedTeam}
                  size="48x36"
                  style={{
                    width: 48,
                    height: 36,
                    borderRadius: 4,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                  }}
                />
                <h3 style={{ margin: 0, fontSize: '2rem' }}>{selectedTeam}</h3>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '35px' }}>
                <div style={{ fontSize: '1.3rem', color: 'var(--text-muted)' }}>
                  <strong style={{ color: '#f368e0', fontSize: '2rem' }}>{teamPercentage}%</strong>{' '}
                  del grupo piensa esto ({teamResults.length} de {totalVotes})
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '500px',
                    margin: '15px auto 0',
                    background: 'rgba(255,255,255,0.1)',
                    height: '16px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${teamPercentage}%`,
                      background: '#f368e0',
                      height: '100%',
                      transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  ></div>
                </div>
              </div>

              {teamResults.length > 0 || (teamNegativeResults && teamNegativeResults.length > 0) ? (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    justifyContent: 'center',
                  }}
                >
                  {teamResults.map((r) => (
                    <div
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Ver porra de ${r.name || 'participante'}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setViewerPredictionId(r.id);
                        }
                      }}
                      onClick={() => setViewerPredictionId(r.id)}
                      style={{
                        cursor: 'pointer',
                        background: 'rgba(243, 104, 224, 0.1)',
                        border: '1px solid rgba(243, 104, 224, 0.3)',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '1.1rem',
                        transition: 'transform 0.2s, boxShadow 0.2s',
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <span
                        style={{
                          background: '#f368e0',
                          color: 'white',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {r.name.charAt(0).toUpperCase()}
                      </span>
                      {r.name}
                    </div>
                  ))}
                  {teamNegativeResults &&
                    teamNegativeResults.map((r) => (
                      <div
                        key={r.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver porra de ${r.name || 'participante'}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setViewerPredictionId(r.id);
                          }
                        }}
                        onClick={() => setViewerPredictionId(r.id)}
                        style={{
                          cursor: 'pointer',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px dashed rgba(255, 255, 255, 0.2)',
                          padding: '10px 20px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '1.05rem',
                          color: 'var(--text-muted)',
                          opacity: 0.45,
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.opacity = '0.95';
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.border = '1px solid rgba(255, 100, 100, 0.4)';
                          e.currentTarget.style.background = 'rgba(255, 100, 100, 0.1)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.opacity = '0.45';
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.color = 'var(--text-muted)';
                        }}
                      >
                        <span
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: '#ff6b6b',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                          }}
                        >
                          ✕
                        </span>
                        <span style={{ textDecoration: 'line-through' }}>{r.name}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    fontSize: '1.1rem',
                  }}
                >
                  Nadie ha pronosticado esta combinación.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '35px' }}>
                <button
                  onClick={handleShareTeam}
                  className="glass-btn"
                  style={{
                    padding: '10px 25px',
                    borderRadius: '10px',
                    background: '#25D366',
                    color: 'white',
                    border: '1px solid #25D366',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '1.1rem',
                  }}
                >
                  <WhatsAppIcon size={20} /> Compartir Búsqueda
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {searchMode === 'user' && (
        <div
          style={{
            background: 'rgba(20,20,35,0.8)',
            border: '1px solid rgba(0, 210, 211, 0.3)',
            padding: '40px',
            borderRadius: '16px',
          }}
        >
          <div
            style={{
              marginBottom: '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <label
              style={{
                display: 'block',
                marginBottom: '15px',
                color: 'var(--text-muted)',
                fontWeight: 'bold',
                fontSize: '1.1rem',
              }}
            >
              Selecciona Jugador para ver su Perfil:
            </label>
            <CustomDropdown
              value={selectedUser}
              onChange={setSelectedUser}
              options={allUsers}
              placeholder="-- Elige un jugador --"
            />
          </div>

          {selectedUser && userStats && (
            <div
              style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                padding: '30px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginBottom: '30px',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 10px 0',
                    color: '#00d2d3',
                    fontSize: '2rem',
                    textAlign: 'center',
                  }}
                >
                  Perfil de {selectedUser}
                </h3>

                {userName && userName !== selectedUser && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(0, 210, 211, 0.1)',
                      padding: '10px 20px',
                      borderRadius: '20px',
                      border: '1px solid rgba(0, 210, 211, 0.3)',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>🎯</span>
                    <span style={{ fontSize: '1.1rem' }}>
                      Similitud con tu porra: <strong>{userStats.similarity}%</strong>
                    </span>
                  </div>
                )}
                {userName === selectedUser && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: 'rgba(241, 196, 15, 0.1)',
                      padding: '10px 20px',
                      borderRadius: '20px',
                      border: '1px solid rgba(241, 196, 15, 0.3)',
                      color: '#f1c40f',
                    }}
                  >
                    <span style={{ fontSize: '1.5rem' }}>👑</span>
                    <span style={{ fontSize: '1.1rem' }}>Este eres tú. ¡Mucha suerte!</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: '15px',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    marginTop: '15px',
                  }}
                >
                  {userStats.id && (
                    <button
                      onClick={() => setViewerPredictionId(userStats.id)}
                      className="glass-btn primary-btn"
                      style={{
                        padding: '8px 25px',
                        borderRadius: '10px',
                        fontSize: '1.1rem',
                        background: 'rgba(0, 210, 211, 0.2)',
                        border: '1px solid #00d2d3',
                        color: '#00d2d3',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      👁️ Ver Porra Completa
                    </button>
                  )}
                  <button
                    onClick={handleShareUser}
                    className="glass-btn"
                    style={{
                      padding: '8px 25px',
                      borderRadius: '10px',
                      fontSize: '1.1rem',
                      background: '#25D366',
                      color: 'white',
                      border: '1px solid #25D366',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <WhatsAppIcon size={20} /> Compartir Perfil
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '20px',
                  marginBottom: '30px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🏆</div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    Campeón
                  </div>
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1.3rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      marginTop: '10px',
                    }}
                  >
                    <Flag
                      team={userStats.champion}
                      size="24x18"
                      style={{ width: 24, height: 18, borderRadius: 2 }}
                    />
                    {userStats.champion || 'No elegido'}
                  </div>
                </div>

                {activeGroupPichichi && (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      padding: '20px',
                      borderRadius: '12px',
                      textAlign: 'center',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>👟</div>
                    <div
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                      }}
                    >
                      Pichichi
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.3rem', marginTop: '10px' }}>
                      {userStats.scorer || 'No elegido'}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    padding: '20px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>⚔️</div>
                  <div
                    style={{
                      color: 'var(--text-muted)',
                      fontSize: '0.9rem',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                    }}
                  >
                    Su Final
                  </div>
                  <div
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      marginTop: '10px',
                    }}
                  >
                    {userStats.final && userStats.final.length === 2 ? (
                      <>
                        <Flag
                          team={userStats.final[0]}
                          size="20x15"
                          style={{ width: 20, height: 15, borderRadius: 2 }}
                        />
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>vs</span>
                        <Flag
                          team={userStats.final[1]}
                          size="20x15"
                          style={{ width: 20, height: 15, borderRadius: 2 }}
                        />
                      </>
                    ) : (
                      'No completada'
                    )}
                  </div>
                </div>
              </div>

              {/* Psicología */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '20px',
                }}
              >
                <div
                  style={{
                    background: 'rgba(232, 67, 147, 0.1)',
                    border: '1px solid rgba(232, 67, 147, 0.3)',
                    padding: '20px',
                    borderRadius: '12px',
                  }}
                >
                  <h4
                    style={{
                      color: '#e84393',
                      marginTop: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '1.2rem',
                    }}
                  >
                    🦄 Sus "Locuras"
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Equipos no favoritos que ha metido en Cuartos o Semis.
                  </p>
                  {userStats.madness.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {userStats.madness.map((t) => (
                        <div
                          key={t}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(0,0,0,0.4)',
                            padding: '6px 12px',
                            borderRadius: '15px',
                            fontSize: '0.95rem',
                          }}
                        >
                          <Flag
                            team={t}
                            size="w80"
                            style={{
                              width: 16,
                              height: 12,
                              objectFit: 'cover',
                              borderRadius: 2,
                            }}
                          />
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="italic text-white/40">Es muy conservador. Cero locuras.</div>
                  )}
                </div>

                <div
                  style={{
                    background: 'rgba(155, 89, 182, 0.1)',
                    border: '1px solid rgba(155, 89, 182, 0.3)',
                    padding: '20px',
                    borderRadius: '12px',
                  }}
                >
                  <h4
                    style={{
                      color: '#9b59b6',
                      marginTop: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '1.2rem',
                    }}
                  >
                    💀 Sus "Haters"
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Equipos top que ha fulminado en Fase de Grupos.
                  </p>
                  {userStats.haters.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {userStats.haters.map((t) => (
                        <div
                          key={t}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(0,0,0,0.4)',
                            padding: '6px 12px',
                            borderRadius: '15px',
                            fontSize: '0.95rem',
                          }}
                        >
                          <Flag
                            team={t}
                            size="w80"
                            style={{
                              width: 16,
                              height: 12,
                              objectFit: 'cover',
                              borderRadius: 2,
                            }}
                          />
                          {t}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="italic text-white/40">
                      Respeta mucho a los favoritos. Todos pasan.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    background: 'rgba(231, 76, 60, 0.1)',
                    border: '1px solid rgba(231, 76, 60, 0.3)',
                    padding: '20px',
                    borderRadius: '12px',
                  }}
                >
                  <h4
                    style={{
                      color: '#e74c3c',
                      marginTop: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      fontSize: '1.2rem',
                    }}
                  >
                    🏥 ¡Al Psiquiatra!
                  </h4>
                  <p className="text-[var(--text-muted)] text-sm mb-4">
                    Pronósticos que ha hecho y que <strong>nadie más</strong> ha elegido en todo el
                    grupo.
                  </p>
                  {userStats.asylum && userStats.asylum.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {userStats.asylum.map((item) => (
                        <div
                          key={item.team}
                          style={{
                            background: 'rgba(0,0,0,0.4)',
                            padding: '10px',
                            borderRadius: '10px',
                            fontSize: '0.9rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontWeight: 'bold',
                              color: '#e74c3c',
                              marginBottom: '4px',
                            }}
                          >
                            <Flag
                              team={item.team}
                              size="w80"
                              style={{
                                width: 16,
                                height: 12,
                                objectFit: 'cover',
                                borderRadius: 2,
                              }}
                            />
                            {item.team}
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.8)' }}>
                            Único en predecir:{' '}
                            <span style={{ fontStyle: 'italic' }}>{item.labels.join(', ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="italic text-white/40">
                      Persona muy normal. Todo lo que dice ya se le había ocurrido a alguien más.
                    </div>
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
