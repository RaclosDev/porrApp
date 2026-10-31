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
      <div role="tablist" aria-label="Secciones de la porra" className="paper-tabs max-w-130">
        {TABS.map(({ id, label }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              className={`paper-tab ${active ? 'is-active' : ''}`}
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
