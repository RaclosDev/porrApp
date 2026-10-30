import { type ViewerTab } from './viewerTypes';
interface ViewerTabsProps {
  activeTab: ViewerTab;
  setActiveTab: (tab: ViewerTab) => void;
}

const TABS: { id: ViewerTab; label: string }[] = [
  { id: 'groups', label: 'Grupos' },
  { id: 'thirds', label: 'Terceros' },
  { id: 'bracket', label: 'Cuadro' },
];

/** Pestañas para cambiar entre grupos, terceros y cuadro. */
export default function ViewerTabs({ activeTab, setActiveTab }: ViewerTabsProps) {
  return (
    <div className="flex justify-center items-center mb-5 mt-[5px]">
      <div
        role="tablist"
        aria-label="Secciones de la porra"
        className="grid grid-cols-[repeat(3,_minmax(0,_1fr))] w-full max-w-130 box-border bg-[rgba(17,_24,_39,_0.06)] bg-none p-1 rounded-[16px] border border-line gap-1"
      >
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              className={`py-2 px-1.5 font-extrabold text-[clamp(0.7rem,_3vw,_0.95rem)] min-w-0 justify-center border-none cursor-pointer rounded-[12px] [transition:all_0.25s_cubic-bezier(0.2,_0.8,_0.2,_1)] flex items-center gap-1.5 tracking-[0.5px] whitespace-nowrap ${active ? 'bg-[#111827] bg-none text-[#f3ecdc]' : 'bg-transparent bg-none text-muted'}`}
              type="button"
              onClick={() => setActiveTab(id)}
              role="tab"
              id={`viewer-tab-${id}`}
              aria-selected={active}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
