import { useState } from 'react';
import { getCountryCode, getCountryEmoji } from '../utils/constants';

/**
 * Componente funcional para renderizar la bandera de un equipo o país.
 * Utiliza el servicio de flagcdn.com basándose en el código del país,
 * con fallback automático a emoji si la imagen de CDN es bloqueada o falla.
 *
 * @component
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.team - Nombre del equipo o país para obtener su bandera.
 * @param {string} [props.size='w40'] - Tamaño de la bandera (ej. 'w40', 'w80').
 * @param {Object} [props.style={}] - Estilos inline adicionales para la imagen.
 * @param {string} [props.className=''] - Clases CSS adicionales.
 * @returns {JSX.Element|null} Elemento <img> o emoji con la bandera.
 */
const Flag = ({ team, size = 'w40', style = {}, className = '' }) => {
  const [hasError, setHasError] = useState(false);

  if (!team) return null;
  const code = getCountryCode(team);
  const lower = team.toLowerCase();
  if (
    !code ||
    code === 'xx' ||
    lower.includes('por definir') ||
    lower.includes('por decidir') ||
    lower.includes('tbd') ||
    lower.includes('ganador') ||
    lower.includes('perdedor') ||
    lower.includes('º') ||
    team === '?'
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
        title={team}
      >
        {getCountryEmoji(team)}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/${size}/${code}.png`}
      alt={team}
      width={20}
      height={15}
      loading="lazy"
      onError={() => setHasError(true)}
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
