import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ScoringRulesPanel from '../../components/league/ScoringRulesPanel';
import SurvivorStatusBar from '../../components/matchday/SurvivorStatusBar';
import type { LeagueScoring } from '../../types/api';
import { draftToRules, toDraft } from '../../utils/scoringRules';
import { DEFAULT_SCORING } from '../fixtures';

const survivor = (rules = DEFAULT_SCORING): LeagueScoring => ({
  poolFormat: 'SURVIVOR',
  pichichi: false,
  editable: true,
  maxPoints: 1000,
  rules,
  defaults: DEFAULT_SCORING,
});

describe('reglas de superviviente', () => {
  it('se editan los puntos, las vidas y si el empate salva', () => {
    const onChange = vi.fn();
    const draft = toDraft(DEFAULT_SCORING);
    render(<ScoringRulesPanel scoring={survivor()} draft={draft} onChange={onChange} />);

    expect(screen.getByText(/Al primer fallo quedas eliminado/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Vidas'), { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith('survivorLives', '3');
    fireEvent.click(screen.getByRole('checkbox', { name: 'El empate salva' }));
    expect(onChange).toHaveBeenCalledWith('survivorDrawSurvives', '1');
    expect(screen.getByLabelText('Jornada superada')).toHaveValue(1);
  });

  it('en la NFL se juega por semanas', () => {
    const draft = toDraft(DEFAULT_SCORING);
    render(
      <ScoringRulesPanel
        scoring={{ ...survivor(), sport: 'AMERICAN_FOOTBALL' }}
        draft={draft}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/en cada semana eliges un equipo/)).toBeInTheDocument();
    expect(screen.getByText(/Gana quien supere más semanas/)).toBeInTheDocument();
    expect(screen.getByLabelText('Semana superada')).toHaveValue(1);
  });

  it('explica las reglas de la liga y rechaza vidas fuera de rango', () => {
    const rules = { ...DEFAULT_SCORING, survivorLives: 3, survivorDrawSurvives: 1 };
    render(<ScoringRulesPanel scoring={survivor(rules)} />);

    expect(screen.getByText(/Si gana o empata, superas la jornada/)).toBeInTheDocument();
    expect(screen.getByText(/empiezas con 3/)).toBeInTheDocument();
    expect(screen.getByText('Sí')).toBeInTheDocument();
    expect(draftToRules({ ...toDraft(DEFAULT_SCORING), survivorLives: '0' }, 1000)).toBeNull();
    expect(draftToRules({ ...toDraft(DEFAULT_SCORING), survivorLives: '11' }, 1000)).toBeNull();
  });

  it('la barra de la jornada cuenta las vidas que quedan', () => {
    render(
      <SurvivorStatusBar
        status={{
          eliminated: false,
          survived: 4,
          eliminatedRound: null,
          missed: false,
          picks: [],
          livesLeft: 2,
          lives: 3,
          drawSurvives: true,
        }}
      />,
    );

    expect(screen.getByText('2 de 3 vidas')).toBeInTheDocument();
    expect(
      screen.getByText(/El empate también te salva\. Si no eliges, pierdes una vida\./),
    ).toBeInTheDocument();
  });
});
