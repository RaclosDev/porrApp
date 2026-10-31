import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { queryKeys } from '../services/queryKeys';
import { useAppStore } from '../store/useAppStore';
import { Skeleton } from './Skeleton';

export default function LeagueLoadState({ error }: { error?: unknown }) {
  const groupId = useAppStore((state) => state.activeGroupId);
  const client = useQueryClient();
  const queryKey = queryKeys.group(groupId);
  const retrying = useIsFetching({ queryKey, exact: true }) > 0;

  if (error) {
    return (
      <section className="league-load-error paper-panel album-sheet" role="alert">
        <h1>No hemos podido abrir la liga</h1>
        <p>Vuelve a intentarlo o elige otra de tus ligas.</p>
        <div className="league-load-error__actions">
          <button
            className="landing-btn landing-btn-ink"
            disabled={retrying || !groupId}
            onClick={() => {
              void client.refetchQueries({ queryKey, exact: true }, { cancelRefetch: false });
            }}
          >
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </button>
          <Link className="landing-link" to="/mis-ligas">
            Ver mis ligas
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      className="league-loading paper-panel album-sheet"
      role="status"
      aria-label="Cargando liga"
      aria-busy="true"
    >
      <span className="sr-only">Cargando liga</span>
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
