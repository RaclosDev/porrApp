/**
 * Bloques de carga con brillo que sustituyen a los textos de "Cargando...".
 * Mantienen el layout estable y solo anuncian el estado a lectores de pantalla.
 */

/**
 * @typedef {Object} SkeletonProps
 * @property {string|number} [width]
 * @property {string|number} [height]
 * @property {string|number} [radius]
 * @property {string} [className]
 */

/**
 * @param {SkeletonProps} props
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

/**
 * @param {{ compact?: boolean }} props
 */
export function PredictionSkeleton({ compact = false }) {
  return (
    <div
      className={['prediction-skeleton', compact ? 'is-compact' : ''].filter(Boolean).join(' ')}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Cargando pronóstico</span>
      <div className="prediction-skeleton-head">
        <Skeleton width="42%" height={22} />
        <div className="prediction-skeleton-tags">
          <Skeleton width={96} height={26} />
          <Skeleton width={124} height={26} />
        </div>
      </div>
      <div className="prediction-skeleton-pills">
        <Skeleton height={42} radius={14} />
      </div>
      <div className="prediction-skeleton-grid">
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} height={compact ? 64 : 110} radius={12} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="page-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando</span>
      <Skeleton width="38%" height={26} />
      <Skeleton height={64} radius={12} />
      <Skeleton height={64} radius={12} />
      <Skeleton height={64} radius={12} />
    </div>
  );
}
