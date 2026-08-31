import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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
type Config = {
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
};
export const effectConfigs: Record<EffectId, Config> = {
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
  },
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
  active: EffectId | null = null;
  phase: EffectPhase = 'inactive';
  remaining = 0;
  private elapsed = 0;
  private intensity = 0;
  settings: VisualSettings = { ...defaultVisualSettings };
  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
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
    if (this.active && this.active !== id) this.afterimage.uniforms.damp.value = 0;
    this.active = id;
    this.phase = 'fadeIn';
    this.elapsed = 0;
    this.remaining = effectConfigs[id].active;
    this.intensity = 0;
  }

  /** Przenosi aktywny efekt do fazy wygaszania. */
  cancel() {
    if (this.active && this.phase !== 'fadeOut') {
      this.phase = 'fadeOut';
      this.elapsed = 0;
    }
  }

  /** Aktualizuje ustawienia dostępności i siłę efektów wizualnych. */
  setSettings(settings: Partial<VisualSettings>) {
    Object.assign(this.settings, settings);
  }

  /** Przelicza fazę efektu, shader, post-processing oraz pole widzenia kamery. */
  update(dt: number) {
    if (this.active) {
      const c = effectConfigs[this.active];
      this.elapsed += dt;
      if (this.phase === 'fadeIn') {
        this.intensity = Math.min(1, this.elapsed / c.fadeIn);
        if (this.intensity >= 1) {
          this.phase = 'active';
          this.elapsed = 0;
        }
      } else if (this.phase === 'active') {
        this.remaining = Math.max(0, c.active - this.elapsed);
        this.intensity = 1;
        if (this.elapsed >= c.active) {
          this.phase = 'fadeOut';
          this.elapsed = 0;
        }
      } else {
        this.intensity = Math.max(0, 1 - this.elapsed / c.fadeOut);
        if (this.intensity <= 0) {
          this.active = null;
          this.phase = 'inactive';
          this.remaining = 0;
          this.afterimage.uniforms.damp.value = 0;
        }
      }
    }
    const c = this.active ? effectConfigs[this.active] : null,
      level = this.visualIntensity,
      pulse = c ? 1 + Math.sin(this.shader.uniforms.time.value * c.pulse) * 0.08 * level : 1;
    this.bloom.enabled = !this.settings.disableBloom && !!c && c.bloom > 0;
    this.bloom.strength = (c?.bloom || 0) * level * pulse;
    this.afterimage.enabled = !!c && c.afterimage > 0 && level > 0.02;
    this.afterimage.uniforms.damp.value = c?.afterimage || 0;
    const u = this.shader.uniforms;
    const allowMotion = !this.settings.reduceMotion;
    u.distortion.value = (allowMotion ? c?.warp || 0 : 0) * level;
    u.saturation.value = THREE.MathUtils.lerp(1, c?.saturation || 1, level);
    u.hue.value = (c?.hue || 0) * level;
    u.chroma.value = (c?.chroma || 0) * level;
    u.contrast.value = THREE.MathUtils.lerp(1, c?.contrast || 1, level);
    u.brightness.value = (c?.brightness || 0) * level;
    u.vignette.value = (c?.vignette || 0) * level;
    u.blur.value = (c?.blur || 0) * level;
    u.melt.value = (allowMotion ? c?.melt || 0 : 0) * level;
    u.mixing.value = (allowMotion ? c?.mixing || 0 : 0) * level;
    u.lift.value = (c?.lift || 0) * level;
    u.pulse.value = c?.pulse || 0;
    u.time.value += dt;
    const target = c
      ? THREE.MathUtils.lerp(65, c.fov, level) *
        (1 + Math.sin(u.time.value * (c.pulse || 0.2)) * 0.004 * level)
      : 65;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, target, 6, dt);
    this.camera.updateProjectionMatrix();
  }

  /** Zwraca bieżącą siłę efektu po uwzględnieniu ustawień gracza. */
  get visualIntensity() {
    return this.intensity * this.settings.intensity;
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
    this.active = null;
    this.phase = 'inactive';
    this.afterimage.enabled = false;
    this.composer.dispose();
  }
}
