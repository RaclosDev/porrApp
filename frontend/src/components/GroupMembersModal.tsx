import { LeagueAvatar } from './Avatar';
import { Check, Loader2, Settings2, TriangleAlert, Users, X } from 'lucide-react';
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
  fetchGroupMembers,
  toggleGroupMemberPayment,
  kickGroupMember,
  regenerateGroupJoinCode,
} from '../services/api';
import LeagueMembersTab from './league/LeagueMembersTab';
import LeagueSettingsTab from './league/LeagueSettingsTab';
import LeaveConfirmDialog from './league/LeaveConfirmDialog';
import type { PaymentStatus } from '../types/api';
import { errorMessage } from '../utils/errors';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useScoringEditor } from '../hooks/useScoringEditor';
import { queryKeys } from '../services/queryKeys';

export type CopyTarget = 'code' | 'link';
export type PaymentFilter = 'ALL' | 'PAID' | 'PENDING';

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
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [kickTargetId, setKickTargetId] = useState<number | null>(null);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const scoringEditor = useScoringEditor(groupId, isAdmin);
  const settingsDirty =
    name.trim() !== (groupName || '').trim() || rulesText !== (initialRules || '');
  const isDirty = settingsDirty || scoringEditor.isDirty;

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
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useDialogFocus(panelRef, {
    onEscape: () => {
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
    },
    // Mantiene el foco dentro del diálogo activo (o de su confirmación).
    getScope: () =>
      leaveConfirmOpen
        ? panelRef.current?.querySelector<HTMLElement>('.league-admin-confirm-dialog')
        : panelRef.current,
  });

  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  useEffect(() => {
    setActiveCode(currentJoinCode || '');
  }, [currentJoinCode]);

  const {
    data: members = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.groupMembers(groupId),
    queryFn: () => fetchGroupMembers(groupId),
    enabled: Boolean(groupId),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: number; status: PaymentStatus }) =>
      toggleGroupMemberPayment(groupId, userId, status),
    onMutate: async ({ userId, status }) => {
      setActionError('');
      await queryClient.cancelQueries({ queryKey: queryKeys.groupMembers(groupId) });
      const previous = queryClient.getQueryData(queryKeys.groupMembers(groupId));
      queryClient.setQueryData(queryKeys.groupMembers(groupId), (current) =>
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
        queryClient.setQueryData(queryKeys.groupMembers(groupId), context.previous);
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
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard() });
    },
  });

  const kickMutation = useMutation({
    mutationFn: (userId: number) => kickGroupMember(groupId, userId),
    onMutate: () => setActionError(''),
    onSuccess: () => {
      setKickTargetId(null);
      toast.success('Miembro expulsado de la liga');
      // El expulsado deja de contar en miembros, ranking, pronósticos y en la tarjeta de la liga.
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.predictions(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
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
      // El código se muestra en la tarjeta (myGroups) y en los detalles de la liga.
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.group(groupId) });
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
    if (!scoringEditor.isValid) {
      setActionError('Revisa la puntuación: hay valores no válidos.');
      return;
    }

    setSavingConfig(true);
    setActionError('');
    setNotice('');
    try {
      if (settingsDirty) {
        const ok = await onSaveSettings?.({ name: trimmedName, rules: rulesText });
        if (ok === false) {
          setActionError('No se pudieron guardar los cambios. Inténtalo de nuevo.');
          return;
        }
        setName(trimmedName);
      }
      if (scoringEditor.isDirty) await scoringEditor.save();
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
    scoringEditor.reset();
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
            <LeagueMembersTab
              members={members}
              isLoading={isLoading}
              error={error}
              activeCode={activeCode}
              confirmRegenerate={confirmRegenerate}
              copiedTarget={copiedTarget}
              copyText={copyText}
              currentUserId={currentUserId}
              handleShare={handleShare}
              inviteLink={inviteLink}
              isAdmin={isAdmin}
              kickMutation={kickMutation}
              kickTargetId={kickTargetId}
              paidCount={paidCount}
              paidPercent={paidPercent}
              paymentFilter={paymentFilter}
              paymentMutation={paymentMutation}
              pendingCount={pendingCount}
              regenerateMutation={regenerateMutation}
              search={search}
              setActionError={setActionError}
              setConfirmRegenerate={setConfirmRegenerate}
              setKickTargetId={setKickTargetId}
              setPaymentFilter={setPaymentFilter}
              setSearch={setSearch}
              visibleMembers={visibleMembers}
            />
          )}

          {currentTab === 'settings' && (
            <LeagueSettingsTab
              deleteConfirmName={deleteConfirmName}
              deleteOpen={deleteOpen}
              deleting={deleting}
              groupName={groupName}
              handleDelete={handleDelete}
              imageUrl={imageUrl}
              isNameValid={isNameValid}
              name={name}
              notice={notice}
              onRemoveImage={onRemoveImage}
              onUploadImage={onUploadImage}
              rulesText={rulesText}
              scoringEditor={scoringEditor}
              setDeleteConfirmName={setDeleteConfirmName}
              setDeleteOpen={setDeleteOpen}
              setName={setName}
              setNotice={setNotice}
              setRulesText={setRulesText}
            />
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
                disabled={savingConfig || !isNameValid || !scoringEditor.isValid}
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
          <LeaveConfirmDialog onClose={onClose} setLeaveConfirmOpen={setLeaveConfirmOpen} />
        )}
      </div>
    </div>
  );
}
