import { LeagueAvatar } from '../Avatar';
import ImagePicker from '../ImagePicker';
import { Check, Loader2, Settings2, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';

interface LeagueSettingsTabProps {
  deleteConfirmName: string;
  deleteOpen: boolean;
  deleting: boolean;
  groupName: string;
  handleDelete: () => Promise<void>;
  imageUrl: string | null;
  isNameValid: boolean;
  name: string;
  notice: string;
  onRemoveImage: () => Promise<void>;
  onUploadImage: (blob: Blob) => Promise<void>;
  rulesText: string;
  setDeleteConfirmName: (value: string) => void;
  setDeleteOpen: (open: boolean) => void;
  setName: (value: string) => void;
  setNotice: (value: string) => void;
  setRulesText: (value: string) => void;
}

/** Ajustes de la liga: nombre, reglas, imagen y borrado. */
export default function LeagueSettingsTab({
  deleteConfirmName,
  deleteOpen,
  deleting,
  groupName,
  handleDelete,
  imageUrl,
  isNameValid,
  name,
  notice,
  onRemoveImage,
  onUploadImage,
  rulesText,
  setDeleteConfirmName,
  setDeleteOpen,
  setName,
  setNotice,
  setRulesText,
}: LeagueSettingsTabProps) {
  return (
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
            {isNameValid ? `${name.length}/120 caracteres` : 'El nombre no puede estar vacío.'}
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
          Eliminar la liga borra todos sus pronósticos y participantes. Esta acción no se puede
          deshacer.
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
  );
}
