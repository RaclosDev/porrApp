import { LeagueAvatar } from './Avatar';
import DialogBackdrop from './DialogBackdrop';
import {
  Check,
  Loader2,
  ScrollText,
  Settings2,
  TriangleAlert,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { updateGroupEntryFee } from '../services/api';
import LeagueMembersTab from './league/LeagueMembersTab';
import LeagueSettingsTab, { type LeagueSettingsSection } from './league/LeagueSettingsTab';
import LeaveConfirmDialog from './league/LeaveConfirmDialog';
import { useInviteCode } from './league/useInviteCode';
import { useLeagueMembersAdmin } from './league/useLeagueMembersAdmin';
import { errorMessage } from '../utils/errors';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useScoringEditor } from '../hooks/useScoringEditor';
import { queryKeys } from '../services/queryKeys';

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
  lockSection,
  entryFee,
  onEntryFeeChanged,
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
  /** Cierre de predicciones que se muestra en los ajustes. */
  lockSection?: ReactNode;
  /** Cuota de inscripción; undefined en ligas públicas, que no la admiten. */
  entryFee?: boolean;
  onEntryFeeChanged?: (entryFee: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminTab>('members');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState(groupName || '');
  const [rulesText, setRulesText] = useState(initialRules || '');
  const [savingConfig, setSavingConfig] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const scoringEditor = useScoringEditor(groupId, isAdmin);
  const membersAdmin = useLeagueMembersAdmin(groupId, setActionError);
  const { members } = membersAdmin;
  const invite = useInviteCode({
    groupId,
    groupName,
    currentJoinCode,
    onCodeRegenerated,
    setActionError,
  });
  const { confirmRegenerate, setConfirmRegenerate } = invite;
  const entryFeeMutation = useMutation({
    mutationFn: (value: boolean) => updateGroupEntryFee(groupId, value),
    onSuccess: (_group, value) => {
      onEntryFeeChanged?.(value);
      queryClient.invalidateQueries({ queryKey: queryKeys.groupMembers(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.leaderboard(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
      queryClient.invalidateQueries({ queryKey: queryKeys.group() });
      toast.success(value ? 'Cuota activada' : 'Cuota quitada');
    },
    onError: (e) => setActionError(e instanceof Error ? e.message : 'No se pudo cambiar la cuota'),
  });
  const nameDirty = name.trim() !== (groupName || '').trim();
  const rulesDirty = rulesText !== (initialRules || '');
  const settingsDirty = nameDirty || rulesDirty;
  const isDirty = settingsDirty || scoringEditor.isDirty;

  const requestClose = () => {
    if (savingConfig) return;
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
      if (savingConfig) return;
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

  const handleSave = async () => {
    if (savingConfig) return;
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

  const currentTab = isAdmin ? tab : 'members';
  const isNameValid = Boolean(name.trim());

  const adminTabs: { id: AdminTab; label: string; icon: ReactNode; extra?: ReactNode }[] = [
    {
      id: 'members',
      label: 'Miembros',
      icon: <Users size={15} aria-hidden="true" />,
      extra: <span className="league-admin-tab-count">{members.length}</span>,
    },
    {
      id: 'general',
      label: 'General',
      icon: <Settings2 size={15} aria-hidden="true" />,
      extra: nameDirty && <UnsavedDot />,
    },
    {
      id: 'scoring',
      label: 'Puntuación',
      icon: <Trophy size={15} aria-hidden="true" />,
      extra: scoringEditor.isDirty && <UnsavedDot />,
    },
    {
      id: 'norms',
      label: 'Normas',
      icon: <ScrollText size={15} aria-hidden="true" />,
      extra: rulesDirty && <UnsavedDot />,
    },
  ];

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const ids = adminTabs.map((item) => item.id);
    const index = ids.indexOf(tab);
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % ids.length,
      ArrowLeft: (index - 1 + ids.length) % ids.length,
      Home: 0,
      End: ids.length - 1,
    };
    const nextIndex = keys[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    setTab(ids[nextIndex]);
    document.getElementById(`league-admin-tab-${ids[nextIndex]}`)?.focus();
  };

  return (
    <DialogBackdrop className="league-admin-overlay" onDismiss={requestClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="league-admin-title"
        className="league-admin-panel paper-panel landing-tape paper-dialog"
      >
        <header className="league-admin-header">
          <LeagueAvatar url={imageUrl} name={groupName} size={46} />
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
            {adminTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`league-admin-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`league-admin-panel-${item.id}`}
                tabIndex={tab === item.id ? 0 : -1}
                className={`league-admin-tab ${tab === item.id ? 'is-active' : ''}`}
                onKeyDown={handleTabKeyDown}
                onClick={() => setTab(item.id)}
              >
                {item.icon}
                {item.label}
                {item.extra}
              </button>
            ))}
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
              {...membersAdmin}
              {...invite}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              setActionError={setActionError}
              entryFee={entryFee}
              entryFeeSaving={entryFeeMutation.isPending}
              onToggleEntryFee={(value) => entryFeeMutation.mutate(value)}
            />
          )}

          {currentTab !== 'members' && (
            <LeagueSettingsTab
              section={currentTab}
              deleteConfirmName={deleteConfirmName}
              deleteOpen={deleteOpen}
              deleting={deleting}
              saving={savingConfig}
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
              lockSection={lockSection}
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
    </DialogBackdrop>
  );
}

type AdminTab = 'members' | LeagueSettingsSection;

function UnsavedDot() {
  return <span className="league-admin-unsaved-dot" aria-label="Cambios sin guardar" />;
}
