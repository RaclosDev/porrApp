import { useEffect, useRef, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import SheetDialog from '../SheetDialog';
import { POKER_PLAN_CONTACT, POKER_PLANS, pokerPlan } from './pokerPlans';
import type { PokerPlanCode } from '../../services/endpoints/poker';

/** Cada plan es una carta más alta: el 2, la J, la Q y la K (naipes CC0 de Dmitry Fomin). */
const CARDS: Record<PokerPlanCode, string> = {
  FREE: '2',
  LIGA: 'j',
  CLUB: 'q',
  CUSTOM: 'k',
};

function PlanCard({ code }: { code: PokerPlanCode }) {
  return (
    <img
      className="poker-plan-card"
      src={`/poker/naipes/${CARDS[code]}.svg`}
      alt=""
      width={160}
      height={240}
      decoding="async"
    />
  );
}

/**
 * Planes de la liga de póker. En el móvil ocupa toda la pantalla, con una barra fija de planes
 * arriba que lleva a cada uno y marca el que se está viendo; en pantallas anchas van en columnas.
 */
export default function PokerPlanDialog({
  plan,
  leagueName,
  onClose,
}: {
  plan: PokerPlanCode | undefined;
  leagueName: string;
  onClose: () => void;
}) {
  const current = pokerPlan(plan);
  const [active, setActive] = useState<PokerPlanCode>(current.code);
  const bodyRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Partial<Record<PokerPlanCode, HTMLLIElement | null>>>({});

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const onScroll = () => {
      const top = body.getBoundingClientRect().top + body.clientHeight * 0.35;
      let seen: PokerPlanCode = POKER_PLANS[0].code;
      for (const option of POKER_PLANS) {
        const card = cardRefs.current[option.code];
        if (card && card.getBoundingClientRect().top <= top) seen = option.code;
      }
      if (body.scrollTop + body.clientHeight >= body.scrollHeight - 4) {
        seen = POKER_PLANS[POKER_PLANS.length - 1].code;
      }
      setActive(seen);
    };
    body.addEventListener('scroll', onScroll, { passive: true });
    return () => body.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (code: PokerPlanCode) => {
    setActive(code);
    const body = bodyRef.current;
    const card = cardRefs.current[code];
    if (!body || !card) return;
    const top = card.getBoundingClientRect().top - body.getBoundingClientRect().top;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    body.scrollTo?.({ top: body.scrollTop + top - 12, behavior: reduced ? 'auto' : 'smooth' });
  };

  const mailto = (label: string) =>
    `mailto:${POKER_PLAN_CONTACT}?subject=${encodeURIComponent(
      `Plan ${label} de póker para «${leagueName}»`,
    )}`;

  return (
    <SheetDialog
      title="Planes del póker"
      subtitle={`${leagueName} · plan ${current.label}`}
      onClose={onClose}
      className="poker-plans-sheet"
    >
      <nav className="poker-plan-tabs" aria-label="Ir a un plan">
        {POKER_PLANS.map((option) => (
          <button
            key={option.code}
            type="button"
            className={option.code === active ? 'is-active' : undefined}
            aria-pressed={option.code === active}
            onClick={() => goTo(option.code)}
          >
            <PlanCard code={option.code} />
            {option.label}
          </button>
        ))}
      </nav>
      <div className="sheet-dialog-body poker-plans" ref={bodyRef}>
        <ul className="poker-plan-list">
          {POKER_PLANS.map((option) => {
            const isCurrent = option.code === current.code;
            return (
              <li
                key={option.code}
                ref={(node) => {
                  cardRefs.current[option.code] = node;
                }}
                className={`poker-plan is-${option.code.toLowerCase()}${isCurrent ? ' is-current' : ''}${
                  option.highlight ? ' is-highlight' : ''
                }`}
                aria-current={isCurrent ? 'true' : undefined}
              >
                {option.highlight && !isCurrent && (
                  <span className="poker-plan-ribbon">
                    <Sparkles size={12} strokeWidth={2.5} aria-hidden="true" />
                    Recomendado
                  </span>
                )}
                <div className="poker-plan-head">
                  <PlanCard code={option.code} />
                  <div className="poker-plan-name">
                    <strong>{option.label}</strong>
                    {isCurrent && <span className="poker-plan-badge">Tu plan</span>}
                    <small>{option.tagline}</small>
                  </div>
                </div>
                <div className="poker-plan-price">
                  <strong>{option.price}</strong>
                  {option.note && <small>{option.note}</small>}
                  {option.perk && <span className="poker-plan-perk">{option.perk}</span>}
                </div>
                <p className="poker-plan-entries">{option.entries}</p>
                <ul className="poker-plan-features">
                  {option.features.map((feature) => (
                    <li key={feature.text}>
                      <Check size={14} strokeWidth={2.75} aria-hidden="true" />
                      <span>{feature.text}</span>
                    </li>
                  ))}
                </ul>
                {option.cta && !isCurrent && (
                  <a className="poker-plan-cta" href={mailto(option.label)}>
                    {option.cta}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
        <p className="poker-plan-contact">
          ¿Dudas sobre qué plan os encaja? Escríbenos a{' '}
          <a href={mailto(current.label)}>{POKER_PLAN_CONTACT}</a> y te respondemos enseguida.
        </p>
      </div>
    </SheetDialog>
  );
}
