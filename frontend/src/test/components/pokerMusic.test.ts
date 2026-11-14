import { describe, expect, it } from 'vitest';
import { musicEmbed } from '../../components/poker/pokerMusic';

describe('musicEmbed', () => {
  it('convierte vídeos y listas de YouTube', () => {
    expect(musicEmbed('https://www.youtube.com/watch?v=abc123&list=PL9')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&list=PL9',
    );
    expect(musicEmbed('https://youtu.be/abc123')?.src).toContain('/embed/abc123?');
    expect(musicEmbed('https://www.youtube.com/playlist?list=PL9')?.src).toBe(
      'https://www.youtube-nocookie.com/embed/videoseries?autoplay=1&list=PL9',
    );
  });

  it('convierte enlaces de Spotify', () => {
    expect(musicEmbed('https://open.spotify.com/playlist/37i9dQ?si=x')?.src).toBe(
      'https://open.spotify.com/embed/playlist/37i9dQ',
    );
    expect(musicEmbed('https://open.spotify.com/intl-es/album/4abc')?.src).toBe(
      'https://open.spotify.com/embed/album/4abc',
    );
  });

  it('rechaza otros sitios, http y enlaces mal formados', () => {
    expect(musicEmbed('https://evil.com/watch?v=abc')).toBeNull();
    expect(musicEmbed('https://youtube.com.evil.com/watch?v=abc')).toBeNull();
    expect(musicEmbed('http://youtu.be/abc')).toBeNull();
    expect(musicEmbed('hola')).toBeNull();
    expect(musicEmbed('https://open.spotify.com/user/pepe')).toBeNull();
  });
});
