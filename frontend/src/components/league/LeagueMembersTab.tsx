import type { Dispatch, SetStateAction } from 'react';
import type { GroupMember, PaymentStatus } from '../../types/api';
import { UserAvatar } from '../Avatar';
import type { CopyTarget, PaymentFilter } from '../GroupMembersModal';
import type { UseMutationResult } from '@tanstack/react-query';
import {
  Check,
  Clock3,
  Copy,
  Crown,
  Loader2,
  Link2,
  RefreshCw,
  Search,
  Share2,
  TriangleAlert,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react';

const PAYMENT_FILTERS: { id: PaymentFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PAID', label: 'Pagados' },
  { id: 'PENDING', label: 'Pendientes' },
];

interface LeagueMembersTabProps {
  members: GroupMember[];
  isLoading: boolean;
  error: Error | null;
  activeCode: string;
  confirmRegenerate: boolean;
  copiedTarget: CopyTarget | '';
  copyText: (text: string, target: CopyTarget, message: string) => Promise<void>;
  currentUserId: string | number | null;
  handleShare: () => Promise<void>;
  inviteLink: string;
  isAdmin: boolean;
  kickMutation: UseMutationResult<unknown, Error, number>;
  kickTargetId: number | null;
  paidCount: number;
  paidPercent: number;
  paymentFilter: PaymentFilter;
  paymentMutation: UseMutationResult<unknown, Error, { userId: number; status: PaymentStatus }>;
  pendingCount: number;
  regenerateMutation: UseMutationResult<unknown, Error, void>;
  search: string;
  setActionError: (message: string) => void;
  setConfirmRegenerate: Dispatch<SetStateAction<boolean>>;
  setKickTargetId: (id: number | null) => void;
  setPaymentFilter: (filter: PaymentFilter) => void;
  setSearch: (value: string) => void;
  visibleMembers: GroupMember[];
}

/** Miembros de la liga, invitación y control de pagos. */
export default function LeagueMembersTab({
  members,
  isLoading,
  error,
  activeCode,
  confirmRegenerate,
  copiedTarget,
  copyText,
  currentUserId,
  handleShare,
  inviteLink,
  isAdmin,
  kickMutation,
  kickTargetId,
  paidCount,
  paidPercent,
  paymentFilter,
  paymentMutation,
  pendingCount,
  regenerateMutation,
  search,
  setActionError,
  setConfirmRegenerate,
  setKickTargetId,
  setPaymentFilter,
  setSearch,
  visibleMembers,
}: LeagueMembersTabProps) {
  return (
    <div
      id="league-admin-panel-members"
      className="league-admin-panel-section"
      role={isAdmin ? 'tabpanel' : undefined}
      aria-labelledby={isAdmin ? 'league-admin-tab-members' : undefined}
    >
      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <Wallet size={14} aria-hidden="true" />
            Resumen de pagos
          </h3>
          <span className="league-admin-card-meta">
            {paidCount}/{members.length} pagados
          </span>
        </div>
        <div className="league-admin-stats">
          <div className="league-admin-stat">
            <span>
              <Users size={12} aria-hidden="true" />
              Miembros
            </span>
            <strong>{members.length}</strong>
          </div>
          <div className="league-admin-stat is-paid">
            <span>
              <Wallet size={12} aria-hidden="true" />
              Pagados
            </span>
            <strong>{paidCount}</strong>
          </div>
          <div className="league-admin-stat is-pending">
            <span>
              <Clock3 size={12} aria-hidden="true" />
              Pendientes
            </span>
            <strong>{pendingCount}</strong>
          </div>
        </div>
        <div className="league-admin-progress" aria-hidden="true">
          <span style={{ width: `${paidPercent}%` }} />
        </div>
        <p className="league-admin-progress-label">
          {paidPercent}% de los participantes han pagado
        </p>
      </section>

      <section className="league-admin-card">
        <div className="league-admin-card-head">
          <h3>
            <Link2 size={14} aria-hidden="true" />
            Invitar a la liga
          </h3>
          {isAdmin && (
            <button
              type="button"
              className="league-admin-text-btn"
              onClick={() => setConfirmRegenerate((open) => !open)}
            >
              <RefreshCw size={13} aria-hidden="true" />
              Regenerar código
            </button>
          )}
        </div>
        <p className="league-admin-muted">
          Comparte el código o el enlace. Quien lo tenga podrá unirse a la liga.
        </p>
        <div className="league-admin-invite">
          <button
            type="button"
            className="league-admin-code"
            onClick={() => copyText(activeCode, 'code', 'Código copiado')}
            disabled={!activeCode}
            title="Copiar código de invitación"
            aria-label={`Copiar código de invitación ${activeCode}`}
          >
            <span>{activeCode || 'Sin código'}</span>
            {copiedTarget === 'code' ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}
          </button>
          <div className="league-admin-invite-actions">
            <button
              type="button"
              className={`league-admin-btn ${copiedTarget === 'link' ? 'is-success' : ''}`}
              onClick={() => copyText(inviteLink, 'link', 'Enlace de invitación copiado')}
              disabled={!activeCode}
            >
              {copiedTarget === 'link' ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
              {copiedTarget === 'link' ? 'Copiado' : 'Copiar enlace'}
            </button>
            <button
              type="button"
              className="league-admin-btn is-primary"
              onClick={handleShare}
              disabled={!activeCode}
            >
              <Share2 size={15} aria-hidden="true" />
              Compartir
            </button>
          </div>
        </div>

        {isAdmin && confirmRegenerate && (
          <div className="league-admin-confirm-box">
            <span>
              <TriangleAlert size={14} aria-hidden="true" />
              El código actual dejará de funcionar para nuevas altas.
            </span>
            <div>
              <button
                type="button"
                className="league-admin-btn is-danger"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
              >
                {regenerateMutation.isPending ? (
                  <Loader2 className="league-admin-spin" size={14} aria-hidden="true" />
                ) : (
                  <RefreshCw size={14} aria-hidden="true" />
                )}
                {regenerateMutation.isPending ? 'Regenerando…' : 'Regenerar'}
              </button>
              <button
                type="button"
                className="league-admin-btn is-ghost"
                onClick={() => setConfirmRegenerate(false)}
                disabled={regenerateMutation.isPending}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="league-admin-toolbar">
        <div className="league-admin-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            className="glass-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar participante…"
            aria-label="Buscar participante"
          />
        </div>
        <div className="league-admin-filter" role="group" aria-label="Filtrar por pago">
          {PAYMENT_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={paymentFilter === filter.id ? 'is-active' : ''}
              aria-pressed={paymentFilter === filter.id}
              onClick={() => setPaymentFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="league-admin-member-list">
        {isLoading &&
          [0, 1, 2].map((row) => (
            <div key={row} className="league-admin-member-skeleton skeleton" />
          ))}

        {error && (
          <div className="league-admin-empty">
            <TriangleAlert size={20} aria-hidden="true" />
            <strong>No se pudieron cargar los miembros</strong>
            <span>Vuelve a abrir la liga para intentarlo de nuevo.</span>
          </div>
        )}

        {!isLoading && !error && visibleMembers.length === 0 && (
          <div className="league-admin-empty">
            <Users size={20} aria-hidden="true" />
            <strong>{members.length === 0 ? 'Aún no hay miembros' : 'Sin resultados'}</strong>
            <span>
              {members.length === 0
                ? 'Comparte el código de invitación para que se una el primer participante.'
                : 'Prueba con otro nombre o cambia el filtro de pago.'}
            </span>
          </div>
        )}

        {!isLoading &&
          !error &&
          visibleMembers.map((member) => {
            const isPaid = member.paymentStatus === 'PAID';
            const isSelf = currentUserId != null && String(member.userId) === String(currentUserId);
            const rowPaymentPending =
              paymentMutation.isPending &&
              String(paymentMutation.variables?.userId) === String(member.userId);
            const rowKickPending =
              kickMutation.isPending && String(kickMutation.variables) === String(member.userId);
            const confirmingKick = String(kickTargetId) === String(member.userId);
            const canManage = isAdmin && !member.isAdmin;

            return (
              <article
                key={member.userId}
                className={`league-admin-member ${confirmingKick ? 'is-confirming' : ''}`}
              >
                <div className="league-admin-member-main">
                  <UserAvatar url={member.avatarUrl} name={member.participantName} size={38} />
                  <div className="league-admin-member-info">
                    <div className="league-admin-member-name">
                      <span>{member.participantName}</span>
                      {member.isAdmin && (
                        <span className="league-admin-badge">
                          <Crown size={10} aria-hidden="true" />
                          Admin
                        </span>
                      )}
                      {isSelf && <span className="league-admin-badge is-you">Tú</span>}
                    </div>
                    <span
                      className={`league-admin-member-status ${isPaid ? 'is-paid' : 'is-pending'}`}
                    >
                      {isPaid ? 'Pago recibido' : 'Pago pendiente'}
                    </span>
                  </div>
                </div>

                <div className="league-admin-member-actions">
                  {canManage ? (
                    <button
                      type="button"
                      className={`league-admin-pay ${isPaid ? 'is-paid' : 'is-pending'}`}
                      onClick={() => {
                        setActionError('');
                        paymentMutation.mutate({
                          userId: member.userId,
                          status: isPaid ? 'PENDING' : 'PAID',
                        });
                      }}
                      disabled={rowPaymentPending}
                      aria-label={
                        isPaid
                          ? `Marcar el pago de ${member.participantName} como pendiente`
                          : `Marcar el pago de ${member.participantName} como recibido`
                      }
                      title={isPaid ? 'Marcar como pendiente' : 'Marcar como pagado'}
                    >
                      {rowPaymentPending ? (
                        <Loader2 className="league-admin-spin" size={13} aria-hidden="true" />
                      ) : (
                        <span className="league-admin-pay-dot" aria-hidden="true" />
                      )}
                      {isPaid ? 'Pagado' : 'Pendiente'}
                    </button>
                  ) : (
                    <span
                      className={`league-admin-pay is-readonly ${
                        isPaid ? 'is-paid' : 'is-pending'
                      }`}
                    >
                      <span className="league-admin-pay-dot" aria-hidden="true" />
                      {isPaid ? 'Pagado' : 'Pendiente'}
                    </span>
                  )}

                  {canManage &&
                    (confirmingKick ? (
                      <div
                        className="league-admin-inline-confirm"
                        role="group"
                        aria-label={`Confirmar expulsión de ${member.participantName}`}
                      >
                        <span>¿Expulsar?</span>
                        <button
                          type="button"
                          className="league-admin-mini-btn is-danger"
                          onClick={() => kickMutation.mutate(member.userId)}
                          disabled={rowKickPending}
                        >
                          {rowKickPending ? (
                            <Loader2 className="league-admin-spin" size={12} aria-hidden="true" />
                          ) : (
                            'Sí'
                          )}
                        </button>
                        <button
                          type="button"
                          className="league-admin-mini-btn"
                          onClick={() => setKickTargetId(null)}
                          disabled={rowKickPending}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="league-admin-icon-btn is-danger"
                        onClick={() => setKickTargetId(member.userId)}
                        title={`Expulsar a ${member.participantName}`}
                        aria-label={`Expulsar a ${member.participantName}`}
                      >
                        <UserMinus size={16} aria-hidden="true" />
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}
