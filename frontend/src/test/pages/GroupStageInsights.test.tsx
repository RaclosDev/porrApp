import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppContext } from '../../context/AppContext';
import { useGroupStageInsights } from '../../hooks/useGroupStageInsights';
import Search from '../../pages/Search';
import Stats from '../../pages/Stats';
import type { PredictionData, PredictionSummary } from '../../types/api';
import { groupStageTournament, toGroupStageEntries } from '../../utils/groupStageBracket';
import { standing } from '../fixtures';

vi.mock('../../context/AppContext', () => ({ useAppContext: vi.fn() }));
vi.mock('../../components/layout/prefetchRoute', () => ({ prefetchRoute: vi.fn() }));
vi.mock('../../hooks/useGroupStageInsights', () => ({ useGroupStageInsights: vi.fn() }));

/** Torneo terminado: España gana la final a Francia. */
const official: PredictionData = {
  groups: { A: ['España', 'Chile', 'Italia', 'Perú'], B: ['Francia', 'Japón', 'Brasil', 'México'] },
  thirds: ['Italia'],
  r32: [
    ['España', 'Japón'],
    ['Francia', 'Chile'],
  ],
  r16: [['España', 'Francia']],
  qf: [['España', 'Francia']],
  sf: [['España', 'Francia']],
  final: ['España', 'Francia'],
  champion: 'España',
  scorer: 'Kylian Mbappé',
};
const played = (teams: string[]) =>
  Object.fromEntries(teams.map((team) => [team, standing({ mp: 3 })]));
const standings = { A: played(official.groups!.A), B: played(official.groups!.B) };

const bracket = (fields: Partial<PredictionData>): PredictionData => ({
  groups: { A: ['España', 'Italia', 'Chile'], B: ['Francia', 'Japón', 'Perú'] },
  thirds: ['Chile'],
  r32: [],
  r16: [
    ['España', 'Japón'],
    ['Francia', 'Chile'],
  ],
  qf: [['España', 'Francia']],
  sf: [['España', 'Francia']],
  final: ['España', 'Francia'],
  champion: 'España',
  ...fields,
});
const prediction = (key: string, name: string, data: PredictionData): PredictionSummary => ({
  key,
  hash: key,
  paid: true,
  participantName: name,
  userId: Number(key),
  predictionName: null,
  groupId: 7,
  data,
});
const predictions = [
  prediction('1', 'Ana', bracket({ scorer: 'Kylian Mbappé' })),
  prediction('2', 'Berto', bracket({ champion: 'Francia', scorer: 'Harry Kane' })),
  prediction(
    '3',
    'Carla',
    bracket({
      groups: { A: ['Italia', 'España', 'Chile'], B: ['Japón', 'Francia', 'Perú'] },
      qf: [['España', 'Japón']],
      sf: [['España', 'Japón']],
      final: ['España', 'Japón'],
      champion: 'Japón',
    }),
  ),
];

const league = ({ knockoutsOnly = false, pichichi = true } = {}) => {
  const tournament = groupStageTournament(official, standings, knockoutsOnly);
  vi.mocked(useGroupStageInsights).mockReturnValue({
    entries: toGroupStageEntries(predictions, knockoutsOnly),
    field: tournament.field,
    tournament,
    officialBracket: official,
    sentCount: predictions.length,
    nextLockAt: null,
    loading: false,
    error: false,
    hasLeague: true,
    groupId: '7',
    leagueName: 'Mundial de la oficina',
    knockoutsOnly,
    pichichi,
    avatarByUserId: new Map(),
    openPrediction: vi.fn(),
  });
};

const open = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      {path.startsWith('/stats') ? <Stats /> : <Search />}
    </MemoryRouter>,
  );

const card = (name: string) => screen.getByRole('region', { name });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAppContext).mockReturnValue({
    leagueKind: 'worldCup',
    activeGroupId: '7',
    userGroups: [],
    changeGroup: vi.fn(),
    groupError: null,
  } as unknown as ReturnType<typeof useAppContext>);
  league();
});

