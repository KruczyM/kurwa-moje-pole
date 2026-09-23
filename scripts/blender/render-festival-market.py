"""Offline layout QA from exported runtime transforms, not a gameplay screenshot."""
import json
from pathlib import Path
import bpy
from mathutils import Vector, Quaternion

ROOT=Path(__file__).resolve().parents[2]
REPORT=ROOT/'reports/festival-market'
data=json.loads((REPORT/'layout.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/game-assets'/data['asset']))
templates={o.get('marketVariant'):o for o in bpy.context.scene.objects if o.get('marketVariant')}
for obj in bpy.context.scene.objects: obj.hide_render=True
for stall in data['stalls']:
    source=templates[stall['variant']]
    originals=[source]+list(source.children_recursive)
    copies={obj:obj.copy() for obj in originals}
    for old,obj in copies.items():
        bpy.context.collection.objects.link(obj)
        obj.parent=copies.get(old.parent)
        obj.hide_render=False
    root=copies[source];root.name=stall['id']
    x,y,z=stall['position'];root.location=(x,-z,y)
    # Imported GLB roots use quaternions; editing Euler angles alone has no effect.
    root.rotation_mode='QUATERNION'
    root.rotation_quaternion=Quaternion((0,0,1),stall['rotationY']) @ source.rotation_quaternion

def geometry(name,points,faces,material):
    mesh=bpy.data.meshes.new(name)
    mesh.from_pydata([(p[0],-p[2],p[1]) for p in points],[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    mesh.materials.append(material)
    return obj

road=data['road'];positions=road['positions'];indices=road['indices']
obj=geometry('Runtime_Paved_Lane',[positions[i:i+3] for i in range(0,len(positions),3)],
             [indices[i:i+3] for i in range(0,len(indices),3)],bpy.data.materials['Market_Concrete'])
uv=obj.data.uv_layers.new(name='UVMap')
for loop in obj.data.loops: uv.data[loop.index].uv=road['uv'][loop.vertex_index*2:loop.vertex_index*2+2]
ground=bpy.data.materials.new('Inspection_Ground');ground.use_nodes=True
shader=ground.node_tree.nodes['Principled BSDF']
shader.inputs['Base Color'].default_value=(.16,.2,.08,1);shader.inputs['Roughness'].default_value=.95
columns=data['groundColumns'];rows=len(data['ground'])//columns
geometry('Inspection_Ground',data['ground'],[(j*columns+i,j*columns+i+1,(j+1)*columns+i+1,(j+1)*columns+i) for j in range(rows-1) for i in range(columns-1)],ground)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('InspectionSky');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.74,.88,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.object.light_add(type='SUN',location=(-20,-20,30))
bpy.context.object.data.energy=2;bpy.context.object.rotation_euler=(.5,-.5,-.5)
bpy.ops.object.camera_add(location=(-3,45,37))
scene.camera=bpy.context.object
scene.camera.rotation_euler=(Vector((-41,0,1.8))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=76
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(REPORT/'passage.png')
bpy.ops.render.render(write_still=True)
