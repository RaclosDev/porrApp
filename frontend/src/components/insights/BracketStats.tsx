import { useMemo, useState } from 'react';
import {
  STAGE_SHORT,
  groupWinnerPicks,
  isRealScorer,
  rankFinals,
  rankPicks,
  rankScorers,
  reachLabel,
  stageAccuracy,
  type BracketEntry,
  type OfficialState,
  type PathStage,
  type StageId,
} from '../../utils/bracketStats';
import PickRow from './PickRow';
import { ChoiceChips, ExpandableList, InsightCard, TeamFlag } from './InsightCard';

/** Ruta del buscador con el equipo y la ronda ya elegidos. */
export const searchLink = (team: string, stage: StageId) =>
  `/search?team=${encodeURIComponent(team)}&stage=${stage}`;

/** "A, B y C". */
const joinNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];

const formatAverage = (n: number) =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

interface BracketStatsProps {
  entries: BracketEntry[];
  official: OfficialState;
  knockoutsOnly: boolean;
  pichichi: boolean;
}

/** Más elegidos de una liga de cuadro: campeón, equipos por ronda, final, pichichi y grupos. */
export default function BracketStats({
  entries,
  official,
  knockoutsOnly,
  pichichi,
}: BracketStatsProps) {
  const total = entries.length;
  const champions = useMemo(() => rankPicks(entries, 'champion'), [entries]);
  const finals = useMemo(() => rankFinals(entries), [entries]);
  const scorers = useMemo(() => rankScorers(entries), [entries]);
  const groupWinners = useMemo(
    () => (knockoutsOnly ? [] : groupWinnerPicks(entries, official)),
    [entries, official, knockoutsOnly],
  );

  const realFinal = official.teamsAt('final');
  const realChampion = official.teamsAt('champion')[0] ?? null;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <InsightCard
        title="Campeón más elegido"
        icon="🏆"
        subtitle={
          realChampion
            ? `Campeón: ${realChampion}. Lo acertó el ${champions.find((c) => c.team === realChampion)?.percent ?? 0} % de la liga.`
            : 'Toca un equipo para ver quién lo pone campeón.'
        }
      >
        <ExpandableList
          items={champions}
          initial={6}
          noun="equipos"
          render={(pick) => {
            const reach = official.reach(pick.team);
            return (
              <PickRow
                key={pick.team}
                icon={<TeamFlag team={pick.team} />}
                label={pick.team}
                count={pick.count}
                total={total}
                percent={pick.percent}
                status={official.status(pick.team, 'champion')}
                statusText={{ yes: 'Campeón', no: 'No fue campeón' }}
                note={reach.out ? reachLabel(reach.stage, 'real') : undefined}
                highlight={pick.team === realChampion}
                to={searchLink(pick.team, 'champion')}
              />
            );
          }}
        />
      </InsightCard>

      <RoundPicks entries={entries} official={official} knockoutsOnly={knockoutsOnly} />

      <InsightCard
        title="Finales más repetidas"
        icon="⚔️"
        subtitle={
          realFinal.length === 2 ? `Final real: ${realFinal[0]} - ${realFinal[1]}.` : undefined
        }
      >
        {finals.length === 0 ? (
          <p className="m-0 text-muted">Nadie ha completado la final.</p>
        ) : (
          <ExpandableList
            items={finals}
            initial={5}
            noun="finales"
            render={(f) => {
              const isReal = realFinal.length === 2 && f.teams.every((t) => realFinal.includes(t));
              return (
                <PickRow
                  key={f.teams.join('|')}
                  label={
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <TeamFlag team={f.teams[0]} />
                      <span className="truncate">{f.teams[0]}</span>
                      <span className="text-muted">-</span>
                      <span className="truncate">{f.teams[1]}</span>
                      <TeamFlag team={f.teams[1]} />
                    </span>
                  }
                  count={f.count}
                  total={total}
                  percent={f.percent}
                  status={realFinal.length === 2 ? (isReal ? 'yes' : 'no') : 'pending'}
                  statusText={{ yes: 'Fue la final', no: 'No fue la final' }}
                  highlight={isReal}
                />
              );
            }}
          />
        )}
      </InsightCard>

      {pichichi && scorers.length > 0 && (
        <InsightCard
          title="Pichichi más elegido"
          icon="👟"
          subtitle={
            official.scorers.length > 0
              ? `${official.finished ? 'Pichichi' : 'Va líder'}: ${official.scorers.join(', ')}.`
              : undefined
          }
        >
          <ExpandableList
            items={scorers}
            initial={6}
            noun="jugadores"
            render={(s) => {
              const hit = isRealScorer(s.name, official.scorers);
              return (
                <PickRow
                  key={s.name}
                  label={s.name}
                  count={s.count}
                  total={total}
                  percent={s.percent}
                  status={official.finished ? (hit ? 'yes' : 'no') : 'pending'}
                  statusText={{ yes: 'Fue el pichichi', no: 'No fue el pichichi' }}
                  highlight={official.finished && hit}
                />
              );
            }}
          />
        </InsightCard>
      )}

      {groupWinners.length > 0 && (
        <InsightCard
          title="Primero de grupo más elegido"
          icon="👑"
          subtitle="El favorito de la liga en cada grupo y, si el grupo ha terminado, el primero real."
          className="lg:col-span-2"
        >
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {groupWinners.map(({ group, top, real }) =>
              top ? (
                <PickRow
                  key={group}
                  icon={<TeamFlag team={top.team} />}
                  label={
                    <>
                      <span className="text-muted">{group} · </span>
                      {top.team}
                    </>
                  }
                  count={top.count}
                  total={total}
                  percent={top.percent}
                  status={real ? (real === top.team ? 'yes' : 'no') : 'pending'}
                  statusText={{ yes: 'Fue primero', no: 'No fue primero' }}
                  note={real && real !== top.team ? `1º: ${real}` : undefined}
                  highlight={real === top.team}
                  to={searchLink(top.team, 'first')}
                />
              ) : null,
            )}
          </ul>
        </InsightCard>
      )}
    </div>
  );
}

