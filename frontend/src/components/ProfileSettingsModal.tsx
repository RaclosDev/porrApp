import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { updateMyProfile, uploadMyAvatar, deleteMyAvatar } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import ImagePicker from './ImagePicker';
import { UserAvatar } from './Avatar';
import { errorMessage } from '../utils/errors';
import { useDialogFocus } from '../hooks/useDialogFocus';

/**
 * Ajustes de cuenta: nombre público y foto de perfil.
 * No cambia el correo ni el nombre de Google ni la vinculación de la cuenta.
 */
export default function ProfileSettingsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const userName = useAppStore((s) => s.userName);
  const userId = useAppStore((s) => s.userId);
  const avatarUrl = useAppStore((s) => s.userAvatarUrl);
  const setUserName = useAppStore((s) => s.setUserName);
  const setUserAvatarUrl = useAppStore((s) => s.setUserAvatarUrl);

  const [name, setName] = useState(userName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, { onEscape: onClose });

  const refreshEverywhere = () => {
    queryClient.invalidateQueries({ queryKey: ['myGroups'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['groupMembers'] });
  };

  const saveName = async () => {
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

  return (
    <div
      className="paper-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
      ref={dialogRef}
      tabIndex={-1}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="paper-panel landing-tape paper-dialog">
        <div className="paper-dialog-body flex flex-col gap-4.5">
          <div className="flex justify-between items-center">
            <h3 className="m-0 poster-title text-main text-[1.2rem]" id="profile-settings-title">
              Ajustes de cuenta
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="glass-btn w-11 h-11 p-0 rounded-full cursor-pointer"
            >
              ✕
            </button>
          </div>

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
                maxLength={30}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                type="button"
                className="glass-btn py-1.5 px-3.5 font-bold rounded-[8px] bg-[rgba(0,_210,_211,_0.15)] bg-none border border-[rgba(0,_210,_211,_0.45)] text-cyan cursor-pointer"
                onClick={saveName}
                disabled={saving || unchanged || name.trim().length < 2}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
            {error && (
              <span className="text-[0.8rem] text-[#b91c1c]" role="alert">
                {error}
              </span>
            )}
            <span className="text-[0.74rem] text-muted">
              Es el nombre que ven tus amigos en clasificaciones y ligas. Tu cuenta de Google y su
              vinculación no cambian.
            </span>
          </section>
        </div>
      </div>
    </div>
  );
}
