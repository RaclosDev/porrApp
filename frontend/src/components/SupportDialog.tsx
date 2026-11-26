import { useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Coffee,
  CreditCard,
  Database,
  ExternalLink,
  Heart,
  Server,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import DialogBackdrop from './DialogBackdrop';
import { type CrupierCue } from './poker/crupier/Crupier';
import PokerFreeTable from './poker/PokerFreeTable';
import BarScene from './support/BarScene';
import './support/support.css';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { SUPPORT_LINKS } from '../supportLinks';

const ICONS = { 'Ko-fi': Coffee, Revolut: Zap, PayPal: CreditCard } as const;

const VARIANTS = {
  support: {
    title: 'Invítanos a una caña',
    text: 'Tu caña paga:',
    cta: 'Invitar con',
  },
  tip: {
    title: '¿Propina para el crupier?',
    text: 'Tu propina paga:',
    cta: 'Propina con',
  },
} as const;

/** Lo que ha hecho el «crupier» en el torneo, para que se vea qué se agradece. */
const DEALER_JOBS = ['Ciegas', 'Bote', 'Reparto'];

/** En qué se va la ayuda, para que se vea que no es un bote más. */
const TIP_PAYS = [
  { Icon: Server, text: 'Servidor de las ligas' },
  { Icon: Database, text: 'Base de datos' },
  { Icon: Sparkles, text: 'Próximas mejoras' },
];

/** Nada más abrirse, el crupier saca su cartel de «¡Gracias!». */
const THANKS: CrupierCue = { id: 'gracias', action: 'gracias', audioDelay: 0.4 };

interface SupportDialogProps {
  open: boolean;
  onClose: () => void;
  /** «support» desde el botón de apoyar; «tip» al cerrar un torneo de póker. */
  variant?: keyof typeof VARIANTS;
  /** Con la propina: lo que sobró del bote al repartir, en céntimos. */
  leftoverCents?: number;
}

const euroFormat = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const LINK_BASE =
  'group flex items-center no-underline border border-black/10 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 active:translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--marker-ink)] motion-reduce:transition-none motion-reduce:hover:translate-y-0';

/** Ventana con las formas de apoyar el proyecto: un botón por plataforma, cada uno en otra pestaña. */
export default function SupportDialog({
  open,
  onClose,
  variant = 'support',
  leftoverCents = 0,
}: SupportDialogProps) {
  const { title, text, cta } = VARIANTS[variant];
  const tip = variant === 'tip';
  const leftover = Math.max(0, leftoverCents);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [featured, ...others] = SUPPORT_LINKS;
  const FeaturedIcon = ICONS[featured.label];

  useDialogFocus(dialogRef, { active: open, onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <DialogBackdrop className="paper-dialog-overlay" onDismiss={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="paper-panel paper-dialog max-h-[94dvh] max-w-[420px] overflow-y-auto px-5 pt-7 pb-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-dialog-title"
        aria-describedby="support-dialog-text"
      >
        <button
          type="button"
          className="paper-dialog-close absolute top-2.5 right-2.5 z-10 flex items-center justify-center bg-[rgb(255_246_220/0.75)] text-[#2a1d0a]"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={20} aria-hidden="true" />
        </button>

        {tip ? (
          <div className="poker -mx-5 -mt-7 mb-4">
            <PokerFreeTable
              className="poker-tip-scene"
              title={null}
              heading={
                <span className="poker-tip-leftover">
                  <span>Os han sobrado del bote</span>
                  <strong>{euroFormat.format(leftover / 100)}</strong>
                </span>
              }
              cue={THANKS}
            >
              <ul className="poker-tip-jobs">
                {DEALER_JOBS.map((job) => (
                  <li key={job}>
                    <Check size={11} strokeWidth={3} aria-hidden="true" />
                    {job}
                  </li>
                ))}
                <li className="is-fee">Comisión 0 €</li>
              </ul>
            </PokerFreeTable>
          </div>
        ) : (
          <div className="-mx-5 -mt-7 mb-4">
            <BarScene />
          </div>
        )}

        <div className="mb-3 flex flex-col items-center gap-1 text-center">
          <h2 id="support-dialog-title" className="poster-title m-0 text-[1.3rem] leading-tight">
            {title}
          </h2>
          <p
            id="support-dialog-text"
            className="m-0 text-[0.92rem] leading-normal text-muted [text-wrap:balance]"
          >
            {text}
          </p>
          <ul className="support-pays">
            {TIP_PAYS.map(({ Icon, text: line }) => (
              <li key={line}>
                <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <a
          href={featured.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${LINK_BASE} relative gap-3 min-h-16 py-2 rounded-2xl ring-2 ring-[#ffd76a] pr-4 pl-3 shadow-[0_4px_0_rgba(0,0,0,0.3)] hover:shadow-[0_6px_0_rgba(0,0,0,0.3)] active:shadow-[0_1px_0_rgba(0,0,0,0.3)]`}
          style={{ background: featured.background, color: featured.color }}
        >
          <span className="absolute -top-2.5 right-3 rounded-full bg-[#feca57] px-2 py-px text-[0.68rem] font-bold uppercase tracking-wide text-[#191c1f] shadow-[0_2px_0_rgba(0,0,0,0.2)]">
            Recomendado
          </span>
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20"
            aria-hidden="true"
          >
            <FeaturedIcon size={24} strokeWidth={2.2} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
            <span className="text-[1rem] leading-tight font-extrabold">
              {cta} {featured.label}
            </span>
            <span className="text-[0.8rem] leading-tight opacity-85">{featured.hint}</span>
          </span>
          <ExternalLink
            size={18}
            aria-hidden="true"
            className="shrink-0 opacity-70 transition-opacity group-hover:opacity-100"
          />
        </a>

        <p
          className={`mt-2.5 mb-1.5 text-center text-[0.75rem] font-bold tracking-wider text-muted uppercase`}
        >
          o con
        </p>
        <ul className="m-0 grid list-none grid-cols-2 gap-2.5 p-0">
          {others.map((link) => {
            const Icon = ICONS[link.label];
            return (
              <li key={link.label}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.hint}
                  className={`${LINK_BASE} min-h-12 justify-center gap-2 rounded-xl px-3 py-2 font-extrabold shadow-[0_3px_0_rgba(0,0,0,0.22)] hover:shadow-[0_5px_0_rgba(0,0,0,0.22)] active:shadow-[0_1px_0_rgba(0,0,0,0.22)]`}
                  style={{ background: link.background, color: link.color }}
                >
                  <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
                  {link.label}
                </a>
              </li>
            );
          })}
        </ul>

        <p
          className={`mt-3 mb-0 flex items-center justify-center gap-1.5 text-center text-[0.78rem] text-muted [text-wrap:balance]`}
        >
          <Heart size={14} aria-hidden="true" className="shrink-0 text-[var(--miss)]" />
          Es voluntario: todo sigue gratis para todos.
        </p>
      </div>
    </DialogBackdrop>,
    document.body,
  );
}
