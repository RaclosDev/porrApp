import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import LeagueLoadState from './LeagueLoadState';

/** Sin liga activa: qué hacer para tenerla. Es el mismo aviso en todas las pantallas de liga. */
export function NoLeagueState({ title, what }: { title: string; what: string }) {
  const { isAuthenticated, userName } = useAppContext();
  const signedIn = isAuthenticated && Boolean(userName);
  return (
    <section className="view-section active">
      <div className="paper-panel album-sheet text-center py-10 px-6 max-w-140 mx-auto my-5">
        <h2 className="poster-title mt-0 mb-2 text-[1.5rem]">{title}</h2>
        <p className="text-muted text-[0.92rem] mt-0 mb-5">
          {signedIn
            ? `Únete a una liga o crea la tuya para ver ${what}.`
            : `Inicia sesión para ver ${what} de tus ligas.`}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          {signedIn ? (
            <>
              <Link to="/mis-ligas" className="glass-btn primary-btn py-2.5 px-5 font-extrabold">
                Ir a Mis ligas
              </Link>
              <Link to="/crear-liga" className="glass-btn py-2.5 px-5 font-bold">
                Crear liga
              </Link>
            </>
          ) : (
            <>
              <Link to="/" className="glass-btn primary-btn py-2.5 px-5 font-extrabold">
                Iniciar sesión
              </Link>
              <Link to="/demo" className="glass-btn py-2.5 px-5 font-bold">
                Ver la demo
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Pantalla de una liga: sin liga activa no enseña nada de ninguna competición (antes caía en el
 * Mundial), sino el aviso para unirse o crear una. Mientras se elige o llega la liga, carga.
 */
export function RequireLeague({
  title,
  what,
  children,
}: {
  title: string;
  what: string;
  children: ReactNode;
}) {
  const {
    activeGroupId,
    isDemoMode,
    choosingLeague,
    isAuthenticated,
    userGroups,
    userGroupsLoaded,
  } = useAppContext();
  if (activeGroupId) return children;
  // La demo abre enseguida la liga pública destacada; con sesión y ligas, se abre la más reciente.
  const opening =
    isDemoMode ||
    choosingLeague ||
    (isAuthenticated && (!userGroupsLoaded || userGroups.length > 0));
  if (opening) return <LeagueLoadState />;
  return <NoLeagueState title={title} what={what} />;
}
