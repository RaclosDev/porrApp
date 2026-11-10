import PaperLoading from './PaperLoading';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AuthPanel from './AuthPanel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '../context/AppContext';
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useGoogleSignIn';
import { usePasskeyAutoSignIn } from '../hooks/usePasskeyAutoSignIn';
import { fetchGroupInvitationPreview, joinGroup } from '../services/api';
import { myGroupsQuery } from '../services/queries';
import { queryKeys } from '../services/queryKeys';
import { LeagueAvatar } from './Avatar';
import { errorMessage } from '../utils/errors';
import type { Group } from '../types/api';
import { isMatchBasedFormat } from '../utils/poolFormat';
import { isScoreboardLeague } from '../utils/scoreboardLeague';

/** Dónde empieza la liga recién abierta: las de jornadas en sus jornadas; el resto, en el inicio. */
const landingOf = (scoreboard: boolean, poolFormat?: string | null) =>
  !scoreboard && isMatchBasedFormat(poolFormat) ? '/jornadas' : '/';

/** La invitación conserva su contexto durante el acceso y abre la liga al aceptar. */
export default function JoinRedirect() {
  const { code = '' } = useParams();
  const normalizedCode = code.trim().toUpperCase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, userName, changeGroup } = useAppContext();
  const signedIn = isAuthenticated && Boolean(userName);
  const signIn = useGoogleSignIn({ navigateAfterLogin: false });
  const appleSignIn = useAppleSignIn({ navigateAfterLogin: false });
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

  // Una liga de juegos de mesa no tiene jornadas: su inicio es el marcador.
  const scoreboard = isScoreboardLeague(preview);

  useEffect(() => {
    if (!signedIn || !preview || joining.current) return;
    const existing = membership.data?.find((group) => String(group.id) === String(preview.id));
    if (!existing) return;
    localStorage.removeItem('pendingJoinCode');
    changeGroup(String(existing.id));
    navigate(landingOf(scoreboard, preview.poolFormat || existing.poolFormat), { replace: true });
  }, [signedIn, preview, scoreboard, membership.data, changeGroup, navigate]);

  /** @param signInFirst inicio de sesión que hacer antes de unirse; si falla, no se une */
  const accept = async (signInFirst?: () => Promise<boolean>) => {
    if (!preview || joining.current) return;
    joining.current = true;
    setBusy(true);
    setError('');
    try {
      if (signInFirst && !(await signInFirst())) return;
      const group = await joinGroup(normalizedCode);
      await queryClient.cancelQueries({ queryKey: queryKeys.myGroups() });
      queryClient.setQueryData<Group[]>(queryKeys.myGroups(true), (groups = []) => [
        ...groups.filter((item) => String(item.id) !== String(group.id)),
        group,
      ]);
      queryClient.setQueryData(queryKeys.group(String(group.id)), group);
      localStorage.removeItem('pendingJoinCode');
      changeGroup(String(group.id));
      navigate(landingOf(scoreboard, group.poolFormat || preview.poolFormat), { replace: true });
    } catch (cause) {
      setError(errorMessage(cause, 'No se ha podido entrar en la liga. Inténtalo de nuevo.'));
    } finally {
      joining.current = false;
      setBusy(false);
    }
  };

  // Con llave de acceso en este dispositivo, se pide nada más ver la invitación y después se une.
  usePasskeyAutoSignIn(Boolean(preview) && !signedIn, () => void accept(), {
    navigateAfterLogin: false,
  });

  return (
    <section className="max-w-130 mx-auto my-8">
      <div className="paper-panel album-sheet landing-tape p-6 sm:p-8 flex flex-col gap-5">
        <p className="marker-ink m-0">Te han invitado a jugar</p>
        {invitation.isPending && normalizedCode ? (
          <PaperLoading label="Cargando invitación" embedded />
        ) : null}
        {preview && (
          <>
            <div className="flex items-center gap-4 min-w-0">
              <LeagueAvatar url={preview.imageUrl} name={preview.name} size={64} />
              <h1 className="poster-title text-2xl m-0 break-words min-w-0">{preview.name}</h1>
            </div>
            <p className="m-0 text-muted">
              {scoreboard
                ? 'Juego de mesa'
                : `${preview.competitionName || 'Fútbol'} · ${
                    preview.poolFormat === 'SURVIVOR'
                      ? 'Superviviente'
                      : preview.poolFormat === 'MATCH_DAY'
                        ? 'Por jornadas'
                        : 'Cuadro del torneo'
                  }`}
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
              <AuthPanel
                intent="signup"
                hideHeading
                lede={`Crea tu cuenta o entra para unirte a esta liga. Después te llevaremos directamente ${scoreboard ? 'al marcador' : 'a tu porra'}.`}
                onGoogleSuccess={(response) => accept(() => signIn(response))}
                onApple={() => accept(appleSignIn)}
                signInOptions={{ navigateAfterLogin: false }}
                onSignedIn={() => accept()}
                shape="rectangular"
              />
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
