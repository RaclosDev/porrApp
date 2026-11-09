import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RaceDriver } from '../../types/api';
import {
  RACE_SLOT_LABEL,
  SLOT_SHORT,
  driverRaces,
  driverSeason,
  pickedDrivers,
  seasonFavourites,
  seasonPredictions,
  slotDrivers,
  type DriverFilter,
  type DriverRace,
  type RaceEntry,
} from '../../utils/grandPrixStats';
import { UserAvatar } from '../Avatar';
import WhatsAppIcon from '../WhatsAppIcon';
import { driverShortName } from '../grandPrix/grandPrix';
import { TeamStripe } from './DriverTag';
import { InsightsNotice } from './InsightCard';
import PickFunnel, { type FunnelRow } from './PickFunnel';
import { RealMark } from './PickRow';
import SubjectPicker, { type PickerOption } from './SubjectPicker';

type Drivers = Map<number, RaceDriver>;

/** Filtros del buscador, en el orden en que se muestran; los puestos del podio van sangrados. */
const FILTERS: DriverFilter[] = ['any', 'podium', 'first', 'second', 'third', 'pole', 'fastestLap'];
const PODIUM_PLACES: DriverFilter[] = ['first', 'second', 'third'];

const SHORTCUTS = 6;

const hitsNote = (hits: number) => (hits === 1 ? '1 acierto' : `${hits} aciertos`);

/** Lo que hizo de verdad el piloto en el Gran Premio, en una frase; null si aún no se sabe. */
function realText(race: DriverRace, driverId: number): string | null {
  if (race.real.length > 0)
    return `Resultado: ${race.real.map((slot) => SLOT_SHORT[slot]).join(' · ')}`;
  const podium = slotDrivers(race.gp.result, 'podium');
  return podium.length === 3 && !podium.includes(driverId) ? 'Resultado: fuera del podio' : null;
}

interface GrandPrixSearchProps {
  races: RaceEntry[];
  drivers: Drivers;
  leagueName: string;
  groupId: string | null;
}

/**
 * Buscador de una liga de Fórmula 1: elige un piloto y mira cuántas veces lo ha puesto la liga en
 * cada puesto a lo largo de la temporada, y quién lo puso en cada Gran Premio.
 */
