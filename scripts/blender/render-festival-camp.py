"""Offline staging-sector layout preview with linked geometry, not a gameplay screenshot."""
import json
import math
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'reports/festival-camp'
data=json.loads((REPORT/'layout.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
library={}
for tent in data['tents']:
    if tent['model'] in library:
        continue
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/game-assets'/tent['asset']))
    imported=set(bpy.context.scene.objects)-before
    # Exported geometry is reused; only LOD0 is shown in this close sector audit.
    unused=[obj for obj in imported if obj.get('tentLodLevel')==1]
    for group in unused:
        for child in list(group.children_recursive):
            imported.discard(child)
            bpy.data.objects.remove(child,do_unlink=True)
        imported.discard(group)
        bpy.data.objects.remove(group,do_unlink=True)
    library[tent['model']]=list(imported)
    for obj in imported:
        obj.hide_render=True

palettes={}
def tinted(source,palette):
    role=source.get('tentFabricRole')
    if role not in ('fly','accent'):
        return source
    key=(source.name,palette)
    if key not in palettes:
        mat=source.copy()
        color=(*data['palettes'][palette][role],1)
        shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        link=shader.inputs['Base Color'].links[0]
        # glTF import represents baseColorFactor as a multiply node.
        factor=link.from_node
        sockets=[s for s in factor.inputs if s.type=='RGBA' and not s.is_linked]
        if factor.type not in ('MIX','MIX_RGB') or not sockets:
            raise RuntimeError(f'Unrecognized glTF color-factor graph: {source.name} {factor.type}')
        sockets[-1].default_value=color
        palettes[key]=mat
    return palettes[key]

for tent in data['tents']:
    if tent['position'][0] < 20 or tent['position'][2] < 20:
        continue
    originals=library[tent['model']]
    copies={obj:obj.copy() for obj in originals}
    root=bpy.data.objects.new(tent['id'],None)
    bpy.context.collection.objects.link(root)
    for source,obj in copies.items():
        bpy.context.collection.objects.link(obj)
        obj.parent=copies.get(source.parent,root)
        obj.hide_render=False
        if obj.type=='MESH':
            # Material slots become per-object so linked mesh data remains unchanged.
            for slot in obj.material_slots:
                original_material=slot.material
                slot.link='OBJECT'
                slot.material=tinted(original_material,tent['palette'])
    root.scale=(tent['scale'],)*3
    root.location=(tent['position'][0],-tent['position'][2],tent['baseY'])
    root.rotation_euler.z=tent['rotationY']

def material(name,color):
    mat=bpy.data.materials.new(name)
    mat.diffuse_color=(*color,1)
    mat.use_nodes=True
    shader=mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value=(*color,1)
    shader.inputs['Roughness'].default_value=.95
    return mat

grass=material('Preview_Ground_Only',(.15,.19,.08))
path=material('Preview_Lanes_Only',(.26,.23,.16))
# Simplified ground is for layout legibility; the game retains its existing grass system.
vertices=[]
for j in range(81):
    for i in range(81):
        x,z=15+i*.5,15+j*.5
        h=.18*math.sin(x*.065)*math.cos(z*.055)+.09*math.sin(x*.19+z*.13)
        vertices.append((x,-z,h))
faces=[(j*81+i,j*81+i+1,(j+1)*81+i+1,(j+1)*81+i) for j in range(80) for i in range(80)]
mesh=bpy.data.meshes.new('PreviewGround')
mesh.from_pydata(vertices,[],faces)
obj=bpy.data.objects.new('PreviewGround',mesh)
bpy.context.collection.objects.link(obj)
mesh.materials.append(grass);mesh.materials.append(path)
for face in mesh.polygons:
    p=face.center
    if any(r['minX']<=p.x<=r['maxX'] and r['minZ']<=-p.y<=r['maxZ'] for r in data['roads']):
        face.material_index=1

scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1280
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('OutdoorPreview')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.75,.9,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.object.light_add(type='SUN',location=(15,-15,30))
bpy.context.object.data.energy=2.0
bpy.context.object.rotation_euler=(.45,-.5,-.5)
bpy.ops.object.camera_add(location=(66,-64,29))
scene.camera=bpy.context.object
scene.camera.rotation_euler=(Vector((35,-35,0))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.type='ORTHO'
scene.camera.data.ortho_scale=47
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(REPORT/'sector-SE.png')
bpy.ops.render.render(write_still=True)
