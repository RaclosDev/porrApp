interface FloatingSaveButtonProps {
  isSaving: boolean;
  isLocked: boolean;
  predicted: number;
  total: number;
  onSave: () => void;
}

/** Botón flotante para guardar los cambios pendientes (sobre todo en móvil). */
export default function FloatingSaveButton({
  isSaving,
  isLocked,
  predicted,
  total,
  onSave,
}: FloatingSaveButtonProps) {
  return (
    <div className="floating-bottom-action fixed bottom-5 left-[50%] [transform:translateX(-50%)] z-[9000]">
      <button
        type="button"
        onClick={onSave}
        disabled={isSaving || isLocked}
        className="glass-btn primary-btn min-h-11 py-3 px-6 font-extrabold text-[1rem] rounded-[30px] cursor-pointer"
      >
        {isSaving ? 'Guardando…' : `Guardar cambios (${predicted}/${total})`}
      </button>
    </div>
  );
}