export default function GrandPrixSearch({
  races,
  drivers,
  leagueName,
  groupId,
}: GrandPrixSearchProps) {
  const [params, setParams] = useSearchParams();

  // Solo los pilotos que alguien ha puesto, por escudería.
  const groups = useMemo(() => {
    const byTeam = new Map<string, PickerOption[]>();
    for (const id of pickedDrivers(races)) {
      const driver = drivers.get(id);
      if (!driver) continue;
      const team = driver.team ?? 'Sin escudería';
      byTeam.set(team, [
        ...(byTeam.get(team) ?? []),
        { value: String(id), label: driverShortName(driver) },
      ]);
    }
    return [...byTeam]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([label, options]) => ({
        label,
        options: options.sort((a, b) => a.label.localeCompare(b.label, 'es')),
      }));
  }, [races, drivers]);
  const known = useMemo(
    () => new Set(groups.flatMap((group) => group.options.map((o) => o.value))),
    [groups],
  );
  const shortcuts = useMemo(
    () =>
      seasonFavourites(races, SHORTCUTS)
        .filter((id) => known.has(String(id)))
        .map((id) => ({ value: String(id), label: driverShortName(drivers.get(id)) })),
    [races, known, drivers],
  );

  const requested = params.get('driver') ?? '';
  const selected = known.has(requested) ? requested : '';
  const driverId = Number(selected);
  const driver = selected ? drivers.get(driverId) : undefined;
  const requestedFilter = params.get('slot') as DriverFilter | null;
  const filter: DriverFilter =
    requestedFilter && FILTERS.includes(requestedFilter) ? requestedFilter : 'any';

  const total = seasonPredictions(races);
  const rows: FunnelRow<DriverFilter>[] = useMemo(
    () =>
      selected
        ? driverSeason(races, driverId, FILTERS).map((row) => ({
            id: row.filter,
            label: RACE_SLOT_LABEL[row.filter],
            sub: PODIUM_PLACES.includes(row.filter),
            count: row.count,
            percent: row.percent,
            note: row.hits > 0 ? hitsNote(row.hits) : undefined,
          }))
        : [],
    [races, selected, driverId],
  );
  const list = useMemo(
    () => (selected ? driverRaces(races, driverId, filter) : []),
    [races, selected, driverId, filter],
  );
  const row = rows.find((r) => r.id === filter);

  const update = (next: { driver?: string; slot?: DriverFilter }) => {
    const nextDriver = next.driver ?? selected;
    const query = new URLSearchParams();
    if (groupId) query.set('group', groupId);
    if (nextDriver) query.set('driver', nextDriver);
    if (next.slot && nextDriver) query.set('slot', next.slot);
    setParams(query, { replace: true });
  };

  const share = () => {
    const url = `${window.location.origin}/search?group=${encodeURIComponent(groupId ?? '')}&driver=${selected}&slot=${filter}`;
    const text = `${driverShortName(driver)} · ${RACE_SLOT_LABEL[filter]}: ${row?.count ?? 0} de ${total} predicciones de "${leagueName}". ¿Quién es quién?\n\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  return (
    <div className="mx-auto flex max-w-245 flex-col gap-4">
      <SubjectPicker
        value={selected}
        onChange={(value) => update({ driver: value })}
        groups={groups}
        shortcuts={shortcuts}
        icon={(value) => <TeamStripe driver={drivers.get(Number(value))} />}
        placeholder="Elige un piloto"
      />

      {!selected ? (
        <InsightsNotice title="Elige un piloto">
          Verás cuántas veces lo ha puesto la liga de ganador, en el podio, en la pole o con la
          vuelta rápida, y quién fue en cada Gran Premio.
        </InsightsNotice>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <section
            aria-labelledby="search-driver-title"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <TeamStripe driver={driver} />
              <h3 id="search-driver-title" className="m-0 min-w-0 flex-1 truncate text-[1.2rem]">
                {driver?.name ?? driverShortName(driver)}
              </h3>
              {driver?.team && (
                <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[0.78rem] font-semibold text-muted">
                  {driver.team}
                </span>
              )}
            </div>
            <PickFunnel
              rows={rows}
              total={total}
              selected={filter}
              onSelect={(slot) => update({ slot })}
            />
          </section>

          <section
            aria-labelledby="search-pickers-title"
            aria-live="polite"
            className="min-w-0 rounded-[14px] border border-line bg-panel p-3.5 sm:p-4.5"
          >
            <h3 id="search-pickers-title" className="m-0 text-[1.05rem]">
              {driverShortName(driver)} · {RACE_SLOT_LABEL[filter]}
            </h3>
            <p className="mt-1 mb-3 text-[0.88rem] text-muted">
              {row?.count ?? 0} de {total} predicciones de la temporada ({row?.percent ?? 0} %).
            </p>
            {list.length === 0 ? (
              <p className="m-0 text-[0.9rem] text-muted">Nadie.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {list.map((race) => (
                  <RacePickers key={race.gp.id} race={race} driverId={driverId} />
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={share}
              className="glass-btn primary-btn mt-4 inline-flex w-full items-center justify-center gap-2"
            >
              <WhatsAppIcon size={18} /> Compartir búsqueda
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

/** Quién puso al piloto en un Gran Premio, en qué puestos y qué pasó de verdad. */
function RacePickers({ race, driverId }: { race: DriverRace; driverId: number }) {
  const real = realText(race, driverId);
  return (
    <li>
      <div className="mb-1.5 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="m-0 text-[0.92rem] font-bold text-main">{race.gp.name}</h4>
          <p className="m-0 text-[0.78rem] text-muted">
            {race.pickers.length} de {race.total}
            {real && ` · ${real}`}
          </p>
        </div>
        <RealMark status={race.status} yes="Se cumplió" no="No se cumplió" />
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-1.5 p-0 min-[420px]:grid-cols-2">
        {race.pickers.map(({ member, slots, hits }) => (
          <li
            key={`${member.userId}-${member.name}`}
            className="flex min-h-11 items-center gap-2.5 rounded-[10px] border border-line px-2.5 py-1.5"
          >
            <UserAvatar
              url={member.avatarUrl}
              userId={member.userId}
              name={member.name}
              size={28}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-main">
                {member.name}
                {member.mine ? ' (tú)' : ''}
              </span>
              <span className="block truncate text-[0.78rem] text-muted">
                {slots.map((slot, index) => (
                  <span key={slot}>
                    {index > 0 && ' · '}
                    <span className={hits.includes(slot) ? 'font-bold text-[var(--hit)]' : ''}>
                      {SLOT_SHORT[slot]}
                      {hits.includes(slot) && <span className="sr-only"> (acierto)</span>}
                    </span>
                  </span>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </li>
  );
}
