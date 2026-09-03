import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { EffectTimeline } from './EffectTimeline';
export type EffectId = 'Piwo' | 'Papieros' | 'Joint' | 'Kreska' | 'Grzyb' | 'MDMA' | 'LSD';
export type EffectPhase = 'inactive' | 'fadeIn' | 'active' | 'fadeOut';
export type VisualSettings = {
  intensity: number;
  reduceMotion: boolean;
  limitSway: boolean;
  disableShake: boolean;
  disableBloom: boolean;
};
export const defaultVisualSettings: VisualSettings = {
  intensity: 1,
  reduceMotion: false,
  limitSway: false,
  disableShake: false,
  disableBloom: false,
};
export type EffectConfig = {
  fadeIn: number;
  active: number;
  fadeOut: number;
  speed: number;
  fov: number;
  bloom: number;
  saturation: number;
  warp: number;
  afterimage: number;
  sway: number;
  shake: number;
  bob: number;
  hue: number;
  chroma: number;
  contrast: number;
  brightness: number;
  vignette: number;
  blur: number;
  pulse: number;
  melt?: number;
  mixing?: number;
  lift?: number;
  audioRate: number;
  audioVolume: number;
  visualLanguage: 'dreamy' | 'stimulant' | 'organic' | 'empathic' | 'prismatic' | 'subtle';
};
export const effectConfigs: Record<EffectId, EffectConfig> = {
  Piwo: {
    fadeIn: 1,
    active: 18,
    fadeOut: 2,
    speed: 0.85,
    fov: 65,
    bloom: 0.08,
    saturation: 0.94,
    warp: 0.22,
    afterimage: 0.72,
    sway: 0.2,
    shake: 0,
    bob: 0.9,
    hue: 0.01,
    chroma: 0.008,
    contrast: 0.9,
    brightness: -0.02,
    vignette: 0.46,
    blur: 0.2,
    pulse: 0.55,
    audioRate: 0.96,
    audioVolume: 0.92,
    visualLanguage: 'subtle',
  },
  Papieros: {
    fadeIn: 0.5,
    active: 12,
    fadeOut: 1,
    speed: 1,
    fov: 65,
    bloom: 0.05,
    saturation: 0.9,
    warp: 0.04,
    afterimage: 0,
    sway: 0.08,
    shake: 0,
    bob: 0.85,
    hue: 0.015,
    chroma: 0.002,
    contrast: 0.94,
    brightness: 0.025,
    vignette: 0.12,
    blur: 0.04,
    pulse: 0.35,
    audioRate: 1,
    audioVolume: 0.96,
    visualLanguage: 'subtle',
  },
  Joint: {
    fadeIn: 1,
    active: 22,
    fadeOut: 3,
    speed: 0.78,
    fov: 66.4,
    bloom: 0.25,
    saturation: 1.22,
    warp: 0.18,
    afterimage: 0.88,
    sway: 0.09,
    shake: 0,
    bob: 0.8,
    hue: 0.045,
    chroma: 0.006,
    contrast: 1.02,
    brightness: 0.035,
    vignette: 0.28,
    blur: 0.08,
    pulse: 0.22,
    audioRate: 0.92,
    audioVolume: 0.82,
    visualLanguage: 'dreamy',
  },
  Kreska: {
    fadeIn: 0.7,
    active: 13,
    fadeOut: 2,
    speed: 1.45,
    fov: 76,
    bloom: 0.2,
    saturation: 1.1,
    warp: 0.04,
    afterimage: 0,
    sway: 0,
    shake: 0.3,
    bob: 1.45,
    hue: -0.025,
    chroma: 0.004,
    contrast: 1.32,
    brightness: 0.055,
    vignette: 0.48,
    blur: 0,
    pulse: 2.6,
    audioRate: 1.12,
    audioVolume: 1.08,
    visualLanguage: 'stimulant',
  },
  Grzyb: {
    fadeIn: 2,
    active: 25,
    fadeOut: 4,
    speed: 0.9,
    fov: 69,
    bloom: 0.28,
    saturation: 1.38,
    warp: 0.8,
    afterimage: 0.2,
    sway: 0.12,
    shake: 0,
    bob: 1,
    hue: 0.1,
    chroma: 0.012,
    contrast: 1.05,
    brightness: 0.02,
    vignette: 0.3,
    blur: 0.07,
    pulse: 0.42,
    audioRate: 0.88,
    audioVolume: 0.86,
    visualLanguage: 'organic',
  },
  MDMA: {
    fadeIn: 1.5,
    active: 22,
    fadeOut: 3,
    speed: 1,
    fov: 66,
    bloom: 0.82,
    saturation: 2.45,
    warp: 0.16,
    afterimage: 0.24,
    sway: 0.08,
    shake: 0,
    bob: 1,
    hue: 0.09,
    chroma: 0.009,
    contrast: 1.15,
    brightness: 0.14,
    vignette: 0.08,
    blur: 0.04,
    pulse: 1.1,
    melt: 1,
    mixing: 1,
    lift: 0.42,
    audioRate: 1.04,
    audioVolume: 1.05,
    visualLanguage: 'empathic',
  },
  LSD: {
    fadeIn: 1.5,
    active: 25,
    fadeOut: 3,
    speed: 0.92,
    fov: 71,
    bloom: 0.68,
    saturation: 2.15,
    warp: 1.08,
    afterimage: 0.6,
    sway: 0.13,
    shake: 0,
    bob: 1.08,
    hue: 0.34,
    chroma: 0.026,
    contrast: 1.24,
    brightness: 0.055,
    vignette: 0.32,
    blur: 0.025,
    pulse: 0.78,
    audioRate: 0.9,
    audioVolume: 0.9,
    visualLanguage: 'prismatic',
  },
};

