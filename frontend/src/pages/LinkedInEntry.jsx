import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

/**
 * LinkedInEntry — Página de entrada para visitantes de LinkedIn.
 *
 * Al montar este componente:
 *  1. Activa el "guest_mode" en localStorage (permite navegar sin login).
 *  2. Fuerza la liga activa a la Porra Global (id = 1).
 *  3. Redirige automáticamente a la Clasificación.
 *
 * La URL de compartir en LinkedIn sería: https://porra.raclos.es/linkedin
 */
const GLOBAL_LEAGUE_ID = '1';

export default function LinkedInEntry() {
  const navigate = useNavigate();
  const { changeGroup } = useAppContext();

  useEffect(() => {
    // 1. Activar modo invitado
    localStorage.setItem('guest_mode', 'true');

    // 2. Forzar Porra Global (id 1)
    localStorage.setItem('activeGroupId', GLOBAL_LEAGUE_ID);
    changeGroup(GLOBAL_LEAGUE_ID);

    // 3. Redirigir al Home
    navigate('/', { replace: true });
  }, [navigate, changeGroup]);

  // Pantalla de transición mínima mientras redirige
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px',
      color: 'var(--text-muted, #94a3b8)',
      fontSize: '1rem'
    }}>
      <span style={{ fontSize: '2.5rem' }}>⚽</span>
      <span>Cargando Porra Global...</span>
    </div>
  );
}
