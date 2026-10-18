import { afterEach, describe, expect, it, vi } from 'vitest';
import { StageVideoPlaylist, STAGE_VIDEO_FILES } from './StageVideoPlaylist';
import type { SpatialStageAcoustics } from '../audio/SpatialStageAcoustics';

function setup(graphReady = true) {
  const events = new Map<string, () => void>();
  const video = {
    style: {},
    setAttribute: vi.fn(),
    remove: vi.fn(),
    playsInline: false,
    muted: false,
    defaultMuted: false,
    paused: true,
    preload: '',
    src: '',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    load: vi.fn(),
    play: vi.fn(async () => {}),
    pause: vi.fn(),
    removeAttribute: vi.fn(),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: 'suspended',
    destination: {},
    resume: vi.fn(() => new Promise<void>(() => {})),
    close: vi.fn(async () => {}),
    createMediaElementSource: vi.fn(() => source),
  };
  const audioConstructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal('AudioContext', audioConstructor);
  vi.stubGlobal('document', { createElement: () => video, body: { append: vi.fn() } });
  vi.stubGlobal('window', {
    addEventListener: vi.fn((event: string, listener: () => void) => events.set(event, listener)),
    removeEventListener: vi.fn((event: string) => events.delete(event)),
  });
  const acoustics = {
    initGraph: vi.fn(() => graphReady),
    inputNode: {},
    masterGain: {},
    connectOutput: vi.fn(),
    dispose: vi.fn(),
  };
  const playlist = new StageVideoPlaylist(acoustics as unknown as SpatialStageAcoustics, 0);
  return { playlist, video, context, source, events, acoustics, audioConstructor };
}

afterEach(() => vi.unstubAllGlobals());
describe('stage video autoplay and gesture unlock', () => {
  it('starts muted inline pictures without needing an AudioContext', () => {
    const { playlist, video, audioConstructor } = setup();
    expect(video.playsInline).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.defaultMuted).toBe(true);
    expect(video.play).toHaveBeenCalledOnce();
    expect(document.body.append).toHaveBeenCalledWith(video);
    expect(video.style).toMatchObject({ opacity: '0', width: '960px', height: '540px' });
    expect(vi.mocked(document.body.append).mock.invocationCallOrder[0]).toBeLessThan(
      video.play.mock.invocationCallOrder[0],
    );
    expect(audioConstructor).not.toHaveBeenCalled();
    playlist.dispose();
  });
  it('calls video.play inside the touch gesture even when audio resume never resolves', () => {
    const { playlist, video, context, source, events } = setup();
    events.get('touchend')!();
    expect(context.resume).toHaveBeenCalledOnce();
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(video.muted).toBe(false);
    expect(source.connect).toHaveBeenCalledOnce();
    events.get('pointerdown')!();
    expect(context.createMediaElementSource).toHaveBeenCalledOnce();
    playlist.dispose();
    expect(events.size).toBe(0);
    expect(source.disconnect).toHaveBeenCalledOnce();
    expect(context.close).toHaveBeenCalledOnce();
  });
  it('continues pictures when the spatial audio graph cannot initialize', async () => {
    const { playlist, video, source } = setup(false);
    await playlist.play(true);
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(video.muted).toBe(true);
    expect(source.connect).not.toHaveBeenCalled();
    playlist.dispose();
  });
  it('falls back to muted playback after an audible autoplay rejection and can retry audio', async () => {
    const { playlist, video } = setup();
    video.play.mockRejectedValueOnce(new Error('NotAllowedError'));
    await playlist.play(true);
    expect(video.play).toHaveBeenCalledTimes(3);
    expect(video.muted).toBe(true);
    await playlist.play(true);
    expect(video.muted).toBe(false);
    playlist.dispose();
    await playlist.play(true);
    expect(video.play).toHaveBeenCalledTimes(4);
  });
  it('retains the existing playlist path and releases media resources', () => {
    const { playlist, video, acoustics } = setup();
    expect(video.src).toContain(`game-assets/videos/stage/${STAGE_VIDEO_FILES[0]}`);
    playlist.dispose();
    playlist.dispose();
    expect(video.pause).toHaveBeenCalledOnce();
    expect(video.remove).toHaveBeenCalledOnce();
    expect(video.removeAttribute).toHaveBeenCalledWith('src');
    expect(acoustics.dispose).toHaveBeenCalledOnce();
  });
});
