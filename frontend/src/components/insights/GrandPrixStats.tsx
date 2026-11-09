import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RaceDriver } from '../../types/api';
import {
  podiumAccuracy,
  rankDrivers,
  slotDrivers,
  slotStatus,
  type RaceEntry,
  type RaceSlot,
} from '../../utils/grandPrixStats';
import { driverShortName } from '../grandPrix/grandPrix';
import { DriverName, TeamStripe } from './DriverTag';
import { ExpandableList, InsightCard, InsightsNotice } from './InsightCard';
import PickRow from './PickRow';
import StepSelect from './StepSelect';

type Drivers = Map<number, RaceDriver>;

interface SlotCopy {
  title: string;
  /** Delante del resultado real: «Ganó», «Pole de»… */
  real: string;
  /** Sin predicciones para el hueco. */
  empty: string;
  yes: string;
  no: string;
}

const CARDS: { slot: RaceSlot; copy: SlotCopy }[] = [
  {
    slot: 'first',
    copy: {
      title: 'Ganador más elegido',
      real: 'Ganó',
      empty: 'Nadie eligió ganador.',
      yes: 'Ganó',
      no: 'No ganó',
    },
  },
  {
    slot: 'podium',
    copy: {
      title: 'Más elegidos para el podio',
      real: 'Podio:',
      empty: 'Nadie eligió podio.',
      yes: 'Acabó en el podio',
      no: 'Fuera del podio',
    },
  },
  {
    slot: 'pole',
    copy: {
      title: 'Pole más elegida',
      real: 'Pole de',
      empty: 'Nadie eligió la pole.',
      yes: 'Hizo la pole',
      no: 'No hizo la pole',
    },
  },
  {
    slot: 'fastestLap',
    copy: {
      title: 'Vuelta rápida más elegida',
      real: 'Vuelta rápida de',
      empty: 'Nadie eligió la vuelta rápida.',
      yes: 'Hizo la vuelta rápida',
      no: 'No hizo la vuelta rápida',
    },
  },
];

/** "A, B y C". */
const joinNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];

const formatAverage = (n: number) =>
  n.toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** Ruta del buscador con el piloto y el puesto ya elegidos. */
const searchLink = (driverId: number, slot: RaceSlot) => `/search?driver=${driverId}&slot=${slot}`;

/**
 * Más elegidos de una liga de Fórmula 1: Gran Premio a Gran Premio, a quién ha puesto la liga de
 * ganador, en el podio, en la pole y con la vuelta rápida, frente a lo que pasó.
 */
export default function GrandPrixStats({
  races,
  drivers,
}: {
  races: RaceEntry[];
  drivers: Drivers;
}) {
  const [params, setParams] = useSearchParams();
  // Sin Gran Premio pedido, el último cerrado.
  const race = races.find((r) => String(r.gp.id) === params.get('gp')) ?? races[races.length - 1];
  const total = race.picks.length;

  return (
    <div className="flex flex-col gap-4">
      <StepSelect
        label="Gran Premio"
        options={races.map((r) => ({ value: String(r.gp.id), label: r.gp.name }))}
        value={String(race.gp.id)}
        onChange={(gp) => setParams({ gp }, { replace: true })}
      />
      <p className="m-0 text-center text-[0.85rem] text-muted">
        {total} {total === 1 ? 'predicción' : 'predicciones'}. Solo salen los Grandes Premios ya
        cerrados: antes, las predicciones de los demás están ocultas.
      </p>
      {total === 0 ? (
        <InsightsNotice title="Nadie hizo predicción en este Gran Premio" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {CARDS.map(({ slot, copy }) => (
            <SlotCard key={slot} race={race} slot={slot} copy={copy} drivers={drivers} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Pilotos más elegidos para un hueco del Gran Premio, con lo que pasó de verdad. */
function SlotCard({
  race,
  slot,
  copy,
  drivers,
}: {
  race: RaceEntry;
  slot: RaceSlot;
  copy: SlotCopy;
  drivers: Drivers;
}) {
  const total = race.picks.length;
  const picks = useMemo(
    () => rankDrivers(race.picks, slot, (id) => driverShortName(drivers.get(id))),
    [race, slot, drivers],
  );
  const real = slotDrivers(race.gp.result, slot);
  // El podio solo se da por sabido con sus tres pilotos.
  const known = slot === 'podium' ? real.length === 3 : real.length === 1;
  const realNames = joinNames(real.map((id) => driverShortName(drivers.get(id))));
  const accuracy = slot === 'podium' ? podiumAccuracy(race) : null;

  const hit = picks.find((p) => p.driverId === real[0])?.percent ?? 0;
  const subtitle = !known
    ? 'Aún sin resultado. Toca un piloto para ver quién lo pone.'
    : slot === 'podium'
      ? `${copy.real} ${realNames}.`
      : `${copy.real} ${realNames}. ${hit > 0 ? `Lo acertó el ${hit} % de la liga.` : 'Nadie de la liga lo acertó.'}`;

  return (
    <InsightCard
      title={copy.title}
      subtitle={subtitle}
      footer={
        accuracy != null ? (
          <p className="m-0">
            De media, cada predicción acertó{' '}
            <strong className="text-main">{formatAverage(accuracy)} de 3</strong> pilotos del podio.
          </p>
        ) : undefined
      }
    >
      {picks.length === 0 ? (
        <p className="m-0 text-muted">{copy.empty}</p>
      ) : (
        <ExpandableList
          key={race.gp.id}
          items={picks}
          initial={slot === 'podium' ? 6 : 5}
          noun="pilotos"
          render={(pick) => {
            const driver = drivers.get(pick.driverId);
            const status = slotStatus(race.gp.result, slot, pick.driverId);
            return (
              <PickRow
                key={pick.driverId}
                icon={<TeamStripe driver={driver} />}
                label={<DriverName driver={driver} />}
                count={pick.count}
                total={total}
                percent={pick.percent}
                status={status}
                statusText={{ yes: copy.yes, no: copy.no }}
                highlight={status === 'yes'}
                to={searchLink(pick.driverId, slot)}
              />
            );
          }}
        />
      )}
    </InsightCard>
  );
}
