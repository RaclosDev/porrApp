import { useState } from 'react';
import type { Tracker } from '../../services/endpoints/trackers';
import { copyWithToast, joinLink } from '../../utils/leagueInvite';
import TrackerQr from './TrackerQr';

interface Props {
  tracker: Tracker;
}

/**
 * Cómo entra la gente al marcador: escaneando el QR, con el enlace o con el código, y cada uno aparece
 * solo como jugador.
 */
export default function TrackerInvite({ tracker }: Props) {
  const [showQr, setShowQr] = useState(true);
  const link = joinLink(tracker.joinCode);

  return (
    <section
      className="paper-panel album-sheet tracker-section tracker-invite"
      aria-labelledby="tracker-invite-title"
    >
      <h2 id="tracker-invite-title" className="tracker-heading">
        Invitar a la liga
      </h2>
      <p className="tracker-note">
        Quien entre con el QR, el enlace o el código aparece aquí como jugador y lo ve en directo.
      </p>

      <div className="create-league-code">
        <p className="create-league-hint">Código de invitación</p>
        <p className="create-league-code-value">{tracker.joinCode}</p>
      </div>

      {showQr && <TrackerQr link={link} name={tracker.name} />}

      <div className="tracker-actions is-center">
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          aria-pressed={showQr}
          onClick={() => setShowQr((value) => !value)}
        >
          {showQr ? 'Ocultar QR' : 'Mostrar QR'}
        </button>
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          onClick={() => void copyWithToast(link, 'Enlace copiado')}
        >
          Copiar enlace
        </button>
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          onClick={() => void copyWithToast(tracker.joinCode, `Código ${tracker.joinCode} copiado`)}
        >
          Copiar código
        </button>
        <button
          type="button"
          className="glass-btn create-league-small-btn"
          onClick={() =>
            window.open(
              `https://wa.me/?text=${encodeURIComponent(link)}`,
              '_blank',
              'noopener,noreferrer',
            )
          }
        >
          WhatsApp
        </button>
      </div>
    </section>
  );
}
