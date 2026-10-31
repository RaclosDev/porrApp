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
    <div className="paper-tabs max-w-130 mx-auto mb-5 mt-[5px]">
      {activeTab === 'cuadro' && (
        <button
          className={`paper-tab ${activePanel === 'live' ? 'is-active' : ''}`}
          type="button"
          aria-pressed={activePanel === 'live'}
          onClick={() => setActivePanel((p) => (p === 'live' ? null : 'live'))}
        >
          Partidos
        </button>
      )}
      <div role="tablist" aria-label="Vista del cuadro oficial" className="contents">
        <button
          className={`paper-tab ${activeTab === 'cuadro' ? 'is-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('cuadro')}
          role="tab"
          id="official-tab-cuadro"
          aria-selected={activeTab === 'cuadro'}
        >
          Cuadro
        </button>
        <button
          className={`paper-tab ${activeTab === 'grupos' ? 'is-active' : ''}`}
          type="button"
          onClick={() => setActiveTab('grupos')}
          role="tab"
          id="official-tab-grupos"
          aria-selected={activeTab === 'grupos'}
        >
          Grupos
        </button>
      </div>
      {activeTab === 'cuadro' && activeGroupPichichi && (
        <button
          className={`paper-tab ${activePanel === 'scorers' ? 'is-active' : ''}`}
          type="button"
          aria-pressed={activePanel === 'scorers'}
          onClick={() => setActivePanel((p) => (p === 'scorers' ? null : 'scorers'))}
        >
          Pichichi
        </button>
      )}
    </div>
  );
}
