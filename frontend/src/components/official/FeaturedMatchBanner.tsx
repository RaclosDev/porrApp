import type { Match } from '../../types/api';
interface FeaturedMatchBannerProps {
  featuredMatch: Match;
}

/** Aviso del próximo partido de eliminatorias. */
export default function FeaturedMatchBanner({ featuredMatch }: FeaturedMatchBannerProps) {
  return (
    <div className="paper-panel mt-0 mb-3 mx-auto py-2 px-4.5 border border-[var(--ink)] rounded-[4px] flex items-center justify-center gap-2.5 flex-wrap max-w-145 ">
      <span className="text-[0.75rem] bg-[var(--ink)] text-[var(--paper)] font-black py-0.5 px-2 rounded-[4px]">
        Próximo partido del cuadro
      </span>
      <span className="text-main font-bold text-[0.9rem]">
        {featuredMatch.home || 'Por definir'} vs {featuredMatch.away || 'Por definir'}
      </span>
      {featuredMatch.date && (
        <span className="text-muted text-[0.8rem]">
          {new Date(featuredMatch.date).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      )}
    </div>
  );
}
