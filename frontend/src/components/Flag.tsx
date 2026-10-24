import { getCountryCode } from '../utils/constants';

/**
 * Componente funcional para renderizar la bandera de un equipo o país.
 * Utiliza el servicio de flagcdn.com basándose en el código del país.
 *
 * @component
 * @param {Object} props - Propiedades del componente.
 * @param {string} props.team - Nombre del equipo o país para obtener su bandera.
 * @param {string} [props.size='w40'] - Tamaño de la bandera (ej. 'w40', 'w80').
 * @param {Object} [props.style={}] - Estilos inline adicionales para la imagen.
 * @param {string} [props.className=''] - Clases CSS adicionales.
 * @returns {JSX.Element|null} Elemento <img> con la bandera o null si no hay equipo.
 */
const Flag = ({ team, size = 'w40', style = {}, className = '' }) => {
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
  return (
    <img
      src={`https://flagcdn.com/${size}/${code}.png`}
      alt={team}
      width={20}
      height={15}
      loading="lazy"
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
