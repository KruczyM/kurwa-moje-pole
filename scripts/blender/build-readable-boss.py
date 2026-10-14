"""Rig the existing authored boss mesh locally, using the established Bongo rig and walk cycle."""
import importlib.util
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('patrols',ROOT/'scripts/blender/build-bongo-patrols.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'source-assets/bongo-rush/models/owsiak-textured.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for mesh in meshes:
    matrix=mesh.matrix_world.copy();mesh.parent=None;mesh.matrix_world=Matrix.Identity(4);mesh.data.transform(matrix)
points=[v.co.copy() for mesh in meshes for v in mesh.data.vertices]
low=Vector(tuple(min(p[i] for p in points) for i in range(3)))
high=Vector(tuple(max(p[i] for p in points) for i in range(3)))
center=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z));factor=2.45/(high.z-low.z)
for mesh in meshes:
    for v in mesh.data.vertices:v.co=(v.co-center)*factor
    mesh.data.update()
rig,repaired=m.make_rig(meshes);m.animate(rig)
out=ROOT/'source-assets/bongo-rush/models-v5/owsiak';out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out/'npc-animations.glb'),export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',export_force_sampling=True)
