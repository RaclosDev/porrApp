import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PaperLoading from '../components/PaperLoading';
import { joinTracker } from '../services/endpoints/trackers';
import { queryKeys } from '../services/queryKeys';
import { errorMessage } from '../utils/errors';

/** Enlace de invitación a un marcador: entra con el código y abre el marcador en directo. */
export default function JoinTracker() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    joinTracker(code.trim().toUpperCase())
      .then(async (tracker) => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.trackers() });
        navigate(`/marcador/${tracker.id}`, { replace: true });
      })
      .catch((reason) => setError(errorMessage(reason, 'No se pudo entrar al marcador')));
  }, [code, navigate, queryClient]);

  if (!error) return <PaperLoading label="Entrando al marcador" />;
  return (
    <section className="view-section active create-league">
      <div className="paper-panel album-sheet create-league-sheet">
        <h1 className="poster-title create-league-title">No se pudo entrar</h1>
        <p role="alert">{error}</p>
        <Link to="/mis-ligas" className="glass-btn create-league-nav-btn">
          Ir a Mis ligas
        </Link>
      </div>
    </section>
  );
}
