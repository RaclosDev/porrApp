import type { RaceDriver } from '../../types/api';
import { driverShortName } from '../grandPrix/grandPrix';

/** Franja con el color de la escudería, delante del nombre del piloto. */
export function TeamStripe({ driver }: { driver: RaceDriver | undefined }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-1.5 shrink-0 rounded-full bg-[rgba(100,116,139,0.4)]"
      style={driver?.teamColor ? { background: `#${driver.teamColor}` } : undefined}
    />
  );
}

/** «L. Norris» con su escudería en pequeño. */
export function DriverName({ driver }: { driver: RaceDriver | undefined }) {
  return (
    <>
      {driverShortName(driver)}
      {driver?.team && (
        <span className="ml-1.5 text-[0.8rem] font-normal text-muted">{driver.team}</span>
      )}
    </>
  );
}
