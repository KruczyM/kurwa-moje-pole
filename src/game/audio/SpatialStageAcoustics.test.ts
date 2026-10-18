import { describe, expect, it, vi } from 'vitest';
import {
  calculateAcoustics,
  calculateDistanceToStage,
  calculateHorizontalDistanceToStage,
  calculateStageStereoPan,
  DEFAULT_MAIN_STAGE_POSITION,
  PROMPT_STAGE_POSITION,
  smoothstep,
  SpatialStageAcousticsGraph,
} from './SpatialStageAcoustics';

function createMockAudioContext() {
  const createMockAudioParam = (initialValue: number) => ({
    value: initialValue,
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });

  const createMockNode = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const ctx = {
    currentTime: 10.0,
    state: 'running',
    createGain: vi.fn(() => ({
      ...createMockNode(),
      gain: createMockAudioParam(1.0),
    })),
    createBiquadFilter: vi.fn(() => ({
      ...createMockNode(),
      type: 'lowpass',
      frequency: createMockAudioParam(20000),
      Q: createMockAudioParam(0.707),
    })),
    createDelay: vi.fn(() => ({
      ...createMockNode(),
      delayTime: createMockAudioParam(0.025),
    })),
    createStereoPanner: vi.fn(() => ({
      ...createMockNode(),
      pan: createMockAudioParam(0.0),
    })),
  };

  return { ctx: ctx as unknown as AudioContext };
}

