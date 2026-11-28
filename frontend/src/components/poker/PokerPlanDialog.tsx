import { Check } from 'lucide-react';
import SheetDialog from '../SheetDialog';
import { POKER_PLAN_CONTACT, POKER_PLANS, pokerPlan } from './pokerPlans';
import type { PokerPlanCode } from '../../services/endpoints/poker';

/** Hoja con el plan de la liga de póker, sus límites y los demás planes. */
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
  const subject = encodeURIComponent(`Plan de póker para «${leagueName}»`);
  return (
    <SheetDialog title={`Plan ${current.label}`} subtitle={leagueName} onClose={onClose}>
      <div className="sheet-dialog-body poker-plans">
        <p className="sheet-dialog-intro">
          {current.entries}. Las porras y los juegos de mesa son siempre gratis y sin límites.
        </p>
        <ul className="poker-plan-list">
          {POKER_PLANS.map((option) => (
            <li
              key={option.code}
              className={`poker-plan${option.code === current.code ? ' is-current' : ''}`}
              aria-current={option.code === current.code ? 'true' : undefined}
            >
              <div className="poker-plan-head">
                <strong>{option.label}</strong>
                {option.code === current.code && <span className="poker-plan-badge">Tu plan</span>}
                <span className="poker-plan-price">
                  {option.price}
                  {option.note && <small> {option.note}</small>}
                </span>
              </div>
              <p className="poker-plan-entries">{option.entries}</p>
              <ul className="poker-plan-features">
                {option.features.map((feature) => (
                  <li key={feature}>
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="poker-plan-contact">
          ¿Quieres cambiar de plan? Escríbenos a{' '}
          <a href={`mailto:${POKER_PLAN_CONTACT}?subject=${subject}`}>{POKER_PLAN_CONTACT}</a>.
        </p>
      </div>
    </SheetDialog>
  );
}
