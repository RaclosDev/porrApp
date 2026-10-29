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
    <div className="flex justify-center items-center gap-[clamp(2px,_0.7vw,_8px)] mb-5 mt-[5px] flex-nowrap">
      {activeTab === 'cuadro' && (
        <button
          className={`glass-btn [padding:clamp(4px,_1.1vw,_6px)_clamp(5px,_1.5vw,_10px)] text-[clamp(0.6rem,_2.4vw,_0.8rem)] font-bold min-h-auto self-stretch rounded-[12px] [transition:all_0.2s] cursor-pointer whitespace-nowrap ${activePanel === 'live' ? 'bg-[rgba(255,_71,_87,_0.18)]' : 'bg-transparent'} ${activePanel === 'live' ? 'border-[#ff4757]' : 'border-line'} ${activePanel === 'live' ? 'text-[#ff4757]' : 'text-muted'}`}
          onClick={() => setActivePanel((p) => (p === 'live' ? null : 'live'))}
        >
          <span className="results-toggle-icon">🔴</span> Partidos
        </button>
      )}
      <div className="inline-flex bg-[rgba(15,_23,_42,_0.8)] p-1 rounded-[16px] border border-[rgba(255,_255,_255,_0.12)] shadow-[0_8px_25px_rgba(0,_0,_0,_0.5),_inset_0_1px_0_rgba(255,_255,_255,_0.1)] [backdrop-filter:blur(12px)] gap-1">
        <button
          className={`[padding:clamp(7px,_1.6vw,_8px)_clamp(9px,_2.6vw,_22px)] font-extrabold text-[clamp(0.76rem,_3vw,_0.95rem)] border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'cuadro' ? 'bg-[linear-gradient(135deg,_#00d2d3,_#01a3a4)]' : 'bg-transparent'} ${activeTab === 'cuadro' ? 'text-black' : 'text-muted'} ${activeTab === 'cuadro' ? 'shadow-[0_4px_15px_rgba(0,_210,_211,_0.4)]' : 'shadow-none'}`}
          type="button"
          onClick={() => setActiveTab('cuadro')}
        >
          🏆 Cuadro
        </button>
        <button
          className={`[padding:clamp(7px,_1.6vw,_8px)_clamp(9px,_2.6vw,_22px)] font-extrabold text-[clamp(0.76rem,_3vw,_0.95rem)] border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'grupos' ? 'bg-[linear-gradient(135deg,_#00d2d3,_#01a3a4)]' : 'bg-transparent'} ${activeTab === 'grupos' ? 'text-black' : 'text-muted'} ${activeTab === 'grupos' ? 'shadow-[0_4px_15px_rgba(0,_210,_211,_0.4)]' : 'shadow-none'}`}
          type="button"
          onClick={() => setActiveTab('grupos')}
        >
          📋 Grupos
        </button>
      </div>
      {activeTab === 'cuadro' && activeGroupPichichi && (
        <button
          className={`glass-btn [padding:clamp(4px,_1.1vw,_6px)_clamp(5px,_1.5vw,_10px)] text-[clamp(0.6rem,_2.4vw,_0.8rem)] font-bold min-h-auto self-stretch rounded-[12px] [transition:all_0.2s] cursor-pointer whitespace-nowrap ${activePanel === 'scorers' ? 'bg-[rgba(255,_211,_42,_0.18)]' : 'bg-transparent'} ${activePanel === 'scorers' ? 'border-[#ffd32a]' : 'border-line'} ${activePanel === 'scorers' ? 'text-[#ffd32a]' : 'text-muted'}`}
          onClick={() => setActivePanel((p) => (p === 'scorers' ? null : 'scorers'))}
        >
          <span className="results-toggle-icon">🏆</span> Pichichi
        </button>
      )}
    </div>
  );
}
