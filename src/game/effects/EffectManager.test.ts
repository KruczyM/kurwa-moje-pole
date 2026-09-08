import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EffectManager, defaultVisualSettings, effectConfigs } from './EffectManager';

beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 800,
    innerHeight: 600,
  };
});

afterAll(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('LSD visual profile', () => {
  it('uses strong saturation and a smooth three-phase lifetime', () => {
    const lsd = effectConfigs.LSD;
    expect(lsd.saturation).toBeGreaterThanOrEqual(2);
    expect(lsd.fadeIn).toBeGreaterThan(0);
    expect(lsd.active).toBeGreaterThan(0);
    expect(lsd.fadeOut).toBeGreaterThan(0);
  });
});

describe('MDMA visual profile', () => {
  it('keeps the scene bright and alternates melt with color mixing', () => {
    const mdma = effectConfigs.MDMA;
    expect(mdma.saturation).toBeGreaterThanOrEqual(2);
    expect(mdma.brightness).toBeGreaterThan(0.1);
    expect(mdma.lift).toBeGreaterThan(0);
    expect(mdma.melt).toBeGreaterThan(0);
    expect(mdma.mixing).toBeGreaterThan(0);
  });
});

describe('distinct effect profiles', () => {
  it('assigns a separate visual language to every strong effect', () => {
    const ids = ['Joint', 'Kreska', 'Grzyb', 'MDMA', 'LSD'] as const;
    const languages = ids.map((id) => effectConfigs[id].visualLanguage);
    expect(new Set(languages).size).toBe(ids.length);
  });

  it('gives each profile an audible modulation which can return to its snapshot', () => {
    expect(effectConfigs.Joint.audioRate).toBeLessThan(1);
    expect(effectConfigs.Kreska.audioRate).toBeGreaterThan(1);
    expect(effectConfigs.Grzyb.audioRate).not.toBe(effectConfigs.MDMA.audioRate);
    expect(effectConfigs.LSD.audioVolume).toBeLessThan(1);
  });
});

function createMockRenderer() {
  return {
    render: () => {},
    setSize: () => {},
    dispose: () => {},
    getPixelRatio: () => 1,
    getSize: (target: THREE.Vector2) => target.set(800, 600),
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    clear: () => {},
  } as unknown as THREE.WebGLRenderer;
}

describe('accessibility settings & reduced motion', () => {
  it('defines all required accessibility toggles in defaultVisualSettings', () => {
    expect(defaultVisualSettings.intensity).toBe(1);
    expect(defaultVisualSettings.reduceMotion).toBe(false);
    expect(defaultVisualSettings.limitSway).toBe(false);
    expect(defaultVisualSettings.disableShake).toBe(false);
    expect(defaultVisualSettings.disableBloom).toBe(false);
    expect(defaultVisualSettings.disableFlashes).toBe(false);
    expect(defaultVisualSettings.disableAberration).toBe(false);
  });

  it('suppresses sway, shake, and excessive head bob when reduceMotion is enabled', () => {
    const dummyRenderer = createMockRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const manager = new EffectManager(dummyRenderer, scene, camera);
    manager.use('Kreska');
    manager.update(1.0);

    // Default modifiers: Kreska has shake > 0 and bob > 1
    const activeModifiers = manager.modifiers;
    expect(activeModifiers.shake).toBeGreaterThan(0);
    expect(activeModifiers.bob).toBeGreaterThan(1);

    // When reduceMotion is set:
    manager.setSettings({ reduceMotion: true });
    const safeModifiers = manager.modifiers;
    expect(safeModifiers.shake).toBe(0);
    expect(safeModifiers.sway).toBe(0);
    expect(safeModifiers.bob).toBe(1);

    manager.dispose();
  });

  it('respects independent limitSway and disableShake flags', () => {
    const dummyRenderer = createMockRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const manager = new EffectManager(dummyRenderer, scene, camera);
    manager.use('Piwo'); // Piwo has sway > 0
    manager.update(1.5);
    expect(manager.modifiers.sway).toBeGreaterThan(0);

    manager.setSettings({ limitSway: true });
    expect(manager.modifiers.sway).toBe(0);

    manager.use('Kreska'); // Kreska has shake > 0
    manager.update(1.0);
    manager.setSettings({ disableShake: true });
    expect(manager.modifiers.shake).toBe(0);

    manager.dispose();
  });

  it('disables chromatic aberration when disableAberration is set', () => {
    const dummyRenderer = createMockRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const manager = new EffectManager(dummyRenderer, scene, camera);
    manager.use('LSD'); // LSD has chroma > 0
    manager.update(0.1);
    expect(manager.shader.uniforms.chroma.value).toBeGreaterThan(0);

    manager.setSettings({ disableAberration: true });
    manager.update(0.1);
    expect(manager.shader.uniforms.chroma.value).toBe(0);

    manager.dispose();
  });

  it('disables brightness pulse flashes when disableFlashes is set', () => {
    const dummyRenderer = createMockRenderer();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    const manager = new EffectManager(dummyRenderer, scene, camera);
    manager.use('Kreska');
    manager.update(0.1);
    expect(manager.shader.uniforms.pulse.value).toBeGreaterThan(0);

    manager.setSettings({ disableFlashes: true });
    manager.update(0.1);
    expect(manager.shader.uniforms.pulse.value).toBe(0);

    manager.dispose();
  });
});
