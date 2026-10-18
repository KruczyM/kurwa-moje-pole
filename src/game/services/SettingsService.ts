import * as THREE from 'three';
import { type VisualSettings, defaultVisualSettings, type EffectId } from '../effects/EffectManager';
import { DEFAULT_GRASS_PRESET, isGrassQualityPreset } from '../world/grassQuality';
import { isAspectRatioPreset } from '../rendering/viewportAspect';

export const INTENSE_EFFECTS: readonly EffectId[] = ['Grzyb', 'MDMA', 'LSD', 'Kreska'];

export function isIntenseEffect(id: EffectId): boolean {
  return INTENSE_EFFECTS.includes(id);
}

export type AudioSettings = {
  speakerVolume: number;
  ambientVolume: number;
  speakerEnabled: boolean;
};

export const defaultAudioSettings: AudioSettings = {
  speakerVolume: 0.7,
  ambientVolume: 0.35,
  speakerEnabled: false,
};

/** Wykrywa systemową preferencję ograniczenia ruchu (prefers-reduced-motion). */
export function detectSystemReducedMotion(): boolean {
  const target =
    typeof window !== 'undefined'
      ? window
      : typeof globalThis !== 'undefined'
        ? (globalThis as unknown as Window)
        : undefined;
  return (
    typeof target !== 'undefined' &&
    typeof target.matchMedia === 'function' &&
    target.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Odczytuje ustawienia efektów z localStorage i uzupełnia brakujące wartości domyślne. */
export function loadVisualSettings(): VisualSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('camp-visual-settings') : null;
    const parsed = raw ? JSON.parse(raw) : {};
    const systemReducedMotion = detectSystemReducedMotion();

    const loaded: VisualSettings = {
      ...defaultVisualSettings,
      ...(systemReducedMotion && !raw
        ? {
            reduceMotion: true,
            limitSway: true,
            disableShake: true,
            disableFlashes: true,
            disableAberration: true,
          }
        : {}),
      ...parsed,
    };
    if (!isGrassQualityPreset(loaded.grassQuality)) {
      loaded.grassQuality = DEFAULT_GRASS_PRESET;
    }
    if (loaded.matrixMode !== 'auto' && loaded.matrixMode !== 'always' && loaded.matrixMode !== 'off') {
      loaded.matrixMode = defaultVisualSettings.matrixMode;
    }
    if (
      loaded.matrixQuality !== 'low' &&
      loaded.matrixQuality !== 'medium' &&
      loaded.matrixQuality !== 'high'
    ) {
      loaded.matrixQuality = defaultVisualSettings.matrixQuality;
    }
    if (!isAspectRatioPreset(loaded.aspectRatio)) {
      loaded.aspectRatio = defaultVisualSettings.aspectRatio;
    }
    if (typeof loaded.intensity !== 'number' || Number.isNaN(loaded.intensity)) {
      loaded.intensity = defaultVisualSettings.intensity;
    } else {
      loaded.intensity = THREE.MathUtils.clamp(loaded.intensity, 0, 1);
    }
    return loaded;
  } catch {
    return { ...defaultVisualSettings };
  }
}

/** Odczytuje ustawienia dźwiękowe z localStorage lub zwraca wartości domyślne. */
export function loadAudioSettings(): AudioSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('camp-audio-settings') : null;
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      speakerVolume:
        typeof parsed.speakerVolume === 'number' && !Number.isNaN(parsed.speakerVolume)
          ? THREE.MathUtils.clamp(parsed.speakerVolume, 0, 1)
          : defaultAudioSettings.speakerVolume,
      ambientVolume:
        typeof parsed.ambientVolume === 'number' && !Number.isNaN(parsed.ambientVolume)
          ? THREE.MathUtils.clamp(parsed.ambientVolume, 0, 1)
          : defaultAudioSettings.ambientVolume,
      speakerEnabled:
        typeof parsed.speakerEnabled === 'boolean'
          ? parsed.speakerEnabled
          : defaultAudioSettings.speakerEnabled,
    };
  } catch {
    return { ...defaultAudioSettings };
  }
}

/** Serwis zarządzający konfiguracją wizualną, dźwiękową i dostępnością oraz ich trwałością. */
export class SettingsService {
  readonly visual: VisualSettings;
  readonly audio: AudioSettings;
  private mediaQueryList?: MediaQueryList;
  private mediaQueryHandler?: (event: MediaQueryListEvent) => void;
  private onVisualChangeListeners: ((settings: VisualSettings) => void)[] = [];
  private onAudioChangeListeners: ((settings: AudioSettings) => void)[] = [];

  constructor() {
    this.visual = loadVisualSettings();
    this.audio = loadAudioSettings();

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      this.mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.mediaQueryHandler = (event: MediaQueryListEvent) => {
        if (!localStorage.getItem('camp-visual-settings')) {
          this.updateVisual({
            reduceMotion: event.matches,
            limitSway: event.matches,
            disableShake: event.matches,
            disableFlashes: event.matches,
            disableAberration: event.matches,
          });
        }
      };
      this.mediaQueryList.addEventListener?.('change', this.mediaQueryHandler);
    }
  }

  onVisualChange(listener: (settings: VisualSettings) => void): () => void {
    this.onVisualChangeListeners.push(listener);
    return () => {
      this.onVisualChangeListeners = this.onVisualChangeListeners.filter((l) => l !== listener);
    };
  }

  onAudioChange(listener: (settings: AudioSettings) => void): () => void {
    this.onAudioChangeListeners.push(listener);
    return () => {
      this.onAudioChangeListeners = this.onAudioChangeListeners.filter((l) => l !== listener);
    };
  }

  updateVisual(values: Partial<VisualSettings>) {
    Object.assign(this.visual, values);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('camp-visual-settings', JSON.stringify(this.visual));
    }
    this.onVisualChangeListeners.forEach((l) => l(this.visual));
  }

  updateAudio(values: Partial<AudioSettings>) {
    Object.assign(this.audio, values);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('camp-audio-settings', JSON.stringify(this.audio));
    }
    this.onAudioChangeListeners.forEach((l) => l(this.audio));
  }

  dispose() {
    if (this.mediaQueryList && this.mediaQueryHandler) {
      this.mediaQueryList.removeEventListener?.('change', this.mediaQueryHandler);
      this.mediaQueryList = undefined;
      this.mediaQueryHandler = undefined;
    }
    this.onVisualChangeListeners.length = 0;
    this.onAudioChangeListeners.length = 0;
  }
}
