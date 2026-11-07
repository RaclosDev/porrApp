import { describe, expect, it } from 'vitest';
import { smallTeamLogo } from '../../utils/teamLogo';

describe('smallTeamLogo', () => {
  it('asks ESPN for a small version of its 500 px crests', () => {
    expect(smallTeamLogo('https://a.espncdn.com/i/teamlogos/soccer/500/99.png')).toBe(
      'https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/99.png&w=96&h=96',
    );
  });

  it('leaves local flags and other hosts untouched', () => {
    expect(smallTeamLogo('/flags/mx.svg')).toBe('/flags/mx.svg');
    expect(smallTeamLogo('https://flagcdn.com/w40/es.png')).toBe('https://flagcdn.com/w40/es.png');
  });
});
