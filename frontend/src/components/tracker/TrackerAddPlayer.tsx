import { useId, useRef, useState, type FormEvent } from 'react';

interface Props {
  busy: boolean;
  onAddPlayer: (name: string) => Promise<boolean>;
  label?: string;
}

export default function TrackerAddPlayer({
  busy,
  onAddPlayer,
  label = 'Nombre del jugador',
}: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const sending = useRef(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || busy || sending.current) return;
    sending.current = true;
    setPending(true);
    setAdded('');
    try {
      if (await onAddPlayer(clean)) {
        setName('');
        setAdded(`${clean} ya está en la liga.`);
        input.current?.focus();
      }
    } finally {
      sending.current = false;
      setPending(false);
    }
  };

  return (
    <form className="tracker-player-form" onSubmit={submit}>
      <label htmlFor={id}>{label}</label>
      <p id={`${id}-hint`} className="tracker-note">
        No necesita cuenta ni instalar la app. Podéis apuntar sus resultados desde aquí.
      </p>
      <div className="tracker-add-player">
        <input
          ref={input}
          id={id}
          aria-describedby={`${id}-hint`}
          className="glass-input"
          maxLength={40}
          autoComplete="off"
          placeholder="Escribe su nombre"
          value={name}
          readOnly={busy || pending}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          className="glass-btn create-league-small-btn"
          disabled={busy || pending || !name.trim()}
        >
          {pending ? 'Añadiendo…' : 'Añadir'}
        </button>
      </div>
      {added && (
        <p className="tracker-note" role="status">
          {added}
        </p>
      )}
    </form>
  );
}
