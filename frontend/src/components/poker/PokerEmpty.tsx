import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Icon = 'cards' | 'history' | 'stats';

/** Hueco de una sección que aún no tiene datos: dice qué saldrá aquí y cómo llegar a ello. */
export default function PokerEmpty({
  icon,
  title,
  children,
  action,
}: {
  icon: Icon;
  title: string;
  children: ReactNode;
  action?: { to: string; label: string };
}) {
  return (
    <div className="poker-blank">
      <span className="poker-blank-icon" aria-hidden="true">
        <EmptyIcon icon={icon} />
      </span>
      <p className="poker-blank-title">{title}</p>
      <p className="poker-note">{children}</p>
      {action && (
        <Link className="glass-btn primary-btn" to={action.to}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

function EmptyIcon({ icon }: { icon: Icon }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === 'cards' && (
        <>
          <rect x="3" y="5" width="10" height="14" rx="1.5" transform="rotate(-10 8 12)" />
          <rect x="10" y="4" width="10" height="14" rx="1.5" transform="rotate(8 15 11)" />
          <path d="M15.3 8.6c-.9 1-2 1.9-2 2.9a1.2 1.2 0 0 0 2 .9 1.2 1.2 0 0 0 2-.6c0-1-1.1-2.1-2-3.2Z" />
        </>
      )}
      {icon === 'history' && (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {icon === 'stats' && (
        <>
          <path d="M4 20h16" />
          <rect x="5" y="11" width="3.5" height="6" rx="0.8" />
          <rect x="10.25" y="6" width="3.5" height="11" rx="0.8" />
          <rect x="15.5" y="13" width="3.5" height="4" rx="0.8" />
        </>
      )}
    </svg>
  );
}
