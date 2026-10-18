/** Shared by runtime grounding, terrain geometry and offline asset QA. */
export function terrainHeight(_x: number, _z: number): number {
  void _x;
  void _z;
  // Flat airfield: level camping parcels, road and identical GPU grass ground height.
  return 0;
}
