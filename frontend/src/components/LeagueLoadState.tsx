import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { queryKeys } from '../services/queryKeys';
import { useAppStore } from '../store/useAppStore';
import PaperLoading from './PaperLoading';

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

  return <PaperLoading label="Cargando liga" />;
}
