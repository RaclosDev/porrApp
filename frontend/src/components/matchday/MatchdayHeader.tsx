interface MatchdayHeaderProps {
  title: string;
  isLocked: boolean;
  predicted: number;
  total: number;
  isSaving: boolean;
  onSave: () => void;
  successMsg: string;
  errorMsg: string;
}

/** Cabecera de la jornada con el botón de guardar y los avisos del último guardado. */
export default function MatchdayHeader({
  title,
  isLocked,
  predicted,
  total,
  isSaving,
  onSave,
  successMsg,
  errorMsg,
}: MatchdayHeaderProps) {
  return (
    <>
      <div className="md-page-header">
        <div className="min-w-0">
          <h1>{title}</h1>
          <p className="md-page-sub">
            {isLocked ? '🔒 Porra cerrada' : `${predicted}/${total} pronosticados`}
          </p>
        </div>

        <button
          onClick={onSave}
          disabled={isSaving || isLocked}
          className={`glass-btn primary-btn md-save-btn ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isSaving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      {successMsg && (
        <div
          className="bg-[rgba(0,_184,_148,_0.2)] bg-none border border-[#00b894] text-[#55efc4] py-3 px-4 rounded-[10px] mb-4 text-[0.95rem] flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <span>✅</span> {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          className="bg-[rgba(231,_76,_60,_0.2)] bg-none border border-[#e74c3c] text-[#ff7675] py-3 px-4 rounded-[10px] mb-4 text-[0.95rem] flex items-center gap-2"
          role="alert"
        >
          <span>⚠️</span> {errorMsg}
        </div>
      )}
    </>
  );
}
