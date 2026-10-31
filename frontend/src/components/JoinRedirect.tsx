import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { fetchGroupInvitationPreview, joinGroup } from '../services/api';
import { myGroupsQuery } from '../services/queries';
import { queryKeys } from '../services/queryKeys';
import { LeagueAvatar } from './Avatar';
import { errorMessage } from '../utils/errors';
import type { Group } from '../types/api';

/** La invitación conserva su contexto durante el acceso y abre la liga al aceptar. */
export default function JoinRedirect() {
  const { code = '' } = useParams();
  const normalizedCode = code.trim().toUpperCase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, userName, changeGroup } = useAppContext();
  const signedIn = isAuthenticated && Boolean(userName);
  const signIn = useGoogleSignIn({ navigateAfterLogin: false });
  const joining = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const invitation = useQuery({
    queryKey: ['invitation', normalizedCode],
    queryFn: () => fetchGroupInvitationPreview(normalizedCode),
    enabled: Boolean(normalizedCode),
    retry: false,
  });
  const membership = useQuery(myGroupsQuery(signedIn));
  const preview = invitation.data;

  useEffect(() => {
    if (normalizedCode) localStorage.setItem('pendingJoinCode', normalizedCode);
  }, [normalizedCode]);

  useEffect(() => {
    if (!signedIn || !preview || joining.current) return;
    const existing = membership.data?.find((group) => String(group.id) === String(preview.id));
    if (!existing) return;
    localStorage.removeItem('pendingJoinCode');
    changeGroup(String(existing.id));
    navigate((preview.poolFormat || existing.poolFormat) === 'MATCH_DAY' ? '/jornadas' : '/', {
      replace: true,
    });
  }, [signedIn, preview, membership.data, changeGroup, navigate]);

  const accept = async (credential?: CredentialResponse) => {
    if (!preview || joining.current) return;
    joining.current = true;
    setBusy(true);
    setError('');
    try {
      if (credential && !(await signIn(credential))) return;
      const group = await joinGroup(normalizedCode);
      await queryClient.cancelQueries({ queryKey: queryKeys.myGroups() });
      queryClient.setQueryData<Group[]>(queryKeys.myGroups(true), (groups = []) => [
        ...groups.filter((item) => String(item.id) !== String(group.id)),
        group,
      ]);
      queryClient.setQueryData(queryKeys.group(String(group.id)), group);
      localStorage.removeItem('pendingJoinCode');
      changeGroup(String(group.id));
      navigate((group.poolFormat || preview.poolFormat) === 'MATCH_DAY' ? '/jornadas' : '/', {
        replace: true,
      });
    } catch (cause) {
      setError(errorMessage(cause, 'No se ha podido entrar en la liga. Inténtalo de nuevo.'));
    } finally {
      joining.current = false;
      setBusy(false);
    }
  };

  return (
    <section className="max-w-130 mx-auto my-8">
      <div className="paper-panel album-sheet landing-tape p-6 sm:p-8 flex flex-col gap-5">
        <p className="marker-ink m-0">Te han invitado a jugar</p>
        {invitation.isPending && normalizedCode ? <p role="status">Cargando invitación…</p> : null}
        {preview && (
          <>
            <div className="flex items-center gap-4 min-w-0">
              <LeagueAvatar url={preview.imageUrl} size={64} />
              <h1 className="poster-title text-2xl m-0 break-words min-w-0">{preview.name}</h1>
            </div>
            <p className="m-0 text-muted">
              {preview.competitionName || 'Fútbol'} ·{' '}
              {preview.poolFormat === 'MATCH_DAY' ? 'Por jornadas' : 'Cuadro del torneo'}
            </p>
            {busy ? (
              <p role="status">Preparando tu entrada en la liga…</p>
            ) : signedIn ? (
              <button
                type="button"
                className="landing-btn landing-btn-ink"
                onClick={() => accept()}
                disabled={membership.isPending}
              >
                Unirme a la liga
              </button>
            ) : (
              <>
                <p className="m-0">
                  Continúa con Google para unirte a esta liga. Después te llevaremos directamente a
                  tu porra.
                </p>
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={(response) => accept(response)}
                    onError={() =>
                      setError('No se ha podido iniciar sesión. Puedes volver a intentarlo.')
                    }
                    theme="outline"
                    shape="rectangular"
                    text="continue_with"
                  />
                </div>
              </>
            )}
          </>
        )}
        {(invitation.isError || !normalizedCode) && (
          <p role="alert">
            Esta invitación no está disponible. Pide un nuevo enlace a quien te invitó.
          </p>
        )}
        {error && (
          <p role="alert" className="text-[#b91c1c]">
            {error}
          </p>
        )}
        <button
          type="button"
          className="landing-link self-start bg-transparent border-none cursor-pointer min-h-11"
          disabled={busy}
          onClick={() => {
            localStorage.removeItem('pendingJoinCode');
            navigate('/', { replace: true });
          }}
        >
          Ahora no
        </button>
      </div>
    </section>
  );
}
