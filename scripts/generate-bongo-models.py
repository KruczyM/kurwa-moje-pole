"""Generate local draft geometry from the authored references, using cached Hunyuan weights only.

Run with Hunyuan's venv Python; pass --runtime to its checkout. No API keys or model downloads.
These are unrigged source meshes, not a promise of production-ready animated characters.
"""
import argparse
import os
import sys
from pathlib import Path


def main():
    """Reuse Hunyuan's profile-2 offloading on the local 8GB GPU and preserve every source reference."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--paint', action='store_true', help='Texture existing geometry with local cached Paint weights')
    args = parser.parse_args()
    os.environ['HF_HUB_OFFLINE'] = '1'
    os.environ['TRANSFORMERS_OFFLINE'] = '1'
    sys.path.insert(0, str(args.runtime.resolve()))
    import torch
    from PIL import Image
    from mmgp import offload
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline

    root = Path(__file__).resolve().parents[1]
    output = root / 'source-assets/bongo-rush/models'
    output.mkdir(parents=True, exist_ok=True)
    torch.set_default_device('cpu')
    if args.paint:
        import trimesh
        from hy3dgen.texgen import Hunyuan3DPaintPipeline
        from hy3dgen.shapegen import FaceReducer
        painter = Hunyuan3DPaintPipeline.from_pretrained('tencent/Hunyuan3D-2')
        painter.models['multiview_model'].pipeline.vae.use_slicing = True
        offload.profile(offload.extract_models('paint', painter), profile_no=2,
                        budgets={'*': 2200}, verboseLevel=1)
        for name in ['owsiak', 'patrol']:
            target = output / f'{name}-textured.glb'
            if target.exists():
                print(f'PRESERVED {target}', flush=True)
                continue
            mesh = trimesh.load(output / f'{name}-draft.glb', force='mesh')
            mesh = FaceReducer()(mesh)
            image = Image.open(root / f'source-assets/bongo-rush/references/{name}-front.png').convert('RGBA')
            painted = painter(mesh, image)
            painted.export(str(target))
            print(f'MODEL_TEXTURED {name} -> {target}', flush=True)
        return
    pipeline = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        'tencent/Hunyuan3D-2mini', subfolder='hunyuan3d-dit-v2-mini-turbo', device='cpu')
    pipeline.enable_flashvdm(mc_algo='mc')
    # Same execution-device override as the local Gradio app, isolated to this instance.
    runtime_class = type('LocalBongoPipeline', (type(pipeline),), {
        '_execution_device': property(lambda self: torch.device('cuda'))})
    pipeline.__class__ = runtime_class
    offload.profile(offload.extract_models('shape', pipeline), profile_no=2,
                    pinnedMemory='shape/model', budgets={'*': 2200}, verboseLevel=1)
    for name in ['owsiak', 'patrol']:
        target = output / f'{name}-draft.glb'
        if target.exists():
            print(f'PRESERVED {target}', flush=True)
            continue
        image = Image.open(root / f'source-assets/bongo-rush/references/{name}-front.png').convert('RGBA')
        meshes = pipeline(image=image, num_inference_steps=8, guidance_scale=5.5,
                          generator=torch.Generator().manual_seed(20261011),
                          octree_resolution=256, num_chunks=8000, output_type='trimesh')
        mesh = meshes[0]
        if not len(mesh.vertices) or not len(mesh.faces):
            raise RuntimeError(f'{name}: empty generated geometry')
        mesh.export(str(target))
        print(f'MODEL_DRAFT {name}: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces -> {target}', flush=True)


if __name__ == '__main__':
    main()
