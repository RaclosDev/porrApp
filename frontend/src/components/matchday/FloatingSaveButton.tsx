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
    <div className="floating-bottom-action fixed bottom-5 left-[50%] [transform:translateX(-50%)] z-[9000] [animation:fadeIn_0.2s_ease-out] shadow-[0_10px_25px_rgba(0,_210,_211,_0.4)] rounded-[30px]">
      <button
        onClick={onSave}
        disabled={isSaving || isLocked}
        className="glass-btn primary-btn py-3 px-6 font-extrabold text-[1rem] rounded-[30px] bg-[linear-gradient(135deg,_#00d2d3,_#00a8ff)] bg-transparent text-black border-none flex items-center gap-2 cursor-pointer"
      >
        <span>💾</span>
        <span>{isSaving ? 'Guardando...' : `Guardar Cambios (${predicted}/${total})`}</span>
      </button>
    </div>
  );
}
