import { useState, useEffect } from 'react';
import { getCountryCode, getCountryEmoji, normalizeCountryName } from '../utils/constants';

/**
 * Componente funcional para renderizar la bandera o escudo de un equipo o país.
 * Permite pasar un logo/escudo directo con fallback a bandera por código de país o emoji.
 *
 * @component
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.team - Nombre del equipo o país para obtener su bandera.
 * @param {string} [props.logo] - URL del logo o escudo oficial (opcional).
 * @param {string} [props.size='w40'] - Tamaño de la bandera (ej. 'w40', 'w80').
 * @param {Object} [props.style={}] - Estilos inline adicionales para la imagen.
 * @param {string} [props.className=''] - Clases CSS adicionales.
 * @returns {JSX.Element|null} Elemento <img> o emoji con la bandera o escudo.
 */
const Flag = ({ team, logo, size = 'w40', style = {}, className = '' }) => {
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
