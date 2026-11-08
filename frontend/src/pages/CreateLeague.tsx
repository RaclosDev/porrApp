import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createGroup, fetchCompetitions, uploadGroupImage } from '../services/api';
import { queryKeys } from '../services/queryKeys';
import { useAppContext } from '../context/AppContext';
import PaperLoading from '../components/PaperLoading';
import { confirmAction } from '../utils/confirmAction';
import { errorMessage } from '../utils/errors';
import type { Group } from '../types/api';
import {
  FIELD_IDS,
  LEAGUE_STEPS,
  buildCreateRequest,
  dataUrlToBlob,
  emptyDraft,
  firstIncompleteStep,
  newCreationKey,
  validateStep,
  type DraftContext,
  type LeagueStepId,
  type StepErrors,
} from '../components/createLeague/leagueDraft';
import { useLeagueDraft } from '../components/createLeague/useLeagueDraft';
import WizardSteps from '../components/createLeague/WizardSteps';
import SportStep from '../components/createLeague/SportStep';
import CompetitionStep from '../components/createLeague/CompetitionStep';
import FormatStep from '../components/createLeague/FormatStep';
import RulesStep from '../components/createLeague/RulesStep';
import IdentityStep from '../components/createLeague/IdentityStep';
import SummaryStep from '../components/createLeague/SummaryStep';
import LeagueInvitePanel from '../components/createLeague/LeagueInvitePanel';

const STEP_TITLES: Record<LeagueStepId, string> = {
  sport: 'Elige deporte',
  competition: 'Elige la competición',
  format: 'Elige el modo de juego',
  rules: 'Ajusta las reglas',
  identity: 'Ponle nombre',
  summary: 'Revisa y crea',
};

/** El título del paso; la competición cambia con el tenis (un torneo) y con otro deporte (la tuya). */
function stepTitle(id: LeagueStepId, sport: string | null) {
  if (id === 'competition' && sport === 'TENNIS') return 'Elige el torneo';
  if (id === 'competition' && sport === 'OTHER') return 'Nombra tu competición';
  return STEP_TITLES[id];
}

const EMPTY = JSON.stringify(emptyDraft());

/** Lleva el foco al primer campo con error; el mensaje ya está enlazado a él. */
function focusFirstError(errors: StepErrors) {
  const key = Object.keys(errors)[0] as keyof StepErrors | undefined;
  if (!key) return;
  requestAnimationFrame(() => {
    const element = document.getElementById(FIELD_IDS[key]);
    if (!element) return;
    const target =
      element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
        ? element
        : element.querySelector<HTMLElement>(
            '[aria-invalid="true"], input:not([disabled]), textarea, select',
          );
    target?.focus();
  });
}

/**
 * Crear liga, paso a paso y en su propia pantalla: deporte, competición, modo de juego, reglas,
 * identidad y resumen. El paso va en la URL (?paso=) y lo elegido se guarda en el dispositivo hasta crearla.
 */
