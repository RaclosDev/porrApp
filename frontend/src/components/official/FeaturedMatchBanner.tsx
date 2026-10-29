import type { Match } from '../../types/api';
interface FeaturedMatchBannerProps {
  featuredMatch: Match;
}

/** Aviso del próximo partido de eliminatorias. */
export default function FeaturedMatchBanner({ featuredMatch }: FeaturedMatchBannerProps) {
  return (
    <div className="mt-0 mb-3 mx-auto py-2 px-4.5 bg-[rgba(0,_210,_211,_0.12)] border border-[rgba(0,_210,_211,_0.5)] rounded-[12px] flex items-center justify-center gap-2.5 flex-wrap max-w-145 shadow-[0_4px_12px_rgba(0,0,0,0.3)] [animation:featured-match-pulse_2s_infinite]">
      <span className="text-[0.75rem] bg-[#00d2d3] text-black font-black py-0.5 px-2 rounded-[12px]">
        🔜 PRÓXIMO PARTIDO EN EL BRACKET
      </span>
      <span className="text-white font-bold text-[0.9rem]">
        {featuredMatch.home || 'Por definir'} vs {featuredMatch.away || 'Por definir'}
      </span>
      {featuredMatch.date && (
        <span className="text-muted text-[0.8rem]">
          🕒{' '}
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