const ROUND_OPTIONS: PathStage[] = ['groups', 'r16', 'qf', 'sf', 'final'];

/** Equipos más elegidos en cada ronda, con los aciertos medios y las sorpresas. */
function RoundPicks({
  entries,
  official,
  knockoutsOnly,
}: {
  entries: BracketEntry[];
  official: OfficialState;
  knockoutsOnly: boolean;
}) {
  const options = knockoutsOnly ? ROUND_OPTIONS.filter((s) => s !== 'groups') : ROUND_OPTIONS;
  const [stage, setStage] = useState<PathStage>(options[0]);
  const picks = useMemo(() => rankPicks(entries, stage), [entries, stage]);
  const accuracy = stageAccuracy(entries, stage, official);
  const picked = new Set(picks.map((p) => p.team));
  const surprises = official.teamsAt(stage).filter((t) => !picked.has(t));

  return (
    <InsightCard
      title="Equipos más elegidos por ronda"
      icon="📊"
      subtitle="Cuántos cuadros meten a cada equipo en la ronda."
      footer={
        accuracy || surprises.length > 0 ? (
          <>
            {accuracy && (
              <p className="m-0">
                De media, cada cuadro acertó{' '}
                <strong className="text-main">
                  {formatAverage(accuracy.average)} de {accuracy.size}
                </strong>{' '}
                equipos.
              </p>
            )}
            {surprises.length > 0 && (
              <p className="mt-1 mb-0">
                {surprises.length === 1
                  ? 'Llegó sin que nadie lo pusiera'
                  : 'Llegaron sin que nadie los pusiera'}
                : <strong className="text-main">{joinNames(surprises)}</strong>.
              </p>
            )}
          </>
        ) : undefined
      }
    >
      <ChoiceChips
        label="Ronda"
        options={options.map((s) => ({ value: s, label: STAGE_SHORT[s] }))}
        value={stage}
        onChange={setStage}
      />
      <ExpandableList
        key={stage}
        items={picks}
        initial={8}
        noun="equipos"
        render={(pick) => (
          <PickRow
            key={pick.team}
            icon={<TeamFlag team={pick.team} />}
            label={pick.team}
            count={pick.count}
            total={entries.length}
            percent={pick.percent}
            status={official.status(pick.team, stage)}
            statusText={{ yes: 'Llegó', no: 'No llegó' }}
            to={searchLink(pick.team, stage)}
          />
        )}
      />
    </InsightCard>
  );
}
