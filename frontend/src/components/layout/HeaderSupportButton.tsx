import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import SupportDialog from '../SupportDialog';
import { useAppContext } from '../../context/AppContext';
import { fetchPokerHistory } from '../../services/endpoints/poker';
import { queryKeys } from '../../services/queryKeys';
import { crupierHeadMarkup } from '../poker/crupier/crupierArt';

const svgProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

/** Caña con espuma: «invítanos a una caña». */
export function BeerIcon({ size = 20 }: { size?: number }) {
  return (
    <svg {...svgProps} width={size} height={size}>
      <path d="M6 8h9v11a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 6 19z" />
      <path d="M15 10.5h1.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H15" />
      <path d="M6 8a2 2 0 0 1 1.5-3.3A2.5 2.5 0 0 1 12 4a2.2 2.2 0 0 1 3 1.8A1.6 1.6 0 0 1 15 8" />
      <path d="M9 12v5M12 12v5" />
    </svg>
  );
}

/** La cabeza del crupier, el mismo que recoge la propina en el diálogo. */
const CRUPIER_HEAD = crupierHeadMarkup();

function CrupierFaceIcon() {
  return (
    <span className="header-crupier-face" dangerouslySetInnerHTML={{ __html: CRUPIER_HEAD }} />
  );
}

/**
 * Botón de apoyo de la barra. En una liga de póker abre la propina del crupier con lo que
 * sobró del último torneo; en el resto, el diálogo de apoyo de siempre.
 */
export default function HeaderSupportButton() {
  const [open, setOpen] = useState(false);
  const { leagueKind, activeGroupId } = useAppContext();
  const pokerId = leagueKind === 'poker' && activeGroupId ? activeGroupId : null;
  const history = useQuery({
    queryKey: queryKeys.pokerHistory(pokerId ?? ''),
    queryFn: () => fetchPokerHistory(pokerId ?? ''),
    enabled: open && pokerId !== null,
  });
  const label = pokerId ? 'Propina para el crupier' : 'Invítanos a una caña';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // La escena del crupier vive en los estilos del póker, que fuera de sus páginas aún no se han cargado.
          if (pokerId) void import('../../styles/poker.css');
          setOpen(true);
        }}
        title={label}
        aria-label={label}
        className="glass-btn header-icon-btn header-theme-btn"
      >
        {pokerId ? <CrupierFaceIcon /> : <BeerIcon />}
      </button>
      {pokerId ? (
        <SupportDialog
          variant="tip"
          open={open}
          onClose={() => setOpen(false)}
          leftoverCents={history.data?.[0]?.leftoverCents}
        />
      ) : (
        <SupportDialog open={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
