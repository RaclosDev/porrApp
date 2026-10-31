import React, { useState, useEffect } from 'react';
import { getCountryCode, getCountryEmoji, normalizeCountryName } from '../utils/constants';

interface FlagProps {
  team: string | null | undefined;
  logo?: string | null;
  size?: string;
  style?: React.CSSProperties;
  className?: string;
}

/** Bandera o escudo de un equipo; sin logo usa la bandera por código o un emoji. */
const Flag = ({ team, logo, size = 'w40', style = {}, className = '' }: FlagProps) => {
  const [hasError, setHasError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setLogoError(false);
  }, [team, logo]);

  if (!team && !logo) return null;
  const cleanTeam = normalizeCountryName(team || '');

  if (logo && !logoError) {
    return (
      <img
        src={logo}
        alt={cleanTeam || 'Escudo'}
        width={20}
        height={20}
        loading="lazy"
        onError={() => setLogoError(true)}
        style={{
          width: '20px',
          height: '20px',
          objectFit: 'contain',
          borderRadius: '2px',
          flexShrink: 0,
          ...style,
        }}
        className={className}
      />
    );
  }

  const code = getCountryCode(cleanTeam);
  const lower = cleanTeam.toLowerCase();
  if (
    !code ||
    code === 'xx' ||
    lower.includes('por definir') ||
    lower.includes('por decidir') ||
    lower.includes('tbd') ||
    lower.includes('ganador') ||
    lower.includes('perdedor') ||
    lower.includes('º') ||
    cleanTeam === '?'
  ) {
    return null;
  }

  if (hasError) {
    return (
      <span
        style={{
          fontSize: '15px',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          ...style,
        }}
        className={className}
        title={cleanTeam}
      >
        {getCountryEmoji(cleanTeam)}
      </span>
    );
  }

  return (
    <img
      src={`/flags/${code}.svg`}
      alt={cleanTeam}
      width={20}
      height={15}
      loading="lazy"
      onError={(e) => {
        const target = e.currentTarget;
        if (!target.src.includes('flagcdn.com')) {
          target.src = `https://flagcdn.com/${size}/${code}.png`;
        } else {
          setHasError(true);
        }
      }}
      style={{
        width: '20px',
        height: '15px',
        objectFit: 'cover',
        borderRadius: '2px',
        flexShrink: 0,
        ...style,
      }}
      className={className}
    />
  );
};

export default Flag;