describe('Más elegidos de un torneo con fase de grupos', () => {
  it('saca las rondas, el campeón y la final del cuadro genérico', () => {
    open('/stats');

    expect(screen.getByText(/3 predicciones · Torneo terminado/)).toBeInTheDocument();
    const rounds = card('Más elegidos por ronda');
    expect(
      within(rounds)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    ).toEqual(
      expect.arrayContaining(['Grupos', 'Dieciseisavos', 'Octavos', 'Cuartos', 'Semifinales']),
    );
    // Sin ronda elegida, la más avanzada: quién pasa las semifinales (los finalistas).
    expect(rounds).toHaveTextContent('Semifinales · 3 predicciones');
    const spain = within(rounds).getByRole('link', { name: /España/ });
    expect(spain).toHaveTextContent('3 de 3');
    expect(spain).toHaveTextContent('Pasó');
    expect(spain).toHaveAttribute('href', '/search?team=Espa%C3%B1a&round=4');
    expect(within(rounds).getByRole('link', { name: /Japón/ })).toHaveTextContent('No pasó');

    const champion = card('Campeón más elegido');
    expect(champion).toHaveTextContent('Campeón: España. Lo acertó el 33 % de la liga.');
    expect(within(champion).getByRole('link', { name: /Francia/ })).toHaveTextContent('Subcampeón');
    expect(within(champion).getByRole('link', { name: /Japón/ })).toHaveTextContent(
      'Cayó en dieciseisavos',
    );

    const finals = card('Finales más repetidas');
    expect(finals).toHaveTextContent('Final real: España - Francia.');
    expect(within(finals).getAllByRole('listitem')[0]).toHaveTextContent('2 de 3');
    expect(within(finals).getAllByRole('listitem')[0]).toHaveTextContent('Fue la final');
  });

  it('añade lo que no es del cuadro: el pichichi y el primero de cada grupo', () => {
    open('/stats');

    const scorers = card('Pichichi más elegido');
    expect(scorers).toHaveTextContent('Pichichi: Kylian Mbappé.');
    const rows = within(scorers).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Harry Kane');
    expect(rows[0]).toHaveTextContent('No fue el pichichi');
    expect(rows[1]).toHaveTextContent('Fue el pichichi');

    const winners = card('Primero de grupo más elegido');
    const first = within(winners).getAllByRole('link');
    expect(first[0]).toHaveTextContent('A · España');
    expect(first[0]).toHaveTextContent('2 de 3');
    expect(first[0]).toHaveTextContent('Fue primero');
    expect(first[0]).toHaveAttribute('href', '/search?team=Espa%C3%B1a&round=first');
  });

  it('en solo eliminatorias no hay fase de grupos y el pichichi solo sale si se predice', () => {
    league({ knockoutsOnly: true, pichichi: false });
    open('/stats');

    expect(
      within(card('Más elegidos por ronda')).queryByRole('button', { name: 'Grupos' }),
    ).toBeNull();
    expect(screen.queryByRole('region', { name: 'Primero de grupo más elegido' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Pichichi más elegido' })).toBeNull();
    expect(card('Finales más repetidas')).toBeInTheDocument();
  });
});

describe('Buscador de un torneo con fase de grupos', () => {
  it('ordena los equipos por grupo, también los que nadie hace pasar', () => {
    open('/search?team=M%C3%A9xico');

    expect(
      within(screen.getByRole('group', { name: 'Grupo B' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Brasil', 'Francia', 'Japón', 'México']);
    expect(screen.getByRole('heading', { name: 'México · Pasa de grupos' })).toBeInTheDocument();
    expect(screen.getByText('Cayó en grupos')).toBeInTheDocument();
    expect(screen.getByText(/0 de 3 predicciones \(0 %\)/)).toBeInTheDocument();
  });

  it('intercala los puestos de grupo tras la fase de grupos', () => {
    open('/search?team=Espa%C3%B1a&round=first');

    const rows = within(screen.getByRole('region', { name: 'España' })).getAllByRole('button');
    const labels = [
      'Pasa de grupos',
      '1º de grupo',
      '2º de grupo',
      'Pasa como 3º',
      'Pasa de dieciseisavos',
      'Pasa de octavos',
      'Pasa de cuartos',
      'Pasa de semifinales',
      'Campeón',
    ];
    expect(rows).toHaveLength(labels.length);
    labels.forEach((label, index) => expect(rows[index]).toHaveTextContent(label));
    expect(screen.getByRole('heading', { name: 'España · 1º de grupo' })).toBeInTheDocument();
    expect(screen.getByText(/2 de 3 predicciones \(67 %\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver el cuadro de Ana' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver el cuadro de Carla (Lo pone 2º)' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['stage=groups', 'España · Pasa de grupos'],
    ['stage=first', 'España · 1º de grupo'],
    ['stage=r16', 'España · Pasa de dieciseisavos'],
    ['stage=qf', 'España · Pasa de octavos'],
    ['stage=sf', 'España · Pasa de cuartos'],
    ['stage=final', 'España · Pasa de semifinales'],
    ['stage=champion', 'España · Campeón'],
    ['condition=passes_as_third', 'España · Pasa como 3º'],
    ['condition=reaches_r16', 'España · Pasa de dieciseisavos'],
    ['condition=is_champion', 'España · Campeón'],
    // Una ronda que no existe abre, como antes, la más lejana a la que alguien lo lleva.
    ['stage=otra', 'España · Campeón'],
  ])('los enlaces ya compartidos con %s abren la misma lista', (query, heading) => {
    open(`/search?group=7&team=Espa%C3%B1a&${query}`);

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('un enlace antiguo abre a los mismos participantes', () => {
    open('/search?team=Jap%C3%B3n&stage=final');

    expect(
      screen.getByRole('heading', { name: 'Japón · Pasa de semifinales' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 de 3 predicciones \(33 %\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver el cuadro de Carla' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ver el cuadro de Ana (Cae en octavos)' }),
    ).toBeInTheDocument();
  });

  it('en solo eliminatorias las rondas empiezan en dieciseisavos y no hay puestos de grupo', () => {
    league({ knockoutsOnly: true });
    open('/search?team=Espa%C3%B1a&stage=r16');

    expect(
      screen.getByRole('heading', { name: 'España · Pasa de dieciseisavos' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /1º de grupo/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Pasa de grupos/ })).toBeNull();
    // Solo los equipos del cuadro: Italia, Perú, Brasil y México no jugaron los dieciseisavos.
    expect(
      within(screen.getByRole('group', { name: 'Grupo A' }))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Chile', 'España']);
  });
});
