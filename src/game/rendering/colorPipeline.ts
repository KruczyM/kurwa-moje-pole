import * as THREE from 'three';

export type ColorPipeline = 'world' | 'characterPreview' | 'itemInspect';

export const COLOR_PIPELINE_EXPOSURE: Record<ColorPipeline, number> = {
  world: 1.1,
  characterPreview: 1.35,
  itemInspect: 1.2,
};

type RendererColorTarget = Pick<
  THREE.WebGLRenderer,
  'outputColorSpace' | 'toneMapping' | 'toneMappingExposure'
>;

/** Ujednolica sRGB, ACES i ekspozycję we wszystkich rendererach aplikacji. */
export function configureColorPipeline(renderer: RendererColorTarget, pipeline: ColorPipeline) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = COLOR_PIPELINE_EXPOSURE[pipeline];
}
