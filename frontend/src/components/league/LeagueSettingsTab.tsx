import PaperLoading from '../PaperLoading';
import type { ReactNode } from 'react';
import { LeagueAvatar } from '../Avatar';
import ImagePicker from '../ImagePicker';
import { Check, Loader2, RotateCcw, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import ScoringRulesPanel from './ScoringRulesPanel';
import type { ScoringEditor } from '../../hooks/useScoringEditor';
import { errorMessage } from '../../utils/errors';

export type LeagueSettingsSection = 'general' | 'scoring' | 'norms';

interface LeagueSettingsTabProps {
  /** Pestaña de ajustes que se muestra. */
  section: LeagueSettingsSection;
  deleteConfirmName: string;
  deleteOpen: boolean;
  deleting: boolean;
  saving: boolean;
  groupName: string;
  handleDelete: () => Promise<void>;
  imageUrl: string | null;
  isNameValid: boolean;
  name: string;
  notice: string;
  onRemoveImage: () => Promise<void>;
  onUploadImage: (blob: Blob) => Promise<void>;
  rulesText: string;
  scoringEditor: ScoringEditor;
  setDeleteConfirmName: (value: string) => void;
  setDeleteOpen: (open: boolean) => void;
  setName: (value: string) => void;
  setNotice: (value: string) => void;
  setRulesText: (value: string) => void;
  /** Cierre de predicciones, solo en las ligas que lo eligen aquí. */
  lockSection?: ReactNode;
}

/** Ajustes de la liga, uno por pestaña: general (identidad, cierre y borrado), puntuación y normas. */
export default function LeagueSettingsTab({
  section,
  deleteConfirmName,
  deleteOpen,
  deleting,
  saving,
  groupName,
  handleDelete,
  imageUrl,
  isNameValid,
  name,
  notice,
  onRemoveImage,
  onUploadImage,
  rulesText,
  scoringEditor,
  setDeleteConfirmName,
  setDeleteOpen,
  setName,
  setNotice,
  setRulesText,
  lockSection,
}: LeagueSettingsTabProps) {
  const { scoring } = scoringEditor;

  return (
    <fieldset
      disabled={saving || scoringEditor.isSaving}
      id={`league-admin-panel-${section}`}
      className="league-admin-panel-section min-w-0 border-0 m-0 p-0"
      role="tabpanel"
      aria-labelledby={`league-admin-tab-${section}`}
    >
      {section === 'general' && (
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
              renderPreview={(url) => <LeagueAvatar url={url} name={groupName} size={72} />}
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
      )}

      {section === 'scoring' && (
        <section className="league-admin-card">
          {scoringEditor.isLoading && <PaperLoading label="Cargando puntuación" embedded />}
          {scoringEditor.error && (
            <p className="league-admin-muted" role="alert">
              {errorMessage(scoringEditor.error, 'No se pudo cargar la puntuación.')}
            </p>
          )}
          {scoring && scoring.editable && (
            <>
              <p className="league-admin-muted">Al guardar se recalculan los puntos de todos.</p>
              <ScoringRulesPanel
                scoring={scoring}
                draft={scoringEditor.draft}
                onChange={(key, value) => {
                  scoringEditor.setValue(key, value);
                  setNotice('');
                }}
              />
              <button
                type="button"
                className="league-admin-btn is-ghost scoring-restore"
                onClick={() => {
                  scoringEditor.restoreDefaults();
                  setNotice('');
                }}
                disabled={scoringEditor.isDefault || scoringEditor.isSaving}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Restaurar valores por defecto
              </button>
            </>
          )}
          {scoring && !scoring.editable && (
            <>
              <p className="league-admin-muted">
                La puntuación de esta liga es fija y no se puede cambiar.
              </p>
              <ScoringRulesPanel scoring={scoring} />
            </>
          )}
        </section>
      )}

      {section === 'norms' && (
        <section className="league-admin-card">
          <p className="league-admin-muted">Cuota, premios, desempates o plazos. Las ven todos.</p>
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
            placeholder="Ej.: 10 € por Bizum a Ana. 60 % al primero, 30 % al segundo, 10 % al tercero."
            aria-label="Normas de la liga"
          />
          <span className="league-admin-hint">{rulesText.length}/8000 caracteres</span>
        </section>
      )}

      {notice && (
        <p className="league-admin-notice" role="status">
          <Check size={14} aria-hidden="true" />
          {notice}
        </p>
      )}

      {section === 'general' && lockSection}

      {section === 'general' && (
        <section className="league-admin-card is-danger">
          <div className="league-admin-card-head">
            <h3>
              <TriangleAlert size={14} aria-hidden="true" />
              Zona de peligro
            </h3>
          </div>
          <p className="league-admin-muted">
            Borra la liga, sus datos y sus participantes. No se puede deshacer.
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
      )}
    </fieldset>
  );
}
