/** Shared by runtime grounding, terrain geometry and offline asset QA. */
export function terrainHeight(x: number, z: number): number {
  return 0.18 * Math.sin(x * 0.065) * Math.cos(z * 0.055) + 0.09 * Math.sin(x * 0.19 + z * 0.13);
}
