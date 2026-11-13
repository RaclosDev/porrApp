import type { Tracker } from '../../services/endpoints/trackers';
import { copyWithToast, joinLink } from '../../utils/leagueInvite';
import TrackerQr from './TrackerQr';

interface Props {
  tracker: Pick<Tracker, 'name' | 'joinCode'>;
}

/** Cómo entra la gente a la liga: escaneando el QR, con el código o con el enlace. */
export default function TrackerInvite({ tracker }: Props) {
  const link = joinLink(tracker.joinCode);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <section
      id="tracker-invite"
      className="paper-panel album-sheet tracker-section tracker-invite"
      aria-labelledby="tracker-invite-title"
    >
      <h2 id="tracker-invite-title" className="tracker-heading">
        Invitar a la liga
      </h2>

      <div className="tracker-invite-body">
        <TrackerQr link={link} name={tracker.name} />

        <div className="tracker-invite-side">
          <button
            type="button"
            className="tracker-invite-code"
            aria-label={`Copiar el código ${tracker.joinCode}`}
            onClick={() =>
              void copyWithToast(tracker.joinCode, `Código ${tracker.joinCode} copiado`)
            }
          >
            <span className="tracker-invite-code-label">Código</span>
            <span className="tracker-invite-code-value">{tracker.joinCode}</span>
            <CopyIcon />
          </button>

          <div className="tracker-invite-actions">
            {canShare && (
              <button
                type="button"
                className="glass-btn primary-btn"
                onClick={() =>
                  void navigator
                    .share({ title: tracker.name, text: `Únete a ${tracker.name}`, url: link })
                    .catch(() => {})
                }
              >
                Compartir
              </button>
            )}
            <button
              type="button"
              className="glass-btn"
              onClick={() => void copyWithToast(link, 'Enlace copiado')}
            >
              Copiar enlace
            </button>
            <button
              type="button"
              className="glass-btn"
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
        </div>
      </div>
    </section>
  );
}

function CopyIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}
