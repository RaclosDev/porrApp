import { Copy } from 'lucide-react';
import SheetDialog from '../SheetDialog';
import TrackerQr from '../tracker/TrackerQr';
import PokerFreeTable from './PokerFreeTable';
import { copyWithToast, joinLink } from '../../utils/leagueInvite';

interface Props {
  league: { name: string; joinCode: string };
  onClose: () => void;
}

/** Invitar a la liga: el crupier enseña el QR en un cartel y debajo van el código y los enlaces. */
export default function PokerInviteDialog({ league, onClose }: Props) {
  const link = joinLink(league.joinCode);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <SheetDialog title="Invitar a la liga" onClose={onClose} className="poker-invite-sheet">
      <div className="sheet-dialog-body poker">
        <PokerFreeTable
          className="poker-invite"
          heading="¡Siéntate a la mesa!"
          title={null}
          holding
        >
          <div className="poker-invite-sign">
            <TrackerQr
              link={link}
              name={league.name}
              label={`Código QR para unirse a ${league.name}`}
            />
            <span className="poker-invite-sign-text">Escanéalo para entrar</span>
          </div>
          <button
            type="button"
            className="poker-invite-code"
            aria-label={`Copiar el código ${league.joinCode}`}
            onClick={() => void copyWithToast(league.joinCode, `Código ${league.joinCode} copiado`)}
          >
            <span className="poker-invite-code-label">Código</span>
            <span className="poker-invite-code-value">{league.joinCode}</span>
            <Copy size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <div className="poker-invite-actions">
            {canShare && (
              <button
                type="button"
                className="glass-btn primary-btn"
                onClick={() =>
                  void navigator
                    .share({ title: league.name, text: `Únete a ${league.name}`, url: link })
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
        </PokerFreeTable>
      </div>
    </SheetDialog>
  );
}