describe('SpatialStageAcoustics — E2 Dźwięk przestrzenny Dużej Sceny', () => {
  describe('Pure math transfer functions & distance curves', () => {
    it('provides smoothstep transition with zero derivatives at bounds', () => {
      expect(smoothstep(0)).toBe(0);
      expect(smoothstep(0.5)).toBe(0.5);
      expect(smoothstep(1)).toBe(1);
      expect(smoothstep(-0.5)).toBe(0);
      expect(smoothstep(1.5)).toBe(1);
    });

    it('0 to 40m (front of stage): dryGain ~ 1.0, lowpassCutoff ~ 20000Hz, wetGain ~ 0.05', () => {
      const at0m = calculateAcoustics(0);
      expect(at0m.dryGain).toBe(1.0);
      expect(at0m.lowpassCutoffHz).toBe(20000);
      expect(at0m.wetGain).toBe(0.05);

      const at20m = calculateAcoustics(20);
      expect(at20m.dryGain).toBe(1.0);
      expect(at20m.lowpassCutoffHz).toBe(20000);
      expect(at20m.wetGain).toBe(0.05);

      const at40m = calculateAcoustics(40);
      expect(at40m.dryGain).toBe(1.0);
      expect(at40m.lowpassCutoffHz).toBe(20000);
      expect(at40m.wetGain).toBe(0.05);
      expect(at40m.reverbDelayMs).toBe(25);
    });

    it('40 to 120m (field): dryGain smooth rolloff, lowpassCutoff ramps down from 20kHz to 5kHz, wetGain ~ 0.15', () => {
      const at40m = calculateAcoustics(40);
      const at80m = calculateAcoustics(80);
      const at120m = calculateAcoustics(120);

      // dryGain smooth rolloff from 1.0 down to ~0.35
      expect(at40m.dryGain).toBe(1.0);
      expect(at80m.dryGain).toBeLessThan(1.0);
      expect(at80m.dryGain).toBeGreaterThan(0.35);
      expect(at120m.dryGain).toBeCloseTo(0.35, 2);

      // lowpassCutoff ramps down from 20000Hz to 5000Hz
      expect(at40m.lowpassCutoffHz).toBe(20000);
      expect(at80m.lowpassCutoffHz).toBe(12500); // exactly halfway in smoothstep
      expect(at120m.lowpassCutoffHz).toBe(5000);

      // wetGain subtle ~ 0.15
      expect(at40m.wetGain).toBe(0.05);
      expect(at80m.wetGain).toBe(0.1);
      expect(at120m.wetGain).toBeCloseTo(0.15, 2);

      // Reverb delay increases
      expect(at120m.reverbDelayMs).toBeCloseTo(65, 1);
    });

    it('120 to 250m (camps / ferris wheel): dryGain drops to ~ 0.1, lowpassCutoff drops to ~ 800Hz, wetGain ~ 0.2', () => {
      const at120m = calculateAcoustics(120);
      const at185m = calculateAcoustics(185);
      const at250m = calculateAcoustics(250);

      // dryGain drops to ~0.10
      expect(at120m.dryGain).toBeCloseTo(0.35, 2);
      expect(at185m.dryGain).toBeCloseTo(0.225, 2);
      expect(at250m.dryGain).toBeCloseTo(0.1, 2);

      // lowpassCutoff drops to ~800Hz (muffled bass/mid)
      expect(at120m.lowpassCutoffHz).toBe(5000);
      expect(at185m.lowpassCutoffHz).toBe(2900);
      expect(at250m.lowpassCutoffHz).toBe(800);

      // wetGain ~ 0.2
      expect(at120m.wetGain).toBeCloseTo(0.15, 2);
      expect(at250m.wetGain).toBeCloseTo(0.2, 2);

      // Delay increases up to ~110ms
      expect(at250m.reverbDelayMs).toBeCloseTo(110, 1);
    });

    it('> 300m: both dryGain and wetGain reach 0.0 (silence), lowpass reaches minimum 400Hz', () => {
      const at300m = calculateAcoustics(300);
      expect(at300m.dryGain).toBe(0.0);
      expect(at300m.wetGain).toBe(0.0);
      expect(at300m.lowpassCutoffHz).toBe(400);

      const at350m = calculateAcoustics(350);
      expect(at350m.dryGain).toBe(0.0);
      expect(at350m.wetGain).toBe(0.0);
      expect(at350m.lowpassCutoffHz).toBe(400);

      const at1000m = calculateAcoustics(1000);
      expect(at1000m.dryGain).toBe(0.0);
      expect(at1000m.wetGain).toBe(0.0);
      expect(at1000m.lowpassCutoffHz).toBe(400);
    });

    it('strictly guarantees monotonic decreasing frequency cutoff and dryGain across whole range', () => {
      let prevCutoff = Infinity;
      let prevDryGain = Infinity;

      for (let dist = 0; dist <= 400; dist += 5) {
        const { dryGain, lowpassCutoffHz, wetGain } = calculateAcoustics(dist);

        // Dry gain must be monotonically non-increasing
        expect(dryGain).toBeLessThanOrEqual(prevDryGain + 1e-9);
        prevDryGain = dryGain;

        // Cutoff must be monotonically non-increasing
        expect(lowpassCutoffHz).toBeLessThanOrEqual(prevCutoff + 1e-9);
        prevCutoff = lowpassCutoffHz;

        // Limiter-safe range assertions
        expect(dryGain).toBeGreaterThanOrEqual(0.0);
        expect(dryGain).toBeLessThanOrEqual(1.0);
        expect(wetGain).toBeGreaterThanOrEqual(0.0);
        expect(wetGain).toBeLessThanOrEqual(1.0);
        expect(lowpassCutoffHz).toBeGreaterThanOrEqual(400);
        expect(lowpassCutoffHz).toBeLessThanOrEqual(20000);
      }
    });

    it('safely handles negative numbers, NaN, and infinity without crashing', () => {
      const neg = calculateAcoustics(-50);
      expect(neg.dryGain).toBe(1.0);
      expect(neg.wetGain).toBe(0.05);

      const nan = calculateAcoustics(NaN);
      expect(nan.dryGain).toBe(1.0);

      const inf = calculateAcoustics(Infinity);
      expect(inf.dryGain).toBe(0.0);
      expect(inf.wetGain).toBe(0.0);
    });
  });

  describe('Stage coordinates and distances', () => {
    it('uses festivalStages.ts coordinates for default main stage', () => {
      expect(DEFAULT_MAIN_STAGE_POSITION.x).toBe(216);
      expect(DEFAULT_MAIN_STAGE_POSITION.z).toBe(18);
    });

    it('provides prompt alternative stage position (0, -180)', () => {
      expect(PROMPT_STAGE_POSITION.x).toBe(0);
      expect(PROMPT_STAGE_POSITION.z).toBe(-180);
    });

    it('calculates 3D and horizontal distances accurately', () => {
      const listener = { x: 216, y: 30, z: 58 }; // 40m south, 30m high
      const stage = DEFAULT_MAIN_STAGE_POSITION;

      const horizDist = calculateHorizontalDistanceToStage(listener, stage);
      expect(horizDist).toBeCloseTo(40, 3);

      const dist3d = calculateDistanceToStage(listener, stage);
      // hypot(0, 30, 40) = 50m
      expect(dist3d).toBeCloseTo(50, 3);
    });

    it('calculates distance to prompt coordinates (0, -180)', () => {
      const listener = { x: 0, y: 0, z: -100 };
      const dist = calculateDistanceToStage(listener, PROMPT_STAGE_POSITION);
      expect(dist).toBeCloseTo(80, 3);
    });
  });

  describe('Directional Stereo Panning', () => {
    const stage = { x: 100, y: 0, z: 0 };

    it('centers audio when listener faces directly towards the stage', () => {
      // Listener at (100, 50), looking North (-Z, yaw = 0) towards stage (100, 0)
      const listener = { x: 100, y: 0, z: 50 };
      const pan = calculateStageStereoPan(listener, 0, stage);
      expect(pan).toBeCloseTo(0.0, 2);
    });

    it('pans right when stage is to the right of listener view', () => {
      // Listener at (50, 0), looking North (-Z, yaw = 0). Stage at (100, 0) is to the East (+X, Right)
      const listener = { x: 50, y: 0, z: 0 };
      const pan = calculateStageStereoPan(listener, 0, stage);
      expect(pan).toBeCloseTo(1.0, 2);
    });

    it('pans left when stage is to the left of listener view', () => {
      // Listener at (150, 0), looking North (-Z, yaw = 0). Stage at (100, 0) is to the West (-X, Left)
      const listener = { x: 150, y: 0, z: 0 };
      const pan = calculateStageStereoPan(listener, 0, stage);
      expect(pan).toBeCloseTo(-1.0, 2);
    });

    it('returns 0 when listener is directly on top of the stage center', () => {
      const pan = calculateStageStereoPan(stage, 0, stage);
      expect(pan).toBe(0.0);
    });
  });

  describe('Web Audio API Node Graph Integration', () => {
    it('creates dual-branch audio nodes with proper connections', () => {
      const { ctx } = createMockAudioContext();
      const graph = new SpatialStageAcousticsGraph({ audioContext: ctx });

      expect(ctx.createGain).toHaveBeenCalled();
      expect(ctx.createBiquadFilter).toHaveBeenCalled();
      expect(ctx.createDelay).toHaveBeenCalled();
      expect(ctx.createStereoPanner).toHaveBeenCalled();

      expect(graph.dryFilter).not.toBeNull();
      expect(graph.wetFilter).not.toBeNull();
      expect(graph.delayNode).not.toBeNull();
      expect(graph.pannerNode).not.toBeNull();
      expect(graph.masterGain).not.toBeNull();
    });

    it('updates audio parameters smoothly when listener moves', () => {
      const { ctx } = createMockAudioContext();
      const graph = new SpatialStageAcousticsGraph({
        audioContext: ctx,
        stagePosition: DEFAULT_MAIN_STAGE_POSITION,
      });

      // Move listener 100m away from stage
      const listenerPos = { x: 216 + 100, y: 0, z: 18 };
      const params = graph.update(listenerPos, 0);

      expect(params.distanceMeters).toBeCloseTo(100, 2);
      expect(params.dryGain).toBeLessThan(1.0);
      expect(params.wetGain).toBeGreaterThan(0.05);

      expect(graph.dryGainNode?.gain.setTargetAtTime).toHaveBeenCalledWith(
        params.dryGain,
        10.0,
        expect.any(Number),
      );
      expect(graph.dryFilter?.frequency.setTargetAtTime).toHaveBeenCalledWith(
        params.lowpassCutoffHz,
        10.0,
        expect.any(Number),
      );
      expect(graph.wetGainNode?.gain.setTargetAtTime).toHaveBeenCalledWith(
        params.wetGain,
        10.0,
        expect.any(Number),
      );
      expect(graph.delayNode?.delayTime.setTargetAtTime).toHaveBeenCalledWith(
        params.reverbDelayMs / 1000,
        10.0,
        expect.any(Number),
      );
    });

    it('adjusts master volume with user volume slider', () => {
      const { ctx } = createMockAudioContext();
      const graph = new SpatialStageAcousticsGraph({ audioContext: ctx, userVolume: 0.8 });

      expect(graph.getUserVolume()).toBe(0.8);

      graph.setUserVolume(0.4);
      expect(graph.getUserVolume()).toBe(0.4);
      expect(graph.masterGain?.gain.setTargetAtTime).toHaveBeenCalledWith(0.4, 10.0, expect.any(Number));
    });

    it('disposes and disconnects all nodes cleanly', () => {
      const { ctx } = createMockAudioContext();
      const graph = new SpatialStageAcousticsGraph({ audioContext: ctx });

      const dryGain = graph.dryGainNode;
      const wetGain = graph.wetGainNode;
      const master = graph.masterGain;

      graph.dispose();

      expect(dryGain?.disconnect).toHaveBeenCalled();
      expect(wetGain?.disconnect).toHaveBeenCalled();
      expect(master?.disconnect).toHaveBeenCalled();

      expect(graph.inputNode).toBeNull();
      expect(graph.masterGain).toBeNull();
    });
  });
});