export default function CreateLeague() {
  const queryClient = useQueryClient();
  const { changeGroup } = useAppContext();
  const competitions = useQuery({
    queryKey: queryKeys.competitions(),
    queryFn: fetchCompetitions,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  // Sin la lista de competiciones (error) aún se puede crear una personalizada.
  const ctx = useMemo<DraftContext | null>(() => {
    if (competitions.data) return { competitions: competitions.data };
    return competitions.isError ? { competitions: [] } : null;
  }, [competitions.data, competitions.isError]);

  const { draft, update, reset } = useLeagueDraft(ctx);
  const [params, setParams] = useSearchParams();
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [created, setCreated] = useState<{ group: Group; imageFailed: boolean } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // No se puede saltar a un paso con otro anterior pendiente.
  const reachable = ctx ? firstIncompleteStep(draft, ctx) : 0;
  const requested = Math.max(1, Math.trunc(Number(params.get('paso'))) || 1) - 1;
  const current = Math.min(requested, reachable, LEAGUE_STEPS.length - 1);
  const step = LEAGUE_STEPS[current];
  const isLast = current === LEAGUE_STEPS.length - 1;
  const errors: StepErrors = attempted && ctx ? validateStep(step.id, draft, ctx) : {};

  useEffect(() => {
    if (ctx && !created && requested !== current) {
      setParams({ paso: String(current + 1) }, { replace: true });
    }
  }, [ctx, created, requested, current, setParams]);

  // Al cambiar de paso, el foco va a su título para que el lector anuncie dónde se está.
  const shownStep = useRef(current);
  useEffect(() => {
    if (shownStep.current === current) return;
    shownStep.current = current;
    // Arriba del todo, para ver también en qué paso se está.
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [current]);

  const goTo = (index: number) => {
    setAttempted(false);
    setSubmitError('');
    setParams({ paso: String(index + 1) });
  };

  const submit = async () => {
    if (!ctx || submitting) return;
    if (reachable < LEAGUE_STEPS.length - 1) {
      goTo(reachable);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    // La clave se guarda con el borrador: si se pierde la respuesta, reintentar no duplica la liga.
    const key = draft.creationKey ?? newCreationKey();
    if (!draft.creationKey) update({ creationKey: key });
    try {
      const group = await createGroup(buildCreateRequest(draft, ctx), key);
      let imageFailed = false;
      if (draft.image) {
        try {
          await uploadGroupImage(group.id, dataUrlToBlob(draft.image));
        } catch {
          imageFailed = true;
        }
      }
      changeGroup(String(group.id));
      await queryClient.invalidateQueries({ queryKey: queryKeys.myGroups() });
      // Juntos: el borrador vacío no debe devolver la URL al paso 1 antes de enseñar la liga.
      setCreated({ group, imageFailed });
      reset();
    } catch (reason) {
      setSubmitError(errorMessage(reason, 'No se pudo crear la liga'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!ctx) return;
    if (isLast) {
      void submit();
      return;
    }
    const stepErrors = validateStep(step.id, draft, ctx);
    if (Object.keys(stepErrors).length > 0) {
      setAttempted(true);
      focusFirstError(stepErrors);
      return;
    }
    goTo(current + 1);
  };

  const startOver = async () => {
    const confirmed = await confirmAction({
      title: '¿Empezar de nuevo?',
      message: 'Se borra todo lo elegido.',
      confirmLabel: 'Empezar de nuevo',
    });
    if (!confirmed) return;
    reset();
    goTo(0);
  };

  if (created) {
    return (
      <section className="view-section active create-league">
        <div className="paper-panel album-sheet create-league-sheet">
          <h1 className="poster-title create-league-title">Liga creada</h1>
          <LeagueInvitePanel group={created.group} imageFailed={created.imageFailed} />
        </div>
      </section>
    );
  }

  const stepProps = { draft, update, errors, ctx: ctx ?? { competitions: [] } };

  return (
    <section className="view-section active create-league">
      <header className="create-league-header">
        <div>
          <h1 className="m-0 poster-title text-[1.8rem] text-white">Crear liga</h1>
          <p className="create-league-progress">
            Paso {current + 1} de {LEAGUE_STEPS.length}
          </p>
        </div>
        {/* Solo al empezar: quien venía a unirse se da cuenta aquí, no a mitad del asistente. */}
        {current === 0 && (
          <Link to="/mis-ligas?unirse" className="create-league-link is-dark">
            Tengo un código
          </Link>
        )}
      </header>

      <WizardSteps current={current} reachable={reachable} onSelect={goTo} />

      <form
        className="paper-panel album-sheet create-league-sheet"
        onSubmit={handleSubmit}
        noValidate
        aria-labelledby="create-league-step-title"
      >
        <h2
          id="create-league-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="poster-title create-league-title"
        >
          {stepTitle(step.id, draft.sport)}
        </h2>

        {!ctx ? (
          <PaperLoading label="Cargando competiciones" embedded />
        ) : (
          <>
            {competitions.isError && step.id === 'sport' && (
              <div className="create-league-error is-block" role="alert">
                <span>No se pudieron cargar las competiciones.</span>
                <button
                  type="button"
                  className="glass-btn create-league-small-btn"
                  onClick={() => void competitions.refetch()}
                >
                  Reintentar
                </button>
              </div>
            )}
            {step.id === 'sport' && <SportStep {...stepProps} />}
            {step.id === 'competition' && <CompetitionStep {...stepProps} />}
            {step.id === 'format' && <FormatStep {...stepProps} />}
            {step.id === 'rules' && <RulesStep {...stepProps} />}
            {step.id === 'identity' && <IdentityStep {...stepProps} />}
            {step.id === 'summary' && (
              <SummaryStep
                draft={draft}
                ctx={stepProps.ctx}
                goTo={(id) => goTo(LEAGUE_STEPS.findIndex((item) => item.id === id))}
              />
            )}
          </>
        )}

        {submitError && (
          <p className="create-league-error is-block" role="alert">
            {submitError}
          </p>
        )}

        <div className="create-league-nav">
          {current === 0 ? (
            <Link to="/mis-ligas" className="glass-btn create-league-nav-btn">
              Cancelar
            </Link>
          ) : (
            <button
              type="button"
              className="glass-btn create-league-nav-btn"
              onClick={() => goTo(current - 1)}
              disabled={submitting}
            >
              Atrás
            </button>
          )}
          <button
            type="submit"
            className="glass-btn primary-btn create-league-nav-btn is-primary"
            disabled={!ctx || submitting}
          >
            {isLast ? (submitting ? 'Creando liga…' : 'Crear liga') : 'Siguiente'}
          </button>
        </div>
        {JSON.stringify(draft) !== EMPTY && (
          <button
            type="button"
            className="create-league-link create-league-restart"
            onClick={startOver}
            disabled={submitting}
          >
            Empezar de nuevo
          </button>
        )}
      </form>
    </section>
  );
}
