import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Coffee, CreditCard, ExternalLink, HandCoins, Heart, X, Zap } from 'lucide-react';
import DialogBackdrop from './DialogBackdrop';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { SUPPORT_LINKS } from '../supportLinks';

const ICONS = { 'Ko-fi': Coffee, Revolut: Zap, PayPal: CreditCard } as const;

const VARIANTS = {
  support: {
    Icon: Coffee,
    title: 'Invítanos a un café',
    text: 'PorrApp es gratis y sin anuncios. Con tu ayuda pagamos el servidor y seguimos añadiendo cosas.',
  },
  tip: {
    Icon: HandCoins,
    title: '¿Propina para el crupier? 😉',
    text: 'Torneo guardado. Si PorrApp os ha llevado bien la timba, una propina ayuda a pagar el servidor y a seguir mejorándola.',
  },
} as const;

interface SupportDialogProps {
  open: boolean;
  onClose: () => void;
  /** «support» desde el botón de apoyar; «tip» al cerrar un torneo de póker. */
  variant?: keyof typeof VARIANTS;
}

/** Ventana con las formas de apoyar el proyecto: un botón por plataforma, cada uno en otra pestaña. */
export default function SupportDialog({ open, onClose, variant = 'support' }: SupportDialogProps) {
  const { Icon: HeroIcon, title, text } = VARIANTS[variant];
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus(dialogRef, { active: open, onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <DialogBackdrop className="paper-dialog-overlay" onDismiss={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="paper-panel paper-dialog max-w-[380px] overflow-y-auto px-5 pt-7 pb-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-dialog-title"
        aria-describedby="support-dialog-text"
      >
        <button
          type="button"
          className="paper-dialog-close absolute top-2.5 right-2.5 flex items-center justify-center"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <span
            className="flex items-center justify-center w-16 h-16 rounded-full bg-[#fde8d7] text-[#a8470b] border-2 border-dashed border-[#e7b48f] rotate-[-6deg]"
            aria-hidden="true"
          >
            <HeroIcon size={30} strokeWidth={2.2} />
          </span>
          <h2 id="support-dialog-title" className="poster-title m-0 text-[1.45rem] leading-tight">
            {title}
          </h2>
          <p
            id="support-dialog-text"
            className="m-0 text-[0.92rem] leading-normal text-muted [text-wrap:balance]"
          >
            {text}
          </p>
        </div>

        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {SUPPORT_LINKS.map((link, index) => {
            const Icon = ICONS[link.label];
            return (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 min-h-16 pl-2.5 pr-4 py-2.5 rounded-2xl no-underline border border-black/10 shadow-[0_3px_0_rgba(0,0,0,0.22)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_5px_0_rgba(0,0,0,0.22)] active:translate-y-0.5 active:shadow-[0_1px_0_rgba(0,0,0,0.22)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--marker-ink)]"
                  style={{ background: link.background, color: link.color }}
                >
                  <span
                    className="flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-white/25"
                    aria-hidden="true"
                  >
                    <Icon size={22} strokeWidth={2.2} />
                  </span>
                  <span className="flex flex-col flex-1 min-w-0 text-left gap-0.5">
                    <span className="flex items-center gap-2 font-extrabold text-[1.05rem] leading-tight">
                      {link.label}
                      {index === 0 && (
                        <span className="rounded-full bg-[#feca57] text-[#191c1f] px-2 py-px text-[0.68rem] font-bold uppercase tracking-wide">
                          Recomendado
                        </span>
                      )}
                    </span>
                    <span className="text-[0.8rem] leading-tight opacity-85">{link.hint}</span>
                  </span>
                  <ExternalLink
                    size={18}
                    aria-hidden="true"
                    className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
                  />
                </a>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 mb-0 flex items-center justify-center gap-1.5 text-[0.78rem] text-muted text-center [text-wrap:balance]">
          <Heart size={14} aria-hidden="true" className="shrink-0 text-[#b91c1c]" />
          Es voluntario: todo sigue gratis para todos.
        </p>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
