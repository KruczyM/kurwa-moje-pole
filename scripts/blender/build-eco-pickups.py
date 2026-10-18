"""Original small festival props; Blender 5.2, one vertex-colour material, no textures."""
from pathlib import Path
import math, random
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/game-assets/world/festival/eco-pickups.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
material=bpy.data.materials.new('Eco_Vertex_Palette');material.use_nodes=True
bsdf=material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.58
vertex=material.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color'
material.node_tree.links.new(vertex.outputs['Color'],bsdf.inputs['Base Color'])
parts=[]

def paint(obj,color,smooth=True):
    obj.data.materials.clear();obj.data.materials.append(material)
    attr=obj.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for item in attr.data: item.color=(*color,1)
    for face in obj.data.polygons: face.use_smooth=smooth
    parts.append(obj);return obj

def uv(name,loc,scale,color):
    detail=name in ('Sesame','Sprinkle')
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8 if detail else 16,ring_count=4 if detail else 8,location=loc)
    obj=bpy.context.object;obj.name=name;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return paint(obj,color)

def cyl(name,loc,radius,depth,color,radius2=None):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=depth,location=loc)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=radius,radius2=radius2,depth=depth,location=loc)
    obj=bpy.context.object;obj.name=name
    bevel=obj.modifiers.new('Rounded_edges','BEVEL');bevel.width=.008;bevel.segments=2
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=bevel.name)
    return paint(obj,color)

def ring(loc,major,minor,color,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=loc,major_radius=major,minor_radius=minor,rotation=rotation)
    return paint(bpy.context.object,color)

def box(loc,scale,color,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc,rotation=rotation)
    obj=bpy.context.object;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('Soft_corners','BEVEL');bevel.width=.015;bevel.segments=2
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return paint(obj,color)

def finish(name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts: obj.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
    obj=bpy.context.object;obj.name=name
    bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    # Exactly floor-grounded, centered XY; glTF export converts Blender Z-up to Y-up.
    low=min(v.co.z for v in obj.data.vertices)
    for vertex in obj.data.vertices: vertex.co.z-=low
    obj['ecoModel']=name;obj['authoring']='Original local Blender geometry; vertex colors, no external assets'
    parts.clear()

# Crushed can: metal rims, pull-tab and a two-tone wrapping label.
body=cyl('Dented_can',(0,0,.19),.115,.36,(.12,.48,.18))
for v in body.data.vertices:
    v.co.x*=.88+.1*math.sin(v.co.z*21+v.co.y*9)
cyl('Label_band',(0,0,.20),.118,.13,(.92,.73,.10))
cyl('Top',(0,0,.375),.11,.013,(.62,.65,.68));ring((0,0,.382),.104,.008,(.8,.83,.85))
ring((0,0,.393),.026,.009,(.18,.21,.23));ring((0,0,.018),.106,.007,(.7,.72,.74))
finish('EcoCan')

# Ribbed PET bottle, tilted onto its side on the grass.
uv('PET',(0,0,.24),(.11,.11,.23),(.15,.51,.45))
for z in (.11,.16,.30,.35):ring((0,0,z),.105,.009,(.24,.64,.55))
cyl('Shoulder',(0,0,.45),.085,.12,(.15,.51,.45),.038)
cyl('Cap',(0,0,.52),.043,.045,(.13,.27,.66))
cyl('Paper_label',(0,0,.235),.113,.095,(.88,.91,.82))
finish('EcoBottle')

# Crumpled paper with deterministic uneven folds.
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(0,0,.09))
obj=bpy.context.object;rng=random.Random(611)
for v in obj.data.vertices:
    v.co*=rng.uniform(.78,1.08);v.co.x*=.22;v.co.y*=.17;v.co.z*=.085
paint(obj,(.89,.86,.73),False)
finish('EcoPaper')

# Tied recycling sack and folded neck.
uv('Bag',(0,0,.26),(.25,.22,.27),(.13,.21,.19))
cyl('Tied_neck',(0,0,.55),.075,.1,(.16,.26,.21),.03)
uv('Knot',(0,0,.60),(.07,.04,.025),(.37,.61,.26))
box((.045,0,.655),(.12,.055,.12),(.16,.26,.21),(0,.55,0))
box((-.045,0,.655),(.12,.055,.12),(.16,.26,.21),(0,-.55,0))
finish('EcoBag')

# Speed bonus: recognizable waffle cone, strawberry/pistachio scoops and sprinkles.
cyl('Waffle_cone',(0,0,.23),.025,.44,(.67,.36,.13),.18)
for z in (.10,.18,.26,.34,.42):ring((0,0,z),.025+(.18-.025)*(z-.01)/.44,.007,(.86,.56,.26))
uv('Strawberry_scoop',(0,0,.54),(.22,.22,.19),(.94,.29,.45))
uv('Pistachio_scoop',(.025,0,.77),(.19,.19,.18),(.48,.78,.22))
for i in range(12):
    angle=i*math.tau/12
    uv('Sprinkle',(.025+math.cos(angle)*.14,math.sin(angle)*.14,.86),(.018,.008,.006),(.96,.78,.14))
finish('EcoIceCream')

# Score bonus: sesame hamburger, rounded bun, lettuce, cheese, patty and tomato.
uv('Bottom_bun',(0,0,.075),(.28,.27,.075),(.69,.34,.09))
cyl('Patty',(0,0,.17),.265,.09,(.20,.07,.028))
box((0,0,.228),(.48,.48,.033),(.96,.66,.08),(0,0,.3))
cyl('Tomato',(0,0,.266),.235,.038,(.78,.07,.035))
for i in range(8):
    angle=i*math.tau/8
    uv('Lettuce',(math.cos(angle)*.18,math.sin(angle)*.18,.303),(.12,.10,.032),(.25,.57,.09))
uv('Top_bun',(0,0,.405),(.29,.28,.12),(.83,.46,.13))
for i in range(18):
    angle=i*2.39996;r=.20*math.sqrt((i+.5)/18)
    z=.405+.12*math.sqrt(1-(r/.29)**2)
    seed=uv('Sesame',(math.cos(angle)*r,math.sin(angle)*r,z),(.016,.007,.004),(.96,.86,.53))
    seed.rotation_euler.z=angle
finish('EcoBurger')

OUT.parent.mkdir(parents=True,exist_ok=True)
(ROOT/'blender').mkdir(parents=True,exist_ok=True)
models=list(bpy.context.scene.objects)
for i,obj in enumerate(models): obj.location=(i%3*1.2,i//3*1.2,0)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'blender/eco-pickups.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False)
print('ECO_PICKUPS',OUT.stat().st_size)

# Offline preview only; lights/camera are not exported to the runtime pack.
bpy.ops.object.camera_add(location=(3.8,-4.5,4.2))
camera=bpy.context.object;camera.rotation_euler=(Vector((1.2,.6,.3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=4.5;bpy.context.scene.camera=camera
for loc,power,size in [((1,-2,5),550,4),((-2,2,3),350,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size
    light.rotation_euler=(Vector((1.2,.6,0))-light.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16
scene.world=bpy.data.worlds.new('PreviewWorld');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.16,.21,1)
scene.render.resolution_x=900;scene.render.resolution_y=650;scene.render.resolution_percentage=100
preview=ROOT/'reports/eco-models';preview.mkdir(parents=True,exist_ok=True)
scene.render.filepath=str(preview/'blender-preview.png');bpy.ops.render.render(write_still=True)
