import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { GLOBAL_LEAGUE_ID } from '../utils/constants';

/**
 * Componente temporal que maneja el redireccionamiento para usuarios que
 * acceden a través del navegador embebido de LinkedIn, el cual tiene problemas
 * con la apertura del teclado virtual y ciertas cookies en móviles.
 * Invita al usuario a abrir la página en su navegador nativo.
 *
 * @component
 * @returns {JSX.Element|null} La vista de redirección de LinkedIn.
 */

/**
 * LinkedInEntry : Página de entrada para visitantes de LinkedIn.
 *
 * Al montar este componente:
 *  Activa el "guest_mode" en localStorage (permite navegar sin login).
 *  Fuerza la liga activa a la Porra Global.
 *  Redirige automáticamente a la Clasificación.
 *
 * La URL de compartir en LinkedIn sería: https://porra.raclos.es/linkedin
 */

export default function LinkedInEntry() {
  const navigate = useNavigate();
  const { changeGroup } = useAppContext();

  useEffect(() => {
    localStorage.setItem('guest_mode', 'true');
    localStorage.setItem('activeGroupId', GLOBAL_LEAGUE_ID);
    changeGroup(GLOBAL_LEAGUE_ID);
    navigate('/', { replace: true });
  }, [navigate, changeGroup]);

  // Pantalla de transición mínima mientras redirige
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted text-[1rem]">
      <span className="text-[2.5rem]">⚽</span>
      <span>Cargando Porra Global...</span>
    </div>
  );
}
