import PaperLoading from '../components/PaperLoading';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { featuredGroupQuery } from '../services/queries';

/** Entrada desde LinkedIn: activa el modo invitado, abre la liga pública destacada y lleva a Inicio. */
export default function LinkedInEntry() {
  const navigate = useNavigate();
  const { changeGroup } = useAppContext();
  const { data: featured, isError } = useQuery(featuredGroupQuery());

  useEffect(() => {
    if (!featured && !isError) return;
    localStorage.setItem('guest_mode', 'true');
    if (featured) {
      localStorage.setItem('activeGroupId', String(featured.id));
      changeGroup(featured.id);
    }
    navigate('/', { replace: true });
  }, [featured, isError, navigate, changeGroup]);

  return <PaperLoading label="Cargando liga" />;
}
