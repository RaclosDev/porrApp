import PaperLoading from '../components/PaperLoading';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { GLOBAL_LEAGUE_ID } from '../utils/constants';

/** Entrada desde LinkedIn: activa el modo invitado, abre la Porra Global y lleva a Inicio. */
export default function LinkedInEntry() {
  const navigate = useNavigate();
  const { changeGroup } = useAppContext();

  useEffect(() => {
    localStorage.setItem('guest_mode', 'true');
    localStorage.setItem('activeGroupId', GLOBAL_LEAGUE_ID);
    changeGroup(GLOBAL_LEAGUE_ID);
    navigate('/', { replace: true });
  }, [navigate, changeGroup]);

  return <PaperLoading label="Cargando Porra Global" />;
}
