import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const started: string[] = [];

class FakeContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = {};
  decodeAudioData = vi.fn(() => Promise.resolve({ duration: 3 }));
  createBufferSource() {
    return { buffer: null, connect: vi.fn(), start: () => started.push('file'), stop: vi.fn() };
  }
  createOscillator() {
    started.push('synth');
    const param = { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() };
    return {
      type: '',
      frequency: param,
      connect: vi.fn(() => ({ connect: vi.fn() })),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    const param = {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };
    return { gain: param, connect: vi.fn(() => ({ connect: vi.fn() })) };
  }
}

async function load(ok: boolean) {
  vi.resetModules();
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok, arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) })),
  );
  const sound = await import('../../components/poker/pokerSound');
  const ducks: number[] = [];
  sound.onPokerDuck((ms) => ducks.push(ms));
  return { sound, ducks };
}

describe('playPokerSound', () => {
  beforeEach(() => {
    started.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('plays the recorded level sound and lowers the music while it lasts', async () => {
    const { sound, ducks } = await load(true);
    sound.playPokerSound('level');
    await vi.waitFor(() => expect(started).toContain('file'));
    expect(fetch).toHaveBeenCalledWith('/sounds/poker/level.mp3');
    expect(ducks).toEqual([3000]);
    expect(started).not.toContain('synth');
  });

  it('falls back to the synthesized sound when the file is missing', async () => {
    const { sound } = await load(false);
    sound.playPokerSound('level');
    await vi.waitFor(() => expect(started).toContain('synth'));
    expect(started).not.toContain('file');
  });
});
