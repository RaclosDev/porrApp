import { type ViewerTab } from './viewerTypes';
interface ViewerTabsProps {
  activeTab: ViewerTab;
  setActiveTab: (tab: ViewerTab) => void;
}

/** Pestañas para cambiar entre grupos, terceros y cuadro. */
export default function ViewerTabs({ activeTab, setActiveTab }: ViewerTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '20px',
        marginTop: '5px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          width: '100%',
          maxWidth: '520px',
          boxSizing: 'border-box',
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
          onClick={() => setActiveTab('groups')}
          style={{
            padding: '8px 6px',
            fontWeight: 800,
            fontSize: 'clamp(0.7rem, 3vw, 0.95rem)',
            minWidth: 0,
            justifyContent: 'center',
            background:
              activeTab === 'groups' ? 'linear-gradient(135deg, #00d2d3, #01a3a4)' : 'transparent',
            border: 'none',
            color: activeTab === 'groups' ? '#000000' : 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '12px',
            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: activeTab === 'groups' ? '0 4px 15px rgba(0, 210, 211, 0.4)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          Grupos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('thirds')}
          style={{
            padding: '8px 6px',
            fontWeight: 800,
            fontSize: 'clamp(0.7rem, 3vw, 0.95rem)',
            minWidth: 0,
            justifyContent: 'center',
            background:
              activeTab === 'thirds' ? 'linear-gradient(135deg, #a29bfe, #6c5ce7)' : 'transparent',
            border: 'none',
            color: activeTab === 'thirds' ? '#ffffff' : 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '12px',
            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: activeTab === 'thirds' ? '0 4px 15px rgba(108, 92, 231, 0.4)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          Terceros
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('bracket')}
          style={{
            padding: '8px 6px',
            fontWeight: 800,
            fontSize: 'clamp(0.7rem, 3vw, 0.95rem)',
            minWidth: 0,
            justifyContent: 'center',
            background:
              activeTab === 'bracket' ? 'linear-gradient(135deg, #ff9f43, #ffaf60)' : 'transparent',
            border: 'none',
            color: activeTab === 'bracket' ? '#000000' : 'var(--text-muted)',
            cursor: 'pointer',
            borderRadius: '12px',
            transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: activeTab === 'bracket' ? '0 4px 15px rgba(255, 159, 67, 0.4)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            letterSpacing: '0.5px',
            whiteSpace: 'nowrap',
          }}
        >
          Bracket
        </button>
      </div>
    </div>
  );
}
