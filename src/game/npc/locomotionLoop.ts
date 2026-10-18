import * as THREE from 'three';
import { resolveCanonicalAnimationName } from '../animation/animationContract';

/** Close mismatched locomotion endpoints over a short tail, without changing
 * source clips, duration, or one-shots. Run after removing root displacement. */
export function closeLocomotionLoop(clip: THREE.AnimationClip): THREE.AnimationClip {
  const name = resolveCanonicalAnimationName(clip.name);
  if ((name !== 'Walk' && name !== 'Run') || clip.duration <= 0) return clip;
  const window = Math.min(0.12, clip.duration * 0.2);
  const start = clip.duration - window;
  let changed = false;
  const tracks = clip.tracks.map((track) => {
    const quaternion = track instanceof THREE.QuaternionKeyframeTrack;
    if (!quaternion && !(track instanceof THREE.VectorKeyframeTrack)) return track;
    if (track.times.length < 2 || track.getInterpolation() !== THREE.InterpolateLinear) return track;
    const size = track.getValueSize();
    const sample = track.InterpolantFactoryMethodLinear(new Float32Array(size));
    const first = Array.from(sample.evaluate(0));
    const last = Array.from(sample.evaluate(clip.duration));
    const firstRotation = new THREE.Quaternion();
    if (quaternion) firstRotation.fromArray(first).normalize();
    const mismatch = quaternion
      ? 1 - Math.abs(firstRotation.dot(new THREE.Quaternion().fromArray(last).normalize()))
      : Math.max(...first.map((value, index) => Math.abs(value - last[index])));
    if (mismatch < 1e-7) return track;
    const tailSamples = [0, 0.25, 0.5, 0.75, 1].map((fraction) => start + window * fraction);
    // KeyframeTrack stores float32 times: deduplicate after that conversion.
    const times = [...new Set([...track.times, ...tailSamples, clip.duration].map(Math.fround))].sort(
      (a, b) => a - b,
    );
    const values: number[] = [];
    for (const time of times) {
      const value = Array.from(sample.evaluate(time));
      const fraction =
        time >= Math.fround(clip.duration) ? 1 : THREE.MathUtils.clamp((time - start) / window, 0, 1);
      const blend = fraction * fraction * (3 - 2 * fraction);
      if (quaternion) {
        values.push(
          ...new THREE.Quaternion().fromArray(value).normalize().slerp(firstRotation, blend).toArray(),
        );
      } else {
        values.push(...value.map((component, index) => THREE.MathUtils.lerp(component, first[index], blend)));
      }
    }
    const result = track.clone();
    result.times = new Float32Array(times);
    result.values = new Float32Array(values);
    changed = true;
    return result;
  });
  return changed ? new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode) : clip;
}