export type AudioEffectState = { volume: number; playbackRate: number };
export interface EffectAudioTarget {
  captureEffectState(): AudioEffectState;
  applyEffectState(state: AudioEffectState): void;
  restoreEffectState(state: AudioEffectState): void;
}

const effectUniformNames = [
  'distortion',
  'saturation',
  'hue',
  'chroma',
  'contrast',
  'brightness',
  'vignette',
  'blur',
  'pulse',
  'melt',
  'mixing',
  'lift',
] as const;
type EffectUniformName = (typeof effectUniformNames)[number];
type EffectSnapshot = {
  cameraFov: number;
  bloom: { enabled: boolean; strength: number; radius: number; threshold: number };
  afterimage: { enabled: boolean; damp: number };
  uniforms: Record<EffectUniformName, number>;
  audio?: AudioEffectState;
};
const shader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    distortion: { value: 0 },
    saturation: { value: 1 },
    hue: { value: 0 },
    chroma: { value: 0 },
    contrast: { value: 1 },
    brightness: { value: 0 },
    vignette: { value: 0 },
    blur: { value: 0 },
    pulse: { value: 0 },
    melt: { value: 0 },
    mixing: { value: 0 },
    lift: { value: 0 },
  },
  vertexShader:
    'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: `uniform sampler2D tDiffuse;
