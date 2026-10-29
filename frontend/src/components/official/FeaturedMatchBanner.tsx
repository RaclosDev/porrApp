import type { Match } from '../../types/api';
interface FeaturedMatchBannerProps {
  featuredMatch: Match;
}

/** Aviso del próximo partido de eliminatorias. */
export default function FeaturedMatchBanner({ featuredMatch }: FeaturedMatchBannerProps) {
  return (
    <div
      style={{
        margin: '0 auto 12px auto',
        padding: '8px 18px',
        background: 'rgba(0, 210, 211, 0.12)',
        border: '1px solid rgba(0, 210, 211, 0.5)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        flexWrap: 'wrap',
        maxWidth: '580px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        animation: 'featured-match-pulse 2s infinite',
      }}
    >
      <span
        style={{
          fontSize: '0.75rem',
          background: '#00d2d3',
          color: '#000',
          fontWeight: '900',
          padding: '2px 8px',
          borderRadius: '12px',
        }}
      >
        🔜 PRÓXIMO PARTIDO EN EL BRACKET
      </span>
      <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>
        {featuredMatch.home || 'Por definir'} vs {featuredMatch.away || 'Por definir'}
      </span>
      {featuredMatch.date && (
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
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
