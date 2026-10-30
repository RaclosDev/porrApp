import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { fetchGroupInvitationPreview, fetchMyGroups } from '../services/api';

/**
 * Resuelve enlaces de invitación:
 * - Si el usuario ya pertenece a la liga, la selecciona y la abre directamente.
 * - En caso contrario, conserva el código para mostrar la invitación en Mis Ligas.
 */
export default function JoinRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, userName, changeGroup } = useAppContext();

  useEffect(() => {
    let cancelled = false;

    const resolveInvitation = async () => {
      if (!code) {
        navigate('/mis-ligas', { replace: true });
        return;
      }

      const normalizedCode = code.trim().toUpperCase();
      localStorage.setItem('pendingJoinCode', normalizedCode);

      try {
        // La previsualización pública permite resolver el código a un ID sin unirse.
        const invitation = await fetchGroupInvitationPreview(normalizedCode);
        if (cancelled) return;

        if (isAuthenticated && userName) {
          const myGroups = await fetchMyGroups();
          if (cancelled) return;

          const existingGroup = myGroups.find(
            (group) => String(group.id) === String(invitation.id),
          );

          if (existingGroup) {
            localStorage.removeItem('pendingJoinCode');
            changeGroup(String(existingGroup.id));
            toast.success(
              `Ya perteneces a "${existingGroup.name || invitation.name}". Te hemos abierto la liga.`,
            );
            navigate(
              (invitation.poolFormat || existingGroup.poolFormat) === 'MATCH_DAY'
                ? '/jornadas'
                : '/',
              { replace: true },
            );
            return;
          }
        }

        navigate('/mis-ligas', { replace: true });
      } catch {
        // Mantener el flujo de invitación existente para mostrar el error en Mis Ligas.
        if (!cancelled) navigate('/mis-ligas', { replace: true });
      }
    };

    resolveInvitation();
    return () => {
      cancelled = true;
    };
  }, [code, navigate, isAuthenticated, userName, changeGroup]);

  return (
    <div className="text-center p-10 text-white">
      <p>Comprobando invitación...</p>
    </div>
  );
}
