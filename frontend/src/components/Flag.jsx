
import { getCountryCode } from '../utils/constants';

const Flag = ({ team, size = '20x15', style = {}, className = '' }) => {
    if (!team) return null;
    return (
        <img 
            src={`https://flagcdn.com/${size}/${getCountryCode(team)}.png`} 
            alt={team} 
            style={style}
            className={className}
        />
    );
};

export default Flag;
