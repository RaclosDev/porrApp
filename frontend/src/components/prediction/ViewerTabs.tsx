import { type ViewerTab } from './viewerTypes';
interface ViewerTabsProps {
  activeTab: ViewerTab;
  setActiveTab: (tab: ViewerTab) => void;
}

/** Pestañas para cambiar entre grupos, terceros y cuadro. */
export default function ViewerTabs({ activeTab, setActiveTab }: ViewerTabsProps) {
  return (
    <div className="flex justify-center items-center mb-5 mt-[5px]">
      <div
        role="tablist"
        aria-label="Secciones de la porra"
        className="grid grid-cols-[repeat(3,_minmax(0,_1fr))] w-full max-w-130 box-border bg-[rgba(15,_23,_42,_0.8)] bg-none p-1 rounded-[16px] border border-[rgba(255,_255,_255,_0.12)] shadow-[0_8px_25px_rgba(0,_0,_0,_0.5),_inset_0_1px_0_rgba(255,_255,_255,_0.1)] [backdrop-filter:blur(12px)] gap-1"
      >
        <button
          className={`py-2 px-1.5 font-extrabold text-[clamp(0.7rem,_3vw,_0.95rem)] min-w-0 justify-center border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'groups' ? 'bg-[linear-gradient(135deg,_#00d2d3,_#01a3a4)] bg-transparent' : 'bg-transparent bg-none'} ${activeTab === 'groups' ? 'text-black' : 'text-muted'} ${activeTab === 'groups' ? 'shadow-[0_4px_15px_rgba(0,_210,_211,_0.4)]' : 'shadow-none'}`}
          type="button"
          onClick={() => setActiveTab('groups')}
          role="tab"
          id="viewer-tab-groups"
          aria-selected={activeTab === 'groups'}
        >
          Grupos
        </button>
        <button
          className={`py-2 px-1.5 font-extrabold text-[clamp(0.7rem,_3vw,_0.95rem)] min-w-0 justify-center border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'thirds' ? 'bg-[linear-gradient(135deg,_#a29bfe,_#6c5ce7)] bg-transparent' : 'bg-transparent bg-none'} ${activeTab === 'thirds' ? 'text-white' : 'text-muted'} ${activeTab === 'thirds' ? 'shadow-[0_4px_15px_rgba(108,_92,_231,_0.4)]' : 'shadow-none'}`}
          type="button"
          onClick={() => setActiveTab('thirds')}
          role="tab"
          id="viewer-tab-thirds"
          aria-selected={activeTab === 'thirds'}
        >
          Terceros
        </button>
        <button
          className={`py-2 px-1.5 font-extrabold text-[clamp(0.7rem,_3vw,_0.95rem)] min-w-0 justify-center border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${activeTab === 'bracket' ? 'bg-[linear-gradient(135deg,_#ff9f43,_#ffaf60)] bg-transparent' : 'bg-transparent bg-none'} ${activeTab === 'bracket' ? 'text-black' : 'text-muted'} ${activeTab === 'bracket' ? 'shadow-[0_4px_15px_rgba(255,_159,_67,_0.4)]' : 'shadow-none'}`}
          type="button"
          onClick={() => setActiveTab('bracket')}
          role="tab"
          id="viewer-tab-bracket"
          aria-selected={activeTab === 'bracket'}
        >
          Bracket
        </button>
      </div>
    </div>
  );
}
