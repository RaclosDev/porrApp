import PaperLoading from '../PaperLoading';
import { useState } from 'react';
import { LeagueAvatar } from '../Avatar';
import ImagePicker from '../ImagePicker';
import {
  Check,
  Loader2,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import RulesTabs, { type RulesTab } from './RulesTabs';
import ScoringRulesPanel from './ScoringRulesPanel';
import type { ScoringEditor } from '../../hooks/useScoringEditor';
import { errorMessage } from '../../utils/errors';

interface LeagueSettingsTabProps {
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
}

/** Ajustes de la liga: nombre, reglas (puntuación y normas), imagen y borrado. */
export default function LeagueSettingsTab({
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
}: LeagueSettingsTabProps) {
  const [rulesTab, setRulesTab] = useState<RulesTab>('scoring');
  const { scoring } = scoringEditor;

  return (
    <fieldset
      disabled={saving || scoringEditor.isSaving}
      id="league-admin-panel-settings"
      className="league-admin-panel-section min-w-0 border-0 m-0 p-0"
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
          {rulesTab === 'norms' && (
            <span className="league-admin-card-meta">{rulesText.length}/8000</span>
          )}
        </div>
        <RulesTabs
          idPrefix="league-admin-rules"
          tab={rulesTab}
          onChange={setRulesTab}
          badges={{
            scoring: scoringEditor.isDirty ? (
              <span className="league-admin-unsaved-dot" aria-label="Cambios sin guardar" />
            ) : null,
          }}
        />

        {rulesTab === 'scoring' && (
          <div
            id="league-admin-rules-panel-scoring"
            role="tabpanel"
            aria-labelledby="league-admin-rules-tab-scoring"
            className="rules-tab-panel"
          >
            {scoringEditor.isLoading && <PaperLoading label="Cargando puntuación" embedded />}
            {scoringEditor.error && (
              <p className="league-admin-muted" role="alert">
                {errorMessage(scoringEditor.error, 'No se pudo cargar la puntuación.')}
              </p>
            )}
            {scoring && scoring.editable && (
              <>
                <p className="league-admin-muted">
                  Puntos por cada acierto. Al guardar, los puntos de todos los participantes se
                  recalculan con estos valores.
                </p>
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
          </div>
        )}

        {rulesTab === 'norms' && (
          <div
            id="league-admin-rules-panel-norms"
            role="tabpanel"
            aria-labelledby="league-admin-rules-tab-norms"
            className="rules-tab-panel"
          >
            <p className="league-admin-muted">
              Cuota, a quién pagar, plazos, criterios de desempate o reparto de premios. Se muestran
              a todos los participantes.
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
              placeholder="Ej.: Cuota de 10 € por Bizum a Ana antes del 10 de junio. Premios: 60 % al primero, 30 % al segundo y 10 % al tercero."
              aria-label="Normas de la liga"
            />
          </div>
        )}
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
    </fieldset>
  );
}
