import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

function getCompetitionBadge(competitionName) {
  if (!competitionName) return '🏆';
  const lower = competitionName.toLowerCase();
  if (lower.includes('laliga') || lower.includes('copa del rey') || lower.includes('españa'))
    return '🇪🇸';
  if (lower.includes('premier') || lower.includes('inglaterra')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (lower.includes('champions') || lower.includes('europa') || lower.includes('conference'))
    return '🇪🇺';
  if (lower.includes('serie a') || lower.includes('italia')) return '🇮🇹';
  if (lower.includes('bundesliga') || lower.includes('alemania')) return '🇩🇪';
  if (lower.includes('ligue 1') || lower.includes('francia')) return '🇫🇷';
  if (lower.includes('mex') || lower.includes('bbva')) return '🇲🇽';
  if (lower.includes('mls') || lower.includes('usa')) return '🇺🇸';
  if (lower.includes('mundial') || lower.includes('world cup') || lower.includes('fifa'))
    return '🌍';
  return '🏆';
}

export default function ActiveLeagueDropdown() {
  const {
    activeGroupId,
    activeGroupName,
    activeCompetitionName,
    activeCompetitionFormatType,
    userGroups,
    changeGroup,
    isAuthenticated,
  } = useAppContext();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (isAuthenticated && (!userGroups || userGroups.length === 0)) {
    return (
      <button
        type="button"
        id="btn-active-league-dropdown"
        onClick={() => navigate('/mis-ligas')}
        className="glass-btn"
        title="Crear o unirse a una liga"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          minHeight: '34px',
          borderRadius: '16px',
          border: '1px dashed rgba(0, 210, 211, 0.6)',
          background: 'rgba(0, 210, 211, 0.1)',
          color: '#00d2d3',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 700,
        }}
      >
        <span>➕</span>
        <span
          style={{
            maxWidth: '130px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          Crear o unirse
        </span>
      </button>
    );
  }

  const currentBadge = getCompetitionBadge(activeCompetitionName);
  const displayLeagueName = activeGroupName || 'Porra Global';
  const displayCompName =
    activeCompetitionName || (activeCompetitionFormatType === 'LEAGUE' ? 'Liga' : 'Mundial');

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        zIndex: 105,
      }}
    >
      <button
        type="button"
        id="btn-active-league-dropdown"
        onClick={() => setIsOpen(!isOpen)}
        className="glass-btn"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Cambiar de liga o peña"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          minHeight: '38px',
          borderRadius: '10px',
          border: '1px solid rgba(0, 210, 211, 0.4)',
          background: isOpen ? 'rgba(0, 210, 211, 0.15)' : 'rgba(15, 23, 42, 0.75)',
          color: 'var(--text-main, #fff)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.88rem',
          boxShadow: isOpen ? '0 0 15px rgba(0, 210, 211, 0.25)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{currentBadge}</span>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
            lineHeight: 1.15,
          }}
        >
          <span
            style={{
              maxWidth: '140px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: '#fff',
            }}
          >
            {displayLeagueName}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--accent-color, #00d2d3)',
              fontWeight: 500,
              maxWidth: '130px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayCompName}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted, #94a3b8)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            marginLeft: '2px',
          }}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="active-league-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            background: '#111827',
            border: '1px solid rgba(0, 210, 211, 0.35)',
            borderRadius: '12px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75), 0 0 20px rgba(0, 210, 211, 0.15)',
            backdropFilter: 'blur(12px)',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              color: 'var(--text-muted, #94a3b8)',
              textTransform: 'uppercase',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>Mis Ligas</span>
            <span style={{ fontSize: '0.7rem', color: '#00d2d3' }}>
              {userGroups?.length || 0} {userGroups?.length === 1 ? 'liga' : 'ligas'}
            </span>
          </div>

          <div
            style={{
              maxHeight: '240px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            {userGroups && userGroups.length > 0 ? (
              userGroups.map((g) => {
                const isSelected = activeGroupId && String(activeGroupId) === String(g.id);
                const gBadge = getCompetitionBadge(g.competitionName);
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      changeGroup(g.id.toString());
                      setIsOpen(false);
                      navigate('/');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: isSelected
                        ? '1px solid rgba(0, 210, 211, 0.4)'
                        : '1px solid transparent',
                      background: isSelected ? 'rgba(0, 210, 211, 0.12)' : 'transparent',
                      color: isSelected ? '#00d2d3' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      width: '100%',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{gBadge}</span>
                      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <span
                          style={{
                            fontWeight: isSelected ? 700 : 500,
                            fontSize: '0.88rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {g.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>
                          {g.competitionName || 'Mundial'} ·{' '}
                          {g.poolFormat === 'MATCH_DAY' ? 'Jornadas' : 'Cuadro'}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <span style={{ color: '#00d2d3', fontWeight: 'bold', fontSize: '0.9rem' }}>
                        ✓
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div
                style={{
                  padding: '12px 10px',
                  textAlign: 'center',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: '0.8rem',
                }}
              >
                {isAuthenticated
                  ? 'No te has unido a ninguna liga privada todavía.'
                  : 'Inicia sesión para unirte o ver tus ligas.'}
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '6px',
              marginTop: '4px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/mis-ligas');
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '8px',
                border: '1px dashed rgba(0, 210, 211, 0.35)',
                background: 'rgba(0, 210, 211, 0.05)',
                color: '#00d2d3',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 210, 211, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 210, 211, 0.05)';
              }}
            >
              <span>➕</span>
              <span>Crear o Unirse a una Liga</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
