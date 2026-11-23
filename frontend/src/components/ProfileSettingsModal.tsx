import { useEffect, useState, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Bell, KeyRound, UserRound, UserCog } from 'lucide-react';
import DialogBackdrop from './DialogBackdrop';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  updateMyProfile,
  uploadMyAvatar,
  deleteMyAvatar,
  completeProfileSetup,
  deleteMyAccount,
  exportMyData,
} from '../services/api';
import { useAppStore } from '../store/useAppStore';
import ImagePicker from './ImagePicker';
import ReminderSettings from './ReminderSettings';
import PasskeySettings from './PasskeySettings';
import { UserAvatar } from './Avatar';
import { errorMessage } from '../utils/errors';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { passkeysSupported } from '../utils/webauthn';

/** Pestaña en la que se abren los ajustes; el menú de cuenta y la campana eligen la suya. */
export type SettingsSection = 'profile' | 'reminders' | 'passkeys' | 'account';

const TABS: { id: SettingsSection; label: string; icon: ReactNode }[] = [
  { id: 'profile', label: 'Perfil', icon: <UserRound size={15} aria-hidden="true" /> },
  { id: 'reminders', label: 'Avisos', icon: <Bell size={15} aria-hidden="true" /> },
  { id: 'passkeys', label: 'Acceso', icon: <KeyRound size={15} aria-hidden="true" /> },
  { id: 'account', label: 'Cuenta', icon: <UserCog size={15} aria-hidden="true" /> },
];

/**
 * Ajustes de cuenta en pestañas, como la administración de una liga: perfil (nombre y foto),
 * avisos, llaves de acceso y cuenta (cerrar sesión, tus datos y borrar la cuenta).
 * No cambia el correo ni la forma de entrar (Google o contraseña). En la bienvenida solo
 * se ve el perfil, sin pestañas.
 */
