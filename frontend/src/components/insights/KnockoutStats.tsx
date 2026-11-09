import { useMemo, useState } from 'react';
import Flag from '../Flag';
import {
  rankRound,
  roundAccuracy,
  roundSurprises,
  teamSituation,
  teamStatus,
  visibleRounds,
  type KnockoutEntry,
  type KnockoutField,
} from '../../utils/knockoutStats';
import PickRow from './PickRow';
import { ChoiceChips, ExpandableList, InsightCard } from './InsightCard';

export type TeamLogos = Record<string, string | null | undefined>;

/** Escudo o bandera de tamaño fijo para las filas. */
export const KnockoutTeamIcon = ({ team, logos }: { team: string; logos: TeamLogos }) => (
  <Flag team={team} logo={logos[team]} size="w80" />
);

/** Ruta del buscador con el equipo y la ronda ya elegidos. */
const searchLink = (team: string, round: number) =>
  `/search?team=${encodeURIComponent(team)}&round=${round}`;

/** "A, B y C". */
const joinNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];

const formatAverage = (n: number) =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

interface KnockoutStatsProps {
  entries: KnockoutEntry[];
  field: KnockoutField;
  logos: TeamLogos;
}

/**
 * Más elegidos de unas eliminatorias o de un cuadro propio: los equipos que más predicciones hacen
 * pasar cada ronda y el campeón, comparados con el cuadro real.
 */
export default function KnockoutStats({ entries, field, logos }: KnockoutStatsProps) {
  const rounds = useMemo(() => visibleRounds(entries, field), [entries, field]);
  const championRound = rounds.find((index) => field.rounds[index].final);
  // La final va en su propia tarjeta, la del campeón.
  const options = rounds.filter((index) => index !== championRound);

  return (
    <div
      className={`grid grid-cols-1 items-start gap-4 ${options.length > 0 && championRound !== undefined ? 'lg:grid-cols-2' : 'mx-auto max-w-160'}`}
    >
      {options.length > 0 && (
        <RoundPicks entries={entries} field={field} logos={logos} options={options} />
      )}
      {championRound !== undefined && (
        <ChampionPicks entries={entries} field={field} logos={logos} round={championRound} />
      )}
    </div>
  );
}

/** Equipos más elegidos para pasar cada ronda, con los aciertos medios y las sorpresas. */
function RoundPicks({
  entries,
  field,
  logos,
  options,
}: KnockoutStatsProps & { options: number[] }) {
  const [chosen, setChosen] = useState<number | null>(null);
  // Sin ronda elegida, la más avanzada que ya se ve.
  const round = chosen !== null && options.includes(chosen) ? chosen : options[options.length - 1];
  const { picks, total } = useMemo(() => rankRound(entries, field, round), [entries, field, round]);
  const accuracy = roundAccuracy(entries, field, round);
  const surprises = roundSurprises(entries, field, round);

  return (
    <InsightCard
      title="Más elegidos por ronda"
      subtitle="Cuántas predicciones hacen pasar a cada equipo la ronda."
      footer={
        accuracy || surprises.length > 0 ? (
          <>
            {accuracy && (
              <p className="m-0">
                De media, cada predicción acertó{' '}
                <strong className="text-main">
                  {formatAverage(accuracy.average)} de {accuracy.size}
                </strong>{' '}
                {accuracy.size === 1 ? 'cruce decidido' : 'cruces decididos'}.
              </p>
            )}
            {surprises.length > 0 && (
              <p className="mt-1 mb-0">
                {surprises.length === 1
                  ? 'Pasó sin que nadie lo pusiera'
                  : 'Pasaron sin que nadie los pusiera'}
                : <strong className="text-main">{joinNames(surprises)}</strong>.
              </p>
            )}
          </>
        ) : undefined
      }
    >
      {options.length > 1 && (
        <ChoiceChips
          label="Ronda"
          options={options.map((index) => ({
            value: String(index),
            label: field.rounds[index].title,
          }))}
          value={String(round)}
          onChange={(value) => setChosen(Number(value))}
        />
      )}
      <p className="mt-0 mb-2 text-[0.85rem] text-muted">
        {field.rounds[round].title} · {total} {total === 1 ? 'predicción' : 'predicciones'}
      </p>
      <ExpandableList
        key={round}
        items={picks}
        initial={8}
        noun="equipos"
        render={(pick) => {
          const status = teamStatus(field, pick.team, round);
          return (
            <PickRow
              key={pick.team}
              icon={<KnockoutTeamIcon team={pick.team} logos={logos} />}
              label={pick.team}
              count={pick.count}
              total={pick.total}
              percent={pick.percent}
              status={status}
              statusText={{ yes: 'Pasó', no: 'No pasó' }}
              highlight={status === 'yes'}
              to={searchLink(pick.team, round)}
            />
          );
        }}
      />
    </InsightCard>
  );
}

/** A quién pone campeón la liga y, si ya se sabe, quién lo fue. */
function ChampionPicks({ entries, field, logos, round }: KnockoutStatsProps & { round: number }) {
  const { picks } = useMemo(() => rankRound(entries, field, round), [entries, field, round]);
  const real = picks.find((pick) => teamStatus(field, pick.team, round) === 'yes')?.team;
  const champion = real ?? [...field.rounds[round].winners][0] ?? null;

  return (
    <InsightCard
      title="Campeón más elegido"
      subtitle={
        champion
          ? `Campeón: ${champion}. ${real ? `Lo acertó el ${picks.find((pick) => pick.team === real)?.percent ?? 0} % de la liga.` : 'Nadie de la liga lo acertó.'}`
          : 'Toca un equipo para ver quién lo pone campeón.'
      }
    >
      <ExpandableList
        items={picks}
        initial={6}
        noun="equipos"
        render={(pick) => {
          const status = teamStatus(field, pick.team, round);
          const out = field.eliminatedAt.has(pick.team);
          return (
            <PickRow
              key={pick.team}
              icon={<KnockoutTeamIcon team={pick.team} logos={logos} />}
              label={pick.team}
              count={pick.count}
              total={pick.total}
              percent={pick.percent}
              status={status}
              statusText={{ yes: 'Campeón', no: 'No fue campeón' }}
              note={out ? (teamSituation(field, pick.team) ?? undefined) : undefined}
              highlight={status === 'yes'}
              to={searchLink(pick.team, round)}
            />
          );
        }}
      />
    </InsightCard>
  );
}
