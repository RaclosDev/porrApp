import { useState, useRef, useEffect } from 'react';
import { getCountryCode } from '../utils/constants';

const CustomSelect = ({ value, options, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flex: 1, zIndex: isOpen ? 1000 : 1 }}>
      <div 
        className="glass-input"
        style={{ 
          padding: '6px 8px', 
          fontSize: '0.85rem', 
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '30px'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flex: 1 }}>
          {selectedOption ? (
            <>
              {selectedOption.value !== "" && <img src={`https://flagcdn.com/16x12/${getCountryCode(selectedOption.value)}.png`} alt="" style={{ width: '16px', height: '12px' }} />}
              <span>{selectedOption.label}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>▼</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0f172a',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '8px',
          marginTop: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 100,
          overflow: 'hidden'
        }}>
          {options.map((opt, idx) => (
            <div 
              key={idx}
              style={{
                padding: '8px 10px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: value === opt.value ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderBottom: idx < options.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => {
                if (value !== opt.value) e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.value !== "" && <img src={`https://flagcdn.com/16x12/${getCountryCode(opt.value)}.png`} alt="" style={{ width: '16px', height: '12px' }} />}
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function GroupStage({ groupOdds, onComplete, activeGroupId }) {
  const [selections, setSelections] = useState(() => {
    const saved = localStorage.getItem('draft_groups_' + activeGroupId);
    return saved ? JSON.parse(saved) : {};
  });
  const [advancingThirds, setAdvancingThirds] = useState(() => {
    const saved = localStorage.getItem('draft_advancing_' + activeGroupId);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (Object.keys(selections).length === 0 && Object.keys(groupOdds).length > 0) {
      const initial = {};
      Object.keys(groupOdds).forEach(g => {
        initial[g] = { first: '', second: '', third: '' };
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelections(initial);
    }
  }, [groupOdds, selections]);

  useEffect(() => {
    if (Object.keys(selections).length > 0) {
      localStorage.setItem('draft_groups_' + activeGroupId, JSON.stringify(selections));
    }
  }, [selections, activeGroupId]);

  useEffect(() => {
    localStorage.setItem('draft_advancing_' + activeGroupId, JSON.stringify(advancingThirds));
  }, [advancingThirds, activeGroupId]);

  useEffect(() => {
    const currentThirds = Object.values(selections).map(g => g.third).filter(t => t !== '');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdvancingThirds(prev => prev.filter(t => currentThirds.includes(t)));
  }, [selections]);

  const handleSelect = (group, pos, teamName) => {
    setSelections(prev => {
      const next = { ...prev };
      const currentGroup = { ...next[group] };

      // Prevent duplicate selections in the same group
      if (teamName) {
        if (pos !== 'first' && currentGroup.first === teamName) currentGroup.first = '';
        if (pos !== 'second' && currentGroup.second === teamName) currentGroup.second = '';
        if (pos !== 'third' && currentGroup.third === teamName) currentGroup.third = '';
      }

      currentGroup[pos] = teamName;
      next[group] = currentGroup;
      return next;
    });
  };

  const toggleAdvancingThird = (team) => {
    setAdvancingThirds(prev => {
      if (prev.includes(team)) return prev.filter(x => x !== team);
      if (prev.length < 8) return [...prev, team];
      return prev;
    });
  };

  const selectedThirds = Object.values(selections).map(g => g.third).filter(t => t !== '');

  const handleSubmit = () => {
    // Validate
    const missingFirstsOrSeconds = [];
    Object.keys(selections).forEach(g => {
      if (!selections[g].first || !selections[g].second) {
        missingFirstsOrSeconds.push(g);
      }
    });

    if (missingFirstsOrSeconds.length > 0) {
      alert(`Falta seleccionar 1º o 2º en los grupos: ${missingFirstsOrSeconds.join(', ')}`);
      return;
    }

    if (advancingThirds.length !== 8) {
      alert(`Debes seleccionar exactamente 8 mejores terceros para avanzar (tienes ${advancingThirds.length}).`);
      return;
    }

    onComplete(selections, advancingThirds);
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: 'var(--accent-color)', margin: '0 0 10px 0' }}>Paso 1: Fase de Grupos</h2>
        <p style={{ color: 'var(--text-muted)' }}>Selecciona 1º y 2º en cada grupo. Puedes marcar todos los 3º que quieras, y luego elegir a los 8 mejores abajo.</p>
      </div>

      <div className="groups-grid" style={{ marginBottom: '30px' }}>
        {Object.keys(groupOdds).sort().map((groupName, idx) => {
          const teams = groupOdds[groupName] || [];
          return (
            <div key={groupName} className="group-card glass-panel" style={{ position: 'relative', zIndex: 50 - idx, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ margin: '0 0 5px 0', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px', fontSize: '1.1rem' }}>Grupo {groupName}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '12px' }}>
                {teams.map(t => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                    <img src={`https://flagcdn.com/16x12/${getCountryCode(t.name)}.png`} alt="" style={{width: '16px', height: '12px', flexShrink: 0}}/>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }} title={t.name}>{t.name}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: 'bold' }}>1º Clasificado:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CustomSelect 
                    value={selections[groupName]?.first || ''}
                    onChange={(val) => handleSelect(groupName, 'first', val)}
                    placeholder="-- Seleccionar --"
                    options={[
                      { value: '', label: '-- Seleccionar --' },
                      ...teams.map(t => ({ value: t.name, label: t.name }))
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: '#a29bfe', fontWeight: 'bold' }}>2º Clasificado:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CustomSelect 
                    value={selections[groupName]?.second || ''}
                    onChange={(val) => handleSelect(groupName, 'second', val)}
                    placeholder="-- Seleccionar --"
                    options={[
                      { value: '', label: '-- Seleccionar --' },
                      ...teams.map(t => ({ value: t.name, label: t.name }))
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>3º:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CustomSelect 
                    value={selections[groupName]?.third || ''}
                    onChange={(val) => handleSelect(groupName, 'third', val)}
                    placeholder="-- Seleccionar --"
                    options={[
                      { value: '', label: '-- Seleccionar --' },
                      ...teams.map(t => ({ value: t.name, label: t.name }))
                    ]}
                  />
                </div>
              </div>

            </div>
          );
        })}
      </div>

      <div style={{ padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ textAlign: 'center', color: '#a29bfe', marginTop: 0 }}>Selecciona los 8 Mejores Terceros</h3>
        <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
          Has marcado {selectedThirds.length} terceros en los grupos. Haz clic en los 8 que pasarán a octavos de final (<strong style={{ color: advancingThirds.length === 8 ? '#00b894' : '#ff4757' }}>{advancingThirds.length}/8</strong>).
        </p>
        
        {selectedThirds.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: '20px' }}>
            Aún no has seleccionado ningún 3º clasificado en los grupos de arriba.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '15px' }}>
            {selectedThirds.map(t => {
              const isSelected = advancingThirds.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleAdvancingThird(t)}
                  className="glass-btn"
                  style={{
                    background: isSelected ? 'rgba(0, 210, 211, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: isSelected ? '1px solid #00d2d3' : '1px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px'
                  }}
                >
                  <img src={`https://flagcdn.com/16x12/${getCountryCode(t)}.png`} alt="" />
                  {t}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button 
          onClick={handleSubmit}
          className="glass-btn primary-btn" 
          style={{ fontSize: '1.2rem', padding: '12px 30px' }}
          disabled={advancingThirds.length !== 8}
        >
          Generar Eliminatorias ➡️
        </button>
        {advancingThirds.length !== 8 && (
          <p style={{ color: '#ff4757', fontSize: '0.9rem', marginTop: '10px' }}>Selecciona exactamente 8 terceros para continuar.</p>
        )}
      </div>

    </div>
  );
}
