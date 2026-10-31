import { Skeleton } from './SkeletonBlock';

export default function PaperLoading({
  label = 'Cargando',
  embedded = false,
}: {
  label?: string;
  embedded?: boolean;
}) {
  return (
    <section
      className={
        embedded
          ? 'league-loading league-loading--embedded'
          : 'league-loading paper-panel album-sheet'
      }
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="league-loading__heading" aria-hidden="true">
        <Skeleton width="28%" height={12} />
        <Skeleton width="62%" height={32} />
        <Skeleton width="40%" height={14} />
      </div>
      <div className="league-loading__tabs" aria-hidden="true">
        <Skeleton width={104} height={38} radius={4} />
        <Skeleton width={88} height={38} radius={4} />
      </div>
      <div className="league-loading__grid" aria-hidden="true">
        {[0, 1].map((card) => (
          <div className="league-loading__card" key={card}>
            <Skeleton width="46%" height={18} />
            {[0, 1, 2, 3].map((row) => (
              <div className="league-loading__row" key={row}>
                <Skeleton width={28} height={28} radius={4} />
                <Skeleton width={row % 2 === 0 ? '58%' : '42%'} height={12} />
                <Skeleton width={32} height={18} radius={4} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
