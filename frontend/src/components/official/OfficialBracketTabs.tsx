import type { Dispatch, SetStateAction } from 'react';
interface OfficialBracketTabsProps {
  activeTab: 'cuadro' | 'grupos';
  setActiveTab: (tab: 'cuadro' | 'grupos') => void;
  activePanel: 'live' | 'scorers' | null;
  setActivePanel: Dispatch<SetStateAction<'live' | 'scorers' | null>>;
  activeGroupPichichi: boolean;
}

/** Pestañas cuadro/grupos y accesos a directo y goleadores. */
export default function OfficialBracketTabs({
  activeTab,
  setActiveTab,
  activePanel,
  setActivePanel,
  activeGroupPichichi,
}: OfficialBracketTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 'clamp(2px, 0.7vw, 8px)',
        marginBottom: '20px',
        marginTop: '5px',
        flexWrap: 'nowrap',
      }}
    >
      {activeTab === 'cuadro' && (
        <button
          className="glass-btn"
          onClick={() => setActivePanel((p) => (p === 'live' ? null : 'live'))}
          style={{
            padding: 'clamp(4px, 1.1vw, 6px) clamp(5px, 1.5vw, 10px)',
            fontSize: 'clamp(0.6rem, 2.4vw, 0.8rem)',
            fontWeight: 'bold',
            minHeight: 'auto',
            alignSelf: 'stretch',
            background: activePanel === 'live' ? 'rgba(255, 71, 87, 0.18)' : 'transparent',
            borderColor: activePanel === 'live' ? '#ff4757' : 'var(--border-color)',
            color: activePanel === 'live' ? '#ff4757' : 'var(--text-muted)',
            borderRadius: '12px',
            transition: 'all 0.2s',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="results-toggle-icon">🔴</span> Partidos
        </button>
      )}
      <div
        style={{
          display: 'inline-flex',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '4px',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(12px)',
          gap: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('cuadro')}
          style={{
            padding: 'clamp(7px, 1.6vw, 8px) clamp(9px, 2.6vw, 22px)',
            fontWeight: 800,
            fontSize: 'clamp(0.76rem, 3vw, 0.95rem)',
            background:
              activeTab === 'cuadro' ? 'linear-gradient(135deg, #00d2d3, #01a3a4)' : 'transparent',
            border: 'none',
            color: activeTab === 'cuadro' ? '#000000' : 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '12px',
            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: activeTab === 'cuadro' ? '0 4px 15px rgba(0, 210, 211, 0.4)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          🏆 Cuadro
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('grupos')}
          style={{
            padding: 'clamp(7px, 1.6vw, 8px) clamp(9px, 2.6vw, 22px)',
            fontWeight: 800,
            fontSize: 'clamp(0.76rem, 3vw, 0.95rem)',
            background:
              activeTab === 'grupos' ? 'linear-gradient(135deg, #00d2d3, #01a3a4)' : 'transparent',
            border: 'none',
            color: activeTab === 'grupos' ? '#000000' : 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '12px',
            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: activeTab === 'grupos' ? '0 4px 15px rgba(0, 210, 211, 0.4)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          📋 Grupos
        </button>
      </div>
      {activeTab === 'cuadro' && activeGroupPichichi && (
        <button
          className="glass-btn"
          onClick={() => setActivePanel((p) => (p === 'scorers' ? null : 'scorers'))}
          style={{
            padding: 'clamp(4px, 1.1vw, 6px) clamp(5px, 1.5vw, 10px)',
            fontSize: 'clamp(0.6rem, 2.4vw, 0.8rem)',
            fontWeight: 'bold',
            minHeight: 'auto',
            alignSelf: 'stretch',
            background: activePanel === 'scorers' ? 'rgba(255, 211, 42, 0.18)' : 'transparent',
            borderColor: activePanel === 'scorers' ? '#ffd32a' : 'var(--border-color)',
            color: activePanel === 'scorers' ? '#ffd32a' : 'var(--text-muted)',
            borderRadius: '12px',
            transition: 'all 0.2s',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <span className="results-toggle-icon">🏆</span> Pichichi
        </button>
      )}
    </div>
  );
}
