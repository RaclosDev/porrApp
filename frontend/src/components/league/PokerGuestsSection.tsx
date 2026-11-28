import { useState } from 'react';
import { Loader2, UserMinus, UserRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserAvatar } from '../Avatar';
import { fetchPokerLeague, removePokerGuest } from '../../services/endpoints/poker';
import { queryKeys } from '../../services/queryKeys';
import { errorMessage } from '../../utils/errors';

/**
 * Invitados sin cuenta de una liga de póker, en la administración de miembros. Quien administra los
 * puede quitar; en el histórico se queda su nombre.
 */
export default function PokerGuestsSection({
  leagueId,
  isAdmin,
}: {
  leagueId: number;
  isAdmin: boolean;
}) {
  const client = useQueryClient();
  const key = queryKeys.poker(leagueId);
  const [confirming, setConfirming] = useState<number | null>(null);
  const { data, isPending } = useQuery({
    queryKey: key,
    queryFn: () => fetchPokerLeague(String(leagueId)),
  });
  const remove = useMutation({
    mutationFn: (playerId: number) => removePokerGuest(leagueId, playerId),
    onSuccess: (league) => {
      client.setQueryData(key, league);
      setConfirming(null);
      toast.success('Invitado quitado de la liga');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se ha podido quitar al invitado')),
  });

  const guests = (data?.players ?? [])
    .filter((player) => player.guest)
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  if (isPending || guests.length === 0) return null;

  return (
    <section className="league-admin-card" aria-labelledby="poker-guests-title">
      <div className="league-admin-card-head">
        <h3 id="poker-guests-title">
          <UserRound size={14} aria-hidden="true" />
          Invitados sin cuenta ({guests.length})
        </h3>
      </div>
      <p className="league-admin-hint">
        Se apuntaron en un torneo sin crearse una cuenta. Si quitas a uno, en el histórico se
        conserva su nombre.
      </p>
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
                <UserAvatar url={null} userId={`poker-${guest.id}`} name={guest.name} size={38} />
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