uniform float time,distortion,saturation,hue,chroma,contrast,brightness,vignette,blur,pulse,melt,mixing,lift;
varying vec2 vUv;
vec3 hueShift(vec3 c,float a){float s=sin(a),co=cos(a);mat3 m=mat3(.299+.701*co,.587-.587*co,.114-.114*co,.299-.299*co,.587+.413*co,.114+.886*co,.299-.3*co,.587-.588*co,.114+.886*co);return clamp(m*c,0.,1.);}
void main(){
 vec2 centered=vUv-.5;
 float r=length(centered);
 float wave=sin(centered.y*14.+time*.75)+cos(centered.x*12.-time*.53);
 centered*=1.+distortion*(.015+.022*sin(time*pulse))*r*r;
 centered+=normalize(centered+vec2(.0001))*wave*distortion*.004;
 vec2 uv=centered+.5;
 float alternate=.5+.5*sin(time*.62);
 float drip=sin(uv.x*9.+time*1.3)*.012+sin(uv.x*23.-time*.7)*.006;
 uv.y+=melt*alternate*drip*(.35+uv.y);
 vec2 mixOffset=vec2(sin(time*.9+uv.y*17.),cos(time*.72+uv.x*15.))*.009*mixing*(1.-alternate);
 float ca=chroma*(.25+r*.9);
 vec2 d=normalize(uv-.5+vec2(.0001))*ca;
 vec3 col;
 col.r=texture2D(tDiffuse,uv+d).r;
 col.g=texture2D(tDiffuse,uv).g;
 col.b=texture2D(tDiffuse,uv-d).b;
 if(mixing>0.){
  vec3 mixed=(col+texture2D(tDiffuse,uv+mixOffset).rgb+texture2D(tDiffuse,uv-mixOffset*1.35).rgb)/3.;
  col=mix(col,mixed,mixing*(1.-alternate)*.88);
 }
 if(blur>0.){col+=texture2D(tDiffuse,uv+vec2(blur*.003,0.)).rgb;col+=texture2D(tDiffuse,uv-vec2(blur*.003,0.)).rgb;col/=3.;}
 col=mix(col,sqrt(max(col,vec3(0.))),lift);
 float l=dot(col,vec3(.299,.587,.114));
 col=mix(vec3(l),col,saturation);
 col=hueShift(col,hue*sin(time*.22+wave*.12));
 col=(col-.5)*contrast+.5+brightness;
 col*=1.-smoothstep(.15,.72,r)*vignette;
 gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`,
};
export class EffectManager {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  afterimage: AfterimagePass;
  shader: ShaderPass;
  private timeline = new EffectTimeline();
  private snapshot?: EffectSnapshot;
  private disposed = false;
  settings: VisualSettings = { ...defaultVisualSettings };
  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private audio?: EffectAudioTarget,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0, 0.3, 0.8);
    this.composer.addPass(this.bloom);
    this.afterimage = new AfterimagePass(0.88);
    this.afterimage.enabled = false;
    this.composer.addPass(this.afterimage);
    this.shader = new ShaderPass(shader);
    this.composer.addPass(this.shader);
  }

  /** Uruchamia wybrany efekt i zaczyna jego łagodne pojawianie się. */
  use(id: EffectId) {
    if (this.disposed) return;
    if (!this.timeline.active) this.snapshot = this.captureSnapshot();
    if (this.timeline.active && this.timeline.active !== id) this.afterimage.uniforms.damp.value = 0;
    this.timeline.use(id, effectConfigs[id]);
  }

  /** Przenosi aktywny efekt do fazy wygaszania. */
  cancel() {
    if (this.timeline.active) this.timeline.cancel(effectConfigs[this.timeline.active]);
  }

  /** Aktualizuje ustawienia dostępności i siłę efektów wizualnych. */
  setSettings(settings: Partial<VisualSettings>) {
    Object.assign(this.settings, settings);
  }

  /** Przelicza fazę efektu, shader, post-processing oraz pole widzenia kamery. */
  update(dt: number) {
    if (this.disposed) return;
    const beforeUpdate = this.timeline.active;
    const completed = this.timeline.update(dt, beforeUpdate ? effectConfigs[beforeUpdate] : null);
    if (completed) {
      this.restoreSnapshot();
      return;
    }
    const c = this.active ? effectConfigs[this.active] : null,
      level = this.visualIntensity,
      pulse = c ? 1 + Math.sin(this.shader.uniforms.time.value * c.pulse) * 0.08 * level : 1;
    if (!c || !this.snapshot) return;
    this.bloom.enabled = !this.settings.disableBloom && (this.snapshot.bloom.enabled || c.bloom > 0);
    this.bloom.strength = THREE.MathUtils.lerp(this.snapshot.bloom.strength, c.bloom, level) * pulse;
    this.afterimage.enabled = this.snapshot.afterimage.enabled || (c.afterimage > 0 && level > 0.02);
    this.afterimage.uniforms.damp.value = THREE.MathUtils.lerp(
      this.snapshot.afterimage.damp,
      c.afterimage,
      level,
    );
    const u = this.shader.uniforms;
    const allowMotion = !this.settings.reduceMotion;
    const base = this.snapshot.uniforms;
    u.distortion.value = THREE.MathUtils.lerp(base.distortion, allowMotion ? c.warp : 0, level);
    u.saturation.value = THREE.MathUtils.lerp(base.saturation, c.saturation, level);
    u.hue.value = THREE.MathUtils.lerp(base.hue, c.hue, level);
    u.chroma.value = THREE.MathUtils.lerp(base.chroma, c.chroma, level);
    u.contrast.value = THREE.MathUtils.lerp(base.contrast, c.contrast, level);
    u.brightness.value = THREE.MathUtils.lerp(base.brightness, c.brightness, level);
    u.vignette.value = THREE.MathUtils.lerp(base.vignette, c.vignette, level);
    u.blur.value = THREE.MathUtils.lerp(base.blur, c.blur, level);
    u.melt.value = THREE.MathUtils.lerp(base.melt, allowMotion ? c.melt || 0 : 0, level);
    u.mixing.value = THREE.MathUtils.lerp(base.mixing, allowMotion ? c.mixing || 0 : 0, level);
    u.lift.value = THREE.MathUtils.lerp(base.lift, c.lift || 0, level);
    u.pulse.value = THREE.MathUtils.lerp(base.pulse, c.pulse, level);
    u.time.value += dt;
    const target =
      THREE.MathUtils.lerp(this.snapshot.cameraFov, c.fov, level) *
      (1 + Math.sin(u.time.value * c.pulse) * 0.004 * level);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, target, 6, dt);
    this.camera.updateProjectionMatrix();
    if (this.snapshot.audio) {
      this.audio?.applyEffectState({
        volume: THREE.MathUtils.lerp(
          this.snapshot.audio.volume,
          Math.min(1, this.snapshot.audio.volume * c.audioVolume),
          level,
        ),
        playbackRate: THREE.MathUtils.lerp(
          this.snapshot.audio.playbackRate,
          this.snapshot.audio.playbackRate * c.audioRate,
          level,
        ),
      });
    }
  }

  /** Zapamiętuje dokładny stan sceny przed pierwszym efektem w serii. */
  private captureSnapshot(): EffectSnapshot {
    const uniforms = {} as Record<EffectUniformName, number>;
    effectUniformNames.forEach((name) => (uniforms[name] = this.shader.uniforms[name].value));
    return {
      cameraFov: this.camera.fov,
      bloom: {
        enabled: this.bloom.enabled,
        strength: this.bloom.strength,
        radius: this.bloom.radius,
        threshold: this.bloom.threshold,
      },
      afterimage: {
        enabled: this.afterimage.enabled,
        damp: this.afterimage.uniforms.damp.value,
      },
      uniforms,
      audio: this.audio?.captureEffectState(),
    };
  }

  /** Przywraca kamerę, post-processing i audio po każdej ścieżce zakończenia. */
  private restoreSnapshot() {
    if (!this.snapshot) return;
    this.camera.fov = this.snapshot.cameraFov;
    this.camera.updateProjectionMatrix();
    Object.assign(this.bloom, this.snapshot.bloom);
    this.afterimage.enabled = this.snapshot.afterimage.enabled;
    this.afterimage.uniforms.damp.value = this.snapshot.afterimage.damp;
    effectUniformNames.forEach((name) => (this.shader.uniforms[name].value = this.snapshot!.uniforms[name]));
    if (this.snapshot.audio) this.audio?.restoreEffectState(this.snapshot.audio);
    this.snapshot = undefined;
  }

  get active() {
    return this.timeline.active;
  }

  get phase() {
    return this.timeline.phase;
  }

  get remaining() {
    return this.timeline.remaining;
  }

  /** Zwraca bieżącą siłę efektu po uwzględnieniu ustawień gracza. */
  get visualIntensity() {
    return this.timeline.intensity * this.settings.intensity;
  }

  /** Zwraca modyfikatory ruchu gracza wynikające z aktywnej używki. */
  get modifiers() {
    const c = this.active ? effectConfigs[this.active] : null,
      level = this.visualIntensity;
    return {
      speed: THREE.MathUtils.lerp(1, c?.speed || 1, level),
      sway: this.settings.reduceMotion || this.settings.limitSway ? 0 : (c?.sway || 0) * level,
      shake: this.settings.reduceMotion || this.settings.disableShake ? 0 : (c?.shake || 0) * level,
      bob: THREE.MathUtils.lerp(1, c?.bob || 1, level),
    };
  }

  /** Renderuje scenę przez łańcuch efektów post-processingu. */
  render() {
    this.composer.render();
  }

  /** Dopasowuje bufory post-processingu do nowego rozmiaru widoku. */
  resize(w: number, h: number) {
    this.composer.setSize(w, h);
  }

  /** Zatrzymuje efekt i zwalnia zasoby renderera post-processingu. */
  dispose() {
    if (this.disposed) return;
    this.restoreSnapshot();
    this.timeline.reset();
    this.disposed = true;
    this.composer.dispose();
  }
}
