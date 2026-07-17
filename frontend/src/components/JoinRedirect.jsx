import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * Componente que gestiona el enrutamiento y guardado de un código de invitación 
 * a una liga cuando el usuario entra a través de un enlace directo (/join/:code).
 *
 * @component
 * @returns {JSX.Element} Mensaje temporal mientras redirige.
 */
export default function JoinRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  /**
   * Si existe un código en la URL, lo guarda en LocalStorage y redirige
   * a la vista de "Mis Ligas" donde será procesado (se autocompletará en el input de unirse).
   */
  useEffect(() => {
    if (code) {
      localStorage.setItem('pendingJoinCode', code.toUpperCase());
    }
    navigate('/mis-ligas');
  }, [code, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '40px', color: 'white' }}>
      <p>Procesando invitación...</p>
    </div>
  );
}
