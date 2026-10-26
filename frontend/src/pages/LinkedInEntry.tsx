import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

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
 *  Fuerza la liga activa a la Porra Global (id = 1).
 *  Redirige automáticamente a la Clasificación.
 *
 * La URL de compartir en LinkedIn sería: https://porra.raclos.es/linkedin
 */
const GLOBAL_LEAGUE_ID = '1';

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '16px',
        color: 'var(--text-muted, #94a3b8)',
        fontSize: '1rem',
      }}
    >
      <span style={{ fontSize: '2.5rem' }}>⚽</span>
      <span>Cargando Porra Global...</span>
    </div>
  );
}
