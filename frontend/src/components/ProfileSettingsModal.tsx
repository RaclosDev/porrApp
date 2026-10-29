import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { updateMyProfile, uploadMyAvatar, deleteMyAvatar } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import ImagePicker from './ImagePicker';
import { UserAvatar } from './Avatar';

/**
 * Ajustes de cuenta: nombre público y foto de perfil.
 * No cambia el correo ni el nombre de Google ni la vinculación de la cuenta.
 */
export default function ProfileSettingsModal({ onClose }) {
  const queryClient = useQueryClient();
  const userName = useAppStore((s) => s.userName);
  const avatarUrl = useAppStore((s) => s.userAvatarUrl);
  const setUserName = useAppStore((s) => s.setUserName);
  const setUserAvatarUrl = useAppStore((s) => s.setUserAvatarUrl);

  const [name, setName] = useState(userName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
      setError(err.message || 'No se pudo guardar el nombre');
    } finally {
      setSaving(false);
    }
  };

  const unchanged = name.trim() === (userName || '');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#151525',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 id="profile-settings-title" style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>
            Ajustes de cuenta
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ajustes"
            className="glass-btn"
            style={{ width: 32, height: 32, borderRadius: '50%', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Foto de perfil
          </span>
          <ImagePicker
            idPrefix="avatar-picker"
            currentUrl={avatarUrl}
            renderPreview={(url) => <UserAvatar url={url} name={userName} size={72} />}
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

        <section style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label
            htmlFor="profile-name-input"
            style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}
          >
            Nombre público
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="profile-name-input"
              className="glass-input"
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              type="button"
              className="glass-btn"
              onClick={saveName}
              disabled={saving || unchanged || name.trim().length < 2}
              style={{
                padding: '6px 14px',
                fontWeight: 700,
                borderRadius: '8px',
                background: 'rgba(0, 210, 211, 0.15)',
                border: '1px solid rgba(0, 210, 211, 0.45)',
                color: '#00d2d3',
                cursor: 'pointer',
              }}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
          {error && (
            <span role="alert" style={{ fontSize: '0.8rem', color: '#ff6b7a' }}>
              {error}
            </span>
          )}
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Es el nombre que ven tus amigos en clasificaciones y ligas. Tu cuenta de Google y su
            vinculación no cambian.
          </span>
        </section>
      </div>
    </div>
  );
}
