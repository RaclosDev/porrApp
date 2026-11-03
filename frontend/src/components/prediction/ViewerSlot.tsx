import type { CSSProperties } from 'react';
import { TeamSlot } from '../BracketCanvas';
import type { SlotDetails } from '../../utils/viewerScoring';

interface ViewerSlotProps {
  name: string | null | undefined;
  details: SlotDetails;
  featured: { isFeatured: boolean; isLive: boolean };
}

/**
 * Hueco de un equipo en el cuadro del visor: verde si el pronóstico lo hace pasar, con los
 * puntos obtenidos y un borde si juega el próximo partido (rojo si ya está en juego).
 */
export default function ViewerSlot({ name, details, featured }: ViewerSlotProps) {
  const { isWinner, slotPoints } = details;
  let style: CSSProperties = isWinner
    ? { borderLeft: '3px solid var(--hit)', background: 'rgba(46, 204, 113, 0.1)' }
    : {};
  if (featured.isFeatured) {
    style = {
      ...style,
      border: featured.isLive ? '2px solid var(--miss)' : '2px solid var(--accent-cyan)',
    };
  }
  const rightContent =
    slotPoints !== null ? (
      <span
        className={`ml-1 text-[0.85em] font-bold py-0.5 px-1 rounded-[4px] ${slotPoints === '0' ? 'text-[var(--miss)]' : 'text-[var(--hit)]'} ${slotPoints === '0' ? 'bg-[rgba(231,76,60,0.1)] bg-none' : 'bg-[rgba(46,204,113,0.1)] bg-none'}`}
      >
        {slotPoints}
      </span>
    ) : null;

  return <TeamSlot name={name} slotStyle={style} rightContent={rightContent} />;
}
