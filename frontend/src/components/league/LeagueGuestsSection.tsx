import { useState } from 'react';
import { Loader2, UserMinus, UserRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserAvatar } from '../Avatar';
import { fetchPokerLeague, removePokerGuest } from '../../services/endpoints/poker';
import { deleteTrackerPlayer, fetchTracker } from '../../services/endpoints/trackers';
import { queryKeys } from '../../services/queryKeys';
import { errorMessage } from '../../utils/errors';

interface Guest {
  id: number;
  name: string;
}

/** Cómo lee y quita invitados cada tipo de liga; la lista y la confirmación son comunes. */
interface GuestSource<T> {
  key: QueryKey;
  fetch: () => Promise<T>;
  guests: (data: T) => Guest[];
  remove: (playerId: number) => Promise<T>;
  hint: string;
}

const pokerSource = (
  leagueId: number,
): GuestSource<Awaited<ReturnType<typeof fetchPokerLeague>>> => ({
  key: queryKeys.poker(leagueId),
  fetch: () => fetchPokerLeague(String(leagueId)),
  guests: (league) => league.players.filter((player) => player.guest),
  remove: (playerId) => removePokerGuest(leagueId, playerId),
  hint: 'Se apuntaron en un torneo sin crearse una cuenta. Si quitas a uno, en el histórico se conserva su nombre.',
});

const trackerSource = (
  leagueId: number,
): GuestSource<Awaited<ReturnType<typeof fetchTracker>>> => ({
  key: queryKeys.tracker(leagueId),
  fetch: () => fetchTracker(leagueId),
  guests: (tracker) =>
    tracker.players.filter((player) => !tracker.claimedPlayerIds.includes(player.id)),
  remove: (playerId) => deleteTrackerPlayer(leagueId, playerId),
  hint: 'Jugadores añadidos sin cuenta. Solo se puede quitar a quien aún no ha jugado; si ya jugó, júntalo con otro desde el marcador.',
});

/**
 * Invitados sin cuenta de una liga (póker o juegos de mesa), en la administración de miembros, bajo
 * los miembros con cuenta. Quien administra los puede quitar. El resto de ligas no tiene invitados.
 */
export default function LeagueGuestsSection({
  leagueId,
  leagueKind,
  isAdmin,
}: {
  leagueId: number;
  leagueKind?: string;
  isAdmin: boolean;
}) {
  if (leagueKind === 'POKER') return <GuestList source={pokerSource(leagueId)} isAdmin={isAdmin} />;
  if (leagueKind === 'SCOREBOARD') {
    return <GuestList source={trackerSource(leagueId)} isAdmin={isAdmin} />;
  }
  return null;
}

function GuestList<T>({ source, isAdmin }: { source: GuestSource<T>; isAdmin: boolean }) {
  const client = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);
  const { data, isPending } = useQuery({ queryKey: source.key, queryFn: source.fetch });
  const remove = useMutation({
    mutationFn: source.remove,
    onSuccess: (next) => {
      client.setQueryData(source.key, next);
      setConfirming(null);
      toast.success('Invitado quitado de la liga');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se ha podido quitar al invitado')),
  });

  const guests = (data ? source.guests(data) : []).sort((a, b) =>
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }),
  );
  if (isPending || guests.length === 0) return null;

  return (
    <section className="league-admin-card" aria-labelledby="league-guests-title">
      <div className="league-admin-card-head">
        <h3 id="league-guests-title">
          <UserRound size={14} aria-hidden="true" />
          Invitados sin cuenta ({guests.length})
        </h3>
      </div>
      <p className="league-admin-hint">{source.hint}</p>
      <div className="league-admin-member-list">
        {guests.map((guest) => {
          const isConfirming = confirming === guest.id;
          const pending = remove.isPending && remove.variables === guest.id;
          return (
            <article
              key={guest.id}
              className={`league-admin-member ${isConfirming ? 'is-confirming' : ''}`}
            >
              <div className="league-admin-member-main">
                <UserAvatar url={null} userId={`guest-${guest.id}`} name={guest.name} size={38} />
                <div className="league-admin-member-info">
                  <div className="league-admin-member-name">
                    <span>{guest.name}</span>
                    <span className="league-admin-badge">Invitado</span>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="league-admin-member-actions">
                  {isConfirming ? (
                    <div
                      className="league-admin-inline-confirm"
                      role="group"
                      aria-label={`Confirmar quitar a ${guest.name}`}
                    >
                      <span>¿Quitar?</span>
                      <button
                        type="button"
                        className="league-admin-mini-btn is-danger"
                        onClick={() => remove.mutate(guest.id)}
                        disabled={pending}
                      >
                        {pending ? (
                          <Loader2 className="league-admin-spin" size={12} aria-hidden="true" />
                        ) : (
                          'Sí'
                        )}
                      </button>
                      <button
                        type="button"
                        className="league-admin-mini-btn"
                        onClick={() => setConfirming(null)}
                        disabled={pending}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="league-admin-icon-btn is-danger"
                      onClick={() => setConfirming(guest.id)}
                      title={`Quitar a ${guest.name}`}
                      aria-label={`Quitar a ${guest.name}`}
                    >
                      <UserMinus size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
