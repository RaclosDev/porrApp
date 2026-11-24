import { describe, expect, it } from 'vitest';
import { demoAvatar, withAvatars } from '../../demo/avatars';

describe('withAvatars', () => {
  it('pone foto a quien no la tiene y respeta las que ya existen', () => {
    const data = {
      ranking: [
        { userId: 105, name: 'Marta', avatarUrl: null },
        { userId: 101, name: 'Dani', avatarUrl: 'https://x/dani.png' },
      ],
    };
    const out = withAvatars(data);
    expect(out.ranking[0].avatarUrl).toBe(demoAvatar(105));
    expect(out.ranking[0].avatarUrl).toMatch(/^https:\/\/randomuser\.me\//);
    expect(out.ranking[1].avatarUrl).toBe('https://x/dani.png');
  });

  it('deja en blanco a usuarios desconocidos', () => {
    expect(withAvatars({ userId: 999, avatarUrl: null }).avatarUrl).toBeNull();
  });
});
