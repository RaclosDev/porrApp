import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { DEMO_LEAGUES, leaveDemo } from './mode';

/** Aviso fijo de la demo: recuerda que los datos son ficticios y deja cambiar de liga o salir. */
export default function DemoBar() {
  const navigate = useNavigate();
  const activeGroupId = useAppStore((state) => state.activeGroupId);
  const changeGroup = useAppStore((state) => state.changeGroup);

  return (
    <div
      id="demo-mode-banner"
      className="sticky top-0 z-[110] flex items-center justify-between gap-2 bg-[var(--paper)] px-3 py-1 text-[0.8rem] text-[var(--ink)]"
    >
      <span className="min-w-0 truncate">
        <strong>Demo</strong> · datos ficticios
      </span>
      <div className="inline-flex shrink-0 items-center gap-1">
        {DEMO_LEAGUES.map((league) => (
          <button
            key={league.id}
            type="button"
            aria-pressed={activeGroupId === league.id}
            onClick={() => {
              changeGroup(league.id);
              navigate('/');
            }}
            className={`min-h-9 cursor-pointer whitespace-nowrap rounded-md border border-[var(--ink)] px-2 text-xs font-bold ${
              activeGroupId === league.id
                ? 'bg-[var(--ink)] text-[var(--paper)]'
                : 'bg-transparent text-[var(--ink)]'
            }`}
          >
            {league.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => leaveDemo()}
          className="min-h-9 cursor-pointer whitespace-nowrap border-none bg-transparent px-2 text-xs text-[#4b5563] underline"
        >
          Salir
        </button>
      </div>
    </div>
  );
}