export default function ProfileSettingsModal({
  onClose,
  onLogout,
  onboarding = false,
  section = 'profile',
}: {
  onClose: () => void;
  onLogout?: () => void;
  onboarding?: boolean;
  section?: SettingsSection;
}) {
  const [tab, setTab] = useState<SettingsSection>(onboarding ? 'profile' : section);
  const currentTab = onboarding ? 'profile' : tab;
  // Sin soporte de llaves de acceso en el navegador, la pestaña quedaría vacía.
  const tabs = passkeysSupported() ? TABS : TABS.filter((item) => item.id !== 'passkeys');
  const queryClient = useQueryClient();
  const userName = useAppStore((s) => s.userName);
  const userId = useAppStore((s) => s.userId);
  const avatarUrl = useAppStore((s) => s.userAvatarUrl);
  const setUserName = useAppStore((s) => s.setUserName);
  const setUserAvatarUrl = useAppStore((s) => s.setUserAvatarUrl);

  const [name, setName] = useState(userName || '');
  const [saving, setSaving] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const downloadMyData = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'porra-mis-datos.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudieron descargar tus datos'));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteMyAccount();
      useAppStore.getState().logout();
      onClose();
      navigate('/', { replace: true });
      toast.success('Tu cuenta y tus datos se han borrado');
    } catch (err) {
      setDeleteError(errorMessage(err, 'No se pudo borrar la cuenta'));
    } finally {
      setDeleting(false);
    }
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, {
    onEscape: () => {
      void dismiss();
    },
  });

  // «Avisos» del menú de cuenta y de la campana: se abre ya en esa pestaña, con el foco en ella.
  const remindersRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (section !== 'reminders' || onboarding) return;
    remindersRef.current?.scrollIntoView?.({ block: 'start' });
    remindersRef.current?.focus({ preventScroll: true });
  }, [section, onboarding]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const ids = tabs.map((item) => item.id);
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
    document.getElementById(`account-settings-tab-${ids[nextIndex]}`)?.focus();
  };

  const refreshEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['groupMembers'] });
  };

  const saveName = async () => {
    if (saving || finishing) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateMyProfile(name);
      setUserName(res.participantName);
      localStorage.setItem('my_prediction_name', res.participantName);
      setName(res.participantName);
      refreshEverywhere();
      toast.success('Nombre actualizado');
    } catch (err) {
      setError(errorMessage(err, 'No se pudo guardar el nombre'));
    } finally {
      setSaving(false);
    }
  };

  const unchanged = name.trim() === (userName || '');

  const finish = async (saveChanges: boolean) => {
    if (finishing || saving) return;
    setFinishing(true);
    setError('');
    try {
      if (saveChanges && !unchanged) {
        const result = await updateMyProfile(name.trim());
        setUserName(result.participantName);
        refreshEverywhere();
      }
      await completeProfileSetup();
      useAppStore.getState().setProfileSetupCompleted(true);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause, 'No se pudo guardar tu elección. Inténtalo de nuevo.'));
    } finally {
      setFinishing(false);
    }
  };

  const dismiss = () => {
    if (saving || finishing) return;
    if (onboarding) return finish(false);
    onClose();
  };

  return (
    <DialogBackdrop className="paper-dialog-overlay" onDismiss={() => void dismiss()}>
      <div
        className="paper-panel paper-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-settings-title"
        ref={dialogRef}
        tabIndex={-1}
      >
        <div className="flex justify-between items-center shrink-0 px-5 pt-4.5 pb-3">
          <h3 className="m-0 poster-title text-main text-[1.2rem]" id="profile-settings-title">
            {onboarding ? 'Así te verán tus amigos' : 'Ajustes de cuenta'}
          </h3>
          <button
            type="button"
            onClick={() => {
              void dismiss();
            }}
            disabled={finishing || saving}
            aria-label="Cerrar"
            className="glass-btn w-11 h-11 p-0 rounded-full cursor-pointer"
          >
            ✕
          </button>
        </div>

        {!onboarding && (
          <div className="league-admin-tabs" role="tablist" aria-label="Secciones de la cuenta">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`account-settings-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls="account-settings-panel"
                tabIndex={tab === item.id ? 0 : -1}
                className={`league-admin-tab ${tab === item.id ? 'is-active' : ''}`}
                onKeyDown={handleTabKeyDown}
                onClick={() => setTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div
          className="paper-dialog-body flex flex-col gap-4.5"
          id="account-settings-panel"
          role={onboarding ? undefined : 'tabpanel'}
          aria-labelledby={onboarding ? undefined : `account-settings-tab-${currentTab}`}
        >
          {onboarding && (
            <p className="m-0 text-muted">
              Elige tu nombre y, si te apetece, una foto. Puedes cambiarlos después desde tu cuenta.
            </p>
          )}
          {currentTab === 'profile' && (
            <>
              <section className="flex flex-col gap-2">
                <span className="text-[0.8rem] font-bold text-muted">Foto de perfil</span>
                <ImagePicker
                  idPrefix="avatar-picker"
                  currentUrl={avatarUrl}
                  renderPreview={(url) => (
                    <UserAvatar url={url} userId={userId} name={userName} size={72} />
                  )}
                  onUpload={async (blob) => {
                    const res = await uploadMyAvatar(blob);
                    setUserAvatarUrl(res.avatarUrl || '');
                    refreshEverywhere();
                    toast.success('Foto actualizada');
                  }}
                  onRemove={async () => {
                    await deleteMyAvatar();
                    setUserAvatarUrl('');
                    refreshEverywhere();
                    toast.success('Foto eliminada');
                  }}
                />
              </section>

              <section className="flex flex-col gap-2">
                <label className="text-[0.8rem] font-bold text-muted" htmlFor="profile-name-input">
                  Nombre público
                </label>
                <div className="flex gap-2">
                  <input
                    id="profile-name-input"
                    className="glass-input flex-1 min-w-0"
                    value={name}
                    disabled={saving || finishing}
                    maxLength={30}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {!onboarding && (
                    <button
                      type="button"
                      className="glass-btn primary-btn py-1.5 px-3.5 font-bold"
                      onClick={saveName}
                      disabled={saving || finishing || unchanged || name.trim().length < 2}
                    >
                      {saving ? 'Guardando…' : 'Guardar'}
                    </button>
                  )}
                </div>
                {error && (
                  <span className="text-[0.8rem] text-[var(--miss)]" role="alert">
                    {error}
                  </span>
                )}
                <span className="text-[0.74rem] text-muted">
                  Es el nombre que ven tus amigos en clasificaciones y ligas. Tu email y tu forma de
                  entrar no cambian.
                </span>
              </section>
            </>
          )}
          {currentTab === 'reminders' && <ReminderSettings sectionRef={remindersRef} />}
          {currentTab === 'passkeys' && <PasskeySettings />}
          {currentTab === 'account' && onLogout && (
            <section className="flex flex-col gap-2">
              <span className="text-[0.8rem] font-bold text-muted">Sesión</span>
              <span className="text-[0.74rem] text-muted">
                Sales de PorrApp en este dispositivo. Tus ligas y predicciones se quedan guardadas.
              </span>
              <button
                type="button"
                className="glass-btn text-[0.8rem] self-start"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
              >
                Cerrar sesión
              </button>
            </section>
          )}
          {currentTab === 'account' && (
            <section
              className={`flex flex-col gap-2 ${onLogout ? 'pt-4 border-t border-line' : ''}`}
            >
              <span className="text-[0.8rem] font-bold text-muted">Tus datos</span>
              <span className="text-[0.74rem] text-muted">
                Consulta qué datos guardamos en la{' '}
                <Link to="/privacidad" className="underline" onClick={onClose}>
                  política de privacidad
                </Link>
                .
              </span>
              <button
                type="button"
                className="glass-btn text-[0.8rem] self-start"
                disabled={exporting}
                onClick={() => void downloadMyData()}
              >
                {exporting ? 'Preparando…' : 'Descargar mis datos'}
              </button>
              {confirmingDelete ? (
                <div className="flex flex-col gap-2" role="group" aria-label="Confirmar borrado">
                  <p className="m-0 text-[0.85rem]">
                    Se borrarán tu perfil, tu foto, tus predicciones y tus avisos, y saldrás de
                    todas tus ligas. No se puede deshacer.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className="glass-btn text-[0.8rem]"
                      disabled={deleting}
                      onClick={() => {
                        setConfirmingDelete(false);
                        setDeleteError('');
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="glass-btn text-[0.8rem] font-bold text-[var(--miss)]"
                      disabled={deleting}
                      onClick={() => void deleteAccount()}
                    >
                      {deleting ? 'Borrando…' : 'Sí, borrar mi cuenta'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="glass-btn text-[0.8rem] self-start text-[var(--miss)]"
                  onClick={() => setConfirmingDelete(true)}
                >
                  Borrar mi cuenta
                </button>
              )}
              {deleteError && (
                <span className="text-[0.8rem] text-[var(--miss)]" role="alert">
                  {deleteError}
                </span>
              )}
            </section>
          )}
        </div>
        {onboarding && (
          <div className="flex gap-2 justify-between shrink-0 p-4 border-t border-line">
            <button
              type="button"
              className="glass-btn text-[0.8rem]"
              disabled={finishing || saving}
              onClick={() => finish(false)}
            >
              Ahora no
            </button>
            <button
              type="button"
              className="glass-btn primary-btn text-[0.8rem]"
              disabled={finishing || saving || name.trim().length < 2}
              onClick={() => finish(true)}
            >
              {finishing ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </div>
        )}
      </div>
    </DialogBackdrop>
  );
}
