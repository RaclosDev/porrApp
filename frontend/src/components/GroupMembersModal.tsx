import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Check,
  Clock3,
  Copy,
  Crown,
  Loader2,
  Link2,
  RefreshCw,
  Search,
  Settings2,
  Share2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserMinus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  fetchGroupMembers,
  toggleGroupMemberPayment,
  kickGroupMember,
  regenerateGroupJoinCode,
} from '../services/api';
import ImagePicker from './ImagePicker';
import { LeagueAvatar, UserAvatar } from './Avatar';
import type { PaymentStatus } from '../types/api';
import { errorMessage } from '../utils/errors';

type CopyTarget = 'code' | 'link';

const PAYMENT_FILTERS = [
  { id: 'ALL', label: 'Todos' },
  { id: 'PAID', label: 'Pagados' },
  { id: 'PENDING', label: 'Pendientes' },
];

/**
 * Administración de una liga: ajustes, invitaciones y control de pagos.
 * En escritorio se muestra como un diálogo centrado; en móvil, como una hoja a pantalla completa.
 */
export default function GroupMembersModal({
  groupId,
  groupName,
  currentJoinCode,
  isAdmin,
  currentUserId = null,
  initialRules = '',
  imageUrl = null,
  onClose,
  onCodeRegenerated,
  onSaveSettings,
  onDelete,
  onUploadImage,
  onRemoveImage,
}: {
  groupId: number;
  groupName: string;
  currentJoinCode: string | null | undefined;
  isAdmin: boolean;
  currentUserId?: string | number | null;
  initialRules?: string;
  imageUrl?: string | null;
  onClose: () => void;
  onCodeRegenerated: (newCode: string) => void;
  /** Devuelve si se ha guardado. */
  onSaveSettings: (settings: { name: string; rules: string }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onUploadImage: (blob: Blob) => Promise<void>;
  onRemoveImage: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('members');
  const [activeCode, setActiveCode] = useState(currentJoinCode || '');
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | ''>('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState(groupName || '');
  const [rulesText, setRulesText] = useState(initialRules || '');
  const [savingConfig, setSavingConfig] = useState(false);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [kickTargetId, setKickTargetId] = useState<number | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const isDirty = name.trim() !== (groupName || '').trim() || rulesText !== (initialRules || '');

  const requestClose = () => {
    if (isDirty) {
      setLeaveConfirmOpen(true);
      return;
    }
    onClose();
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (leaveConfirmOpen) {
          setLeaveConfirmOpen(false);
          return;
        }
        if (deleteOpen) {
          setDeleteOpen(false);
          setDeleteConfirmName('');
          return;
        }
        if (confirmRegenerate) {
          setConfirmRegenerate(false);
          return;
        }
        if (isDirty) {
          setLeaveConfirmOpen(true);
          return;
        }
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      // Mantiene el foco dentro del diálogo activo (o de su confirmación).
      const scope = leaveConfirmOpen
        ? panelRef.current?.querySelector<HTMLElement>('.league-admin-confirm-dialog')
        : panelRef.current;
      if (!scope) return;
      const focusables = Array.from(
        scope.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusables.length === 0) {
        event.preventDefault();
        scope.focus?.();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      const outsideScope = !scope.contains(active);
      if (event.shiftKey && (active === first || outsideScope)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outsideScope)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, leaveConfirmOpen, deleteOpen, confirmRegenerate, onClose]);

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  useEffect(() => {
    setActiveCode(currentJoinCode || '');
  }, [currentJoinCode]);

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['groupMembers', groupId],
    queryFn: () => fetchGroupMembers(groupId),
    enabled: Boolean(groupId),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: PaymentStatus }) =>
      toggleGroupMemberPayment(groupId, userId, status),
    onMutate: async ({ userId, status }) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: ['groupMembers', groupId] });
      const previous = queryClient.getQueryData(['groupMembers', groupId]);
      queryClient.setQueryData(['groupMembers', groupId], (current) =>
        Array.isArray(current)
          ? current.map((member) =>
              String(member.userId) === String(userId)
                ? { ...member, paymentStatus: status }
                : member,
            )
          : current,
      );
      return { previous };
    },
    onError: (err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['groupMembers', groupId], context.previous);
      }
      const message = errorMessage(err, 'No se pudo actualizar el estado de pago.');
      setActionError(message);
      toast.error(message);
    },
    onSuccess: (_data, { status }) => {
      toast.success(
        status === 'PAID' ? 'Pago marcado como recibido' : 'Pago marcado como pendiente',
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  const kickMutation = useMutation({
    mutationFn: (userId: number) => kickGroupMember(groupId, userId),
    onMutate: () => setActionError(''),
    onSuccess: () => {
      setKickTargetId(null);
      toast.success('Miembro expulsado de la liga');
      queryClient.invalidateQueries({ queryKey: ['groupMembers', groupId] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: (err) => {
      const message = errorMessage(err, 'No se pudo expulsar al miembro.');
      setActionError(message);
      toast.error(message);
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateGroupJoinCode(groupId),
    onMutate: () => setActionError(''),
    onSuccess: (data) => {
      setConfirmRegenerate(false);
      if (data.joinCode) {
        setActiveCode(data.joinCode);
        onCodeRegenerated?.(data.joinCode);
      }
      toast.success('Código de invitación regenerado');
    },
    onError: (err) => {
      const message = errorMessage(err, 'No se pudo regenerar el código.');
      setActionError(message);
      toast.error(message);
    },
  });

  const markCopied = (target: CopyTarget) => {
    setCopiedTarget(target);
    clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedTarget(''), 2200);
  };

  const copyText = async (text: string, target: CopyTarget, message: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard no disponible');
      await navigator.clipboard.writeText(text);
      markCopied(target);
      toast.success(message);
    } catch {
      setActionError('No se pudo copiar automáticamente. Copia el código manualmente.');
    }
  };

  const inviteLink = `${window.location.origin}/join/${encodeURIComponent(activeCode)}`;

  const handleShare = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Liga ${groupName}`,
          text: `Únete a la liga "${groupName}"`,
          url: inviteLink,
        });
        return;
      } catch (err) {
        // Cancelar el diálogo nativo no debe copiar el enlace por sorpresa.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copyText(inviteLink, 'link', 'Enlace de invitación copiado');
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setActionError('El nombre de la liga no puede estar vacío.');
      return;
    }
    if (!isDirty) return;

    setSavingConfig(true);
    setActionError('');
    setNotice('');
    try {
      const ok = await onSaveSettings?.({ name: trimmedName, rules: rulesText });
      if (ok === false) {
        setActionError('No se pudieron guardar los cambios. Inténtalo de nuevo.');
        return;
      }
      setName(trimmedName);
      setNotice('Cambios guardados');
      toast.success('Liga actualizada');
    } catch (err) {
      setActionError(errorMessage(err, 'No se pudieron guardar los cambios.'));
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDiscard = () => {
    setName(groupName || '');
    setRulesText(initialRules || '');
    setActionError('');
    setNotice('');
    setLeaveConfirmOpen(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmName.trim() !== (groupName || '').trim()) return;
    setDeleting(true);
    setActionError('');
    try {
      const ok = await onDelete?.();
      if (ok === false) {
        setActionError('No se pudo eliminar la liga. Inténtalo de nuevo.');
      }
    } catch (err) {
      const message = errorMessage(err, 'No se pudo eliminar la liga.');
      setActionError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const paidCount = members.filter((member) => member.paymentStatus === 'PAID').length;
  const pendingCount = members.length - paidCount;
  const paidPercent = members.length ? Math.round((paidCount / members.length) * 100) : 0;

  const visibleMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesStatus =
        paymentFilter === 'ALL' ||
        (paymentFilter === 'PAID'
          ? member.paymentStatus === 'PAID'
          : member.paymentStatus !== 'PAID');
      const matchesSearch = !term || (member.participantName || '').toLowerCase().includes(term);
      return matchesStatus && matchesSearch;
    });
  }, [members, paymentFilter, search]);

  const currentTab = isAdmin ? tab : 'members';
  const isNameValid = Boolean(name.trim());

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const nextTab = tab === 'members' ? 'settings' : 'members';
    setTab(nextTab);
    document.getElementById(`league-admin-tab-${nextTab}`)?.focus();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="league-admin-title"
      className="league-admin-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div ref={panelRef} tabIndex={-1} className="league-admin-panel">
        <header className="league-admin-header">
          <LeagueAvatar url={imageUrl} size={46} />
          <div className="league-admin-heading">
            <span className="league-admin-eyebrow">
              {isAdmin ? (
                <Settings2 size={12} aria-hidden="true" />
              ) : (
                <Users size={12} aria-hidden="true" />
              )}
              {isAdmin ? 'Administrar liga' : 'Participantes'}
            </span>
            <h2 id="league-admin-title" className="league-admin-title">
              {groupName}
            </h2>
            <p className="league-admin-subtitle">
              {members.length} {members.length === 1 ? 'participante' : 'participantes'}
              {isAdmin ? ' · Pagos e invitaciones' : ''}
            </p>
          </div>
          <button
            type="button"
            className="league-admin-close"
            onClick={requestClose}
            aria-label="Cerrar administración de la liga"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {isAdmin && (
          <div className="league-admin-tabs" role="tablist" aria-label="Secciones de la liga">
            <button
              type="button"
              role="tab"
              id="league-admin-tab-members"
              aria-selected={tab === 'members'}
              aria-controls="league-admin-panel-members"
              tabIndex={tab === 'members' ? 0 : -1}
              className={`league-admin-tab ${tab === 'members' ? 'is-active' : ''}`}
              onKeyDown={handleTabKeyDown}
              onClick={() => setTab('members')}
            >
              <Users size={15} aria-hidden="true" />
              Miembros
              <span className="league-admin-tab-count">{members.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="league-admin-tab-settings"
              aria-selected={tab === 'settings'}
              aria-controls="league-admin-panel-settings"
              tabIndex={tab === 'settings' ? 0 : -1}
              className={`league-admin-tab ${tab === 'settings' ? 'is-active' : ''}`}
              onKeyDown={handleTabKeyDown}
              onClick={() => setTab('settings')}
            >
              <Settings2 size={15} aria-hidden="true" />
              Ajustes
              {isDirty && (
                <span className="league-admin-unsaved-dot" aria-label="Cambios sin guardar" />
              )}
            </button>
          </div>
        )}

        <div className="league-admin-body">
          {actionError && (
            <div className="league-admin-alert" role="alert">
              <TriangleAlert size={16} aria-hidden="true" />
              <span>{actionError}</span>
              <button type="button" onClick={() => setActionError('')} aria-label="Descartar aviso">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          {currentTab === 'members' && (
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
                    <strong>
                      {members.length === 0 ? 'Aún no hay miembros' : 'Sin resultados'}
                    </strong>
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
                    const isSelf =
                      currentUserId != null && String(member.userId) === String(currentUserId);
                    const rowPaymentPending =
                      paymentMutation.isPending &&
                      String(paymentMutation.variables?.userId) === String(member.userId);
                    const rowKickPending =
                      kickMutation.isPending &&
                      String(kickMutation.variables) === String(member.userId);
                    const confirmingKick = String(kickTargetId) === String(member.userId);
                    const canManage = isAdmin && !member.isAdmin;

                    return (
                      <article
                        key={member.userId}
                        className={`league-admin-member ${confirmingKick ? 'is-confirming' : ''}`}
                      >
                        <div className="league-admin-member-main">
                          <UserAvatar
                            url={member.avatarUrl}
                            name={member.participantName}
                            size={38}
                          />
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
                              className={`league-admin-member-status ${
                                isPaid ? 'is-paid' : 'is-pending'
                              }`}
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
                                <Loader2
                                  className="league-admin-spin"
                                  size={13}
                                  aria-hidden="true"
                                />
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
                                    <Loader2
                                      className="league-admin-spin"
                                      size={12}
                                      aria-hidden="true"
                                    />
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
          )}

          {currentTab === 'settings' && (
            <div
              id="league-admin-panel-settings"
              className="league-admin-panel-section"
              role="tabpanel"
              aria-labelledby="league-admin-tab-settings"
            >
              <section className="league-admin-card">
                <div className="league-admin-card-head">
                  <h3>
                    <ShieldCheck size={14} aria-hidden="true" />
                    Identidad de la liga
                  </h3>
                </div>
                <p className="league-admin-muted">
                  La imagen se actualiza al instante, aunque tengas otros cambios sin guardar.
                </p>
                <div className="league-admin-image-row">
                  <ImagePicker
                    idPrefix="league-image-picker"
                    currentUrl={imageUrl}
                    renderPreview={(url) => <LeagueAvatar url={url} size={72} />}
                    onUpload={async (blob) => {
                      await onUploadImage?.(blob);
                    }}
                    onRemove={async () => {
                      await onRemoveImage?.();
                    }}
                  />
                </div>
                <div className="league-admin-field">
                  <label htmlFor="league-admin-name">Nombre de la liga</label>
                  <input
                    id="league-admin-name"
                    className="glass-input"
                    value={name}
                    maxLength={120}
                    onChange={(event) => {
                      setName(event.target.value);
                      setNotice('');
                    }}
                    placeholder="Nombre de la liga"
                    autoComplete="off"
                  />
                  <span className={`league-admin-hint ${isNameValid ? '' : 'is-error'}`}>
                    {isNameValid
                      ? `${name.length}/120 caracteres`
                      : 'El nombre no puede estar vacío.'}
                  </span>
                </div>
              </section>

              <section className="league-admin-card">
                <div className="league-admin-card-head">
                  <h3>
                    <Settings2 size={14} aria-hidden="true" />
                    Reglas de la liga
                  </h3>
                  <span className="league-admin-card-meta">{rulesText.length}/8000</span>
                </div>
                <p className="league-admin-muted">
                  Cuota, plazos de pago, criterios de desempate o premios. Se muestran a todos los
                  participantes.
                </p>
                <textarea
                  id="league-admin-rules"
                  className="glass-input league-admin-textarea"
                  value={rulesText}
                  maxLength={8000}
                  rows={7}
                  onChange={(event) => {
                    setRulesText(event.target.value);
                    setNotice('');
                  }}
                  placeholder="Ej.: Cuota de 10 €. El pago se cierra el 10 de junio. En caso de empate gana quien acierte más marcadores exactos…"
                  aria-label="Reglas de la liga"
                />
                {notice && (
                  <p className="league-admin-notice" role="status">
                    <Check size={14} aria-hidden="true" />
                    {notice}
                  </p>
                )}
              </section>

              <section className="league-admin-card is-danger">
                <div className="league-admin-card-head">
                  <h3>
                    <TriangleAlert size={14} aria-hidden="true" />
                    Zona de peligro
                  </h3>
                </div>
                <p className="league-admin-muted">
                  Eliminar la liga borra todos sus pronósticos y participantes. Esta acción no se
                  puede deshacer.
                </p>
                {!deleteOpen ? (
                  <button
                    type="button"
                    className="league-admin-btn is-danger league-admin-danger-action"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Eliminar liga
                  </button>
                ) : (
                  <div className="league-admin-delete">
                    <label htmlFor="league-admin-delete-name">
                      Escribe <strong>{groupName}</strong> para confirmar
                    </label>
                    <div className="league-admin-delete-row">
                      <input
                        id="league-admin-delete-name"
                        className="glass-input"
                        value={deleteConfirmName}
                        onChange={(event) => setDeleteConfirmName(event.target.value)}
                        placeholder={groupName}
                        autoComplete="off"
                        disabled={deleting}
                      />
                      <button
                        type="button"
                        className="league-admin-btn is-danger"
                        onClick={handleDelete}
                        disabled={deleting || deleteConfirmName.trim() !== (groupName || '').trim()}
                      >
                        {deleting ? (
                          <Loader2 className="league-admin-spin" size={15} aria-hidden="true" />
                        ) : (
                          <Trash2 size={15} aria-hidden="true" />
                        )}
                        {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
                      </button>
                      <button
                        type="button"
                        className="league-admin-btn is-ghost"
                        onClick={() => {
                          setDeleteOpen(false);
                          setDeleteConfirmName('');
                        }}
                        disabled={deleting}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {isAdmin && isDirty && (
          <footer className="league-admin-footer">
            <span className="league-admin-dirty">
              <span className="league-admin-unsaved-dot" aria-hidden="true" />
              Cambios sin guardar
            </span>
            <div className="league-admin-footer-actions">
              <button
                type="button"
                className="league-admin-btn is-ghost"
                onClick={handleDiscard}
                disabled={savingConfig}
              >
                Descartar
              </button>
              <button
                type="button"
                className="league-admin-btn is-primary"
                onClick={handleSave}
                disabled={savingConfig || !isNameValid}
              >
                {savingConfig ? (
                  <Loader2 className="league-admin-spin" size={15} aria-hidden="true" />
                ) : (
                  <Check size={15} aria-hidden="true" />
                )}
                {savingConfig ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </footer>
        )}

        {leaveConfirmOpen && (
          <div
            className="league-admin-confirm-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="league-admin-leave-title"
          >
            <div className="league-admin-confirm-dialog">
              <span className="league-admin-confirm-icon">
                <TriangleAlert size={20} aria-hidden="true" />
              </span>
              <h3 id="league-admin-leave-title">¿Descartar los cambios?</h3>
              <p>Tienes cambios sin guardar en el nombre o en las reglas de la liga.</p>
              <div className="league-admin-confirm-actions">
                <button
                  type="button"
                  className="league-admin-btn is-ghost"
                  onClick={() => setLeaveConfirmOpen(false)}
                  autoFocus
                >
                  Seguir editando
                </button>
                <button type="button" className="league-admin-btn is-danger" onClick={onClose}>
                  Descartar y cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
