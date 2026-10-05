"""Export a clean labelled mineral-water bottle from our original Blender PET model."""
from pathlib import Path
import math
import bpy

ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/game-assets/world/festival/eco-pickups.glb'))
bottle=bpy.data.objects.get('EcoBottle')
if bottle is None: raise RuntimeError('Build eco-pickups.glb first')
bottle.parent=None;bottle.location=(0,0,0);bottle.name='MineralWaterBottle'
for vertex in bottle.data.vertices:
    if vertex.co.z < .025: vertex.co.z=0
for obj in list(bpy.data.objects):
    if obj!=bottle: bpy.data.objects.remove(obj,do_unlink=True)

ink=bpy.data.materials.new('Water_Label_Ink');ink.diffuse_color=(.015,.08,.24,1)
ink.use_nodes=True;bsdf=ink.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(.015,.08,.24,1)
bsdf.inputs['Roughness'].default_value=.7
bpy.ops.object.text_add(location=(0,-.116,.252),rotation=(math.pi/2,0,0))
label=bpy.context.object;label.name='Woda_label';label.data.body='WODA'
label.data.align_x='CENTER';label.data.align_y='CENTER';label.data.size=.048
label.data.extrude=.0003;label.data.materials.append(ink)
bpy.ops.object.convert(target='MESH');label=bpy.context.object;label.parent=bottle
bottle['itemId']='water';bottle['authoring']='Original local geometry, no third-party model or brand'
OUT=ROOT/'public/game-assets/interactables/water.glb';OUT.parent.mkdir(parents=True,exist_ok=True)
(ROOT/'blender').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/mineral-water.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False)
print('MINERAL_WATER_BYTES',OUT.stat().st_size)
