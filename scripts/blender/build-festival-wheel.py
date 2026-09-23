"""Original animated-wheel prototype from user reference photos; dimensions estimated.

Local geometry only. Does not assert the exact 2026 wheel size or gondola count.
Rotor/gondola pivots are exported for the existing game update loop.
"""
import importlib.util
import math
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

SPEC=importlib.util.spec_from_file_location('tent_tools',Path(__file__).with_name('build-festival-tents.py'))
T=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(T)
U=T.U
OUT=Path(__file__).resolve().parents[2]/'public/game-assets/world/festival/allegroWheel.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)

white=U.material('Wheel_Painted_Steel',(.72,.73,.7),.42)
white.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.3
orange=U.material('Wheel_Orange',(.95,.15,.015),.58)
dark=U.material('Wheel_Deck',(.08,.09,.095),.82)
chrome=U.material('Wheel_Axle',(.32,.35,.36),.3)
chrome.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.85
sign=U.material('Wheel_White_Lettering',(.92,.92,.9),.78)
# Small deterministic paint-grain tile: neutral albedo plus scalar roughness.
# No lighting baked into the map; the exported base factor retains each paint colour.
rng=np.random.default_rng(2026)
grain=rng.random((128,128))
pixels=np.ones((128,128,4))
pixels[:,:,:3]=(.97+.025*grain)[:,:,None]
paint_color=U.image_data('Wheel_Paint_Grain_Color',pixels)
pixels[:,:,:3]=(.4+.1*grain)[:,:,None]
paint_roughness=U.image_data('Wheel_Paint_Grain_Roughness',pixels)
for mat in (white,orange):
    shader=mat.node_tree.nodes['Principled BSDF']
    mat['tentBaseColorLinear']=list(shader.inputs['Base Color'].default_value[:3])
    for data,socket in ((paint_color,'Base Color'),(paint_roughness,'Roughness')):
        node=U.texture_node(mat,data,'TentDetail')
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs[socket])
leds=[]
for index,color in enumerate(((1,.045,.015),(1,.36,.015),(.65,1,.035),(.035,.8,.24),(.02,.3,1),(.45,.045,1))):
    mat=U.material(f'Wheel_LED_{index}',color,.4)
    node=mat.node_tree.nodes['Principled BSDF']
    node.inputs['Emission Color'].default_value=(*color,1)
    node.inputs['Emission Strength'].default_value=2.5
    leds.append(mat)

def empty(name,role=None):
    obj=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(obj)
    if role: obj['wheelPart']=role
    return obj

def box(name,center,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object
    obj.name=name
    obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    U.cloth_detail_uv(obj,1)
    return obj

def rod(name,a,b,r,mat,sides=8):
    a,b=Vector(a),Vector(b)
    axis=(b-a).normalized()
    tangent=axis.cross(Vector((0,1,0)))
    if tangent.length < .01: tangent=axis.cross(Vector((1,0,0)))
    tangent.normalize()
    bitangent=axis.cross(tangent)
    points=[tuple(p+r*(tangent*math.cos(i*math.tau/sides)+bitangent*math.sin(i*math.tau/sides))) for p in (a,b) for i in range(sides)]
    faces=[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    faces += [tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
    return T.mesh(name,points,faces,mat,True,density=1)

def batch(objects,parent,prefix):
    groups={}
    for obj in sorted(objects,key=lambda obj:obj.name):
        if obj.type=='MESH': groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for mat,parts in sorted(groups.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts: obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=prefix+'_'+mat
        obj.parent=parent

root=empty('Allegro_Wheel_Prototype')
root['festivalLandmark']='allegroWheel'
root['referenceStatus']='User photographs; estimated dimensions and 24 gondolas; not surveyed 2026 geometry'
root['units']='metres'
root['wheelRadius']=15.0
root['wheelHubHeight']=18.0
root['wheelGondolaCount']=24

before=set(bpy.context.scene.objects)
box('Deck',(0,0,.25),(18,10,.4),dark)
for y in (-4,4):
    for x in (-7,7):
        box('Outrigger',(x,y,.5),(2.5,1.7,.12),chrome)
        rod('Support',(x,y,.55),(0,math.copysign(1.45,y),18),.23,white,12)
    rod('Support_Tie',(-7,y,.8),(7,y,.8),.14,white)
rod('Axle',(0,-1.7,18),(0,1.7,18),.38,chrome,16)
for side in (-1,1):
    for i in range(10):
        x=-9+i*2
        if abs(x)<2: continue
        rod('Fence_Post',(x,side*5,.45),(x,side*5,1.65),.035,white)
    for lo,hi in ((-9,-2),(2,9)):
        box('Orange_Fence',((lo+hi)/2,side*5,1),(hi-lo,.06,1),orange)
for x in (-9,9):
    box('Side_Fence',(x,0,1),(.06,10,1),orange)
# Boarding gate sign is deliberately an original text approximation.
box('Sign_Board',(0,-5.2,2.4),(6,.09,1.15),orange)
for x in (-2.7,2.7): rod('Sign_Post',(x,-5.2,.45),(x,-5.2,2.95),.045,white)
curve=bpy.data.curves.new('Allegro_Lettering','FONT')
curve.body='allegro';curve.size=.94;curve.align_x='CENTER';curve.extrude=.002;curve.resolution_u=4
font=Path('C:/Windows/Fonts/arial.ttf')
if font.exists(): curve.font=bpy.data.fonts.load(str(font))
obj=bpy.data.objects.new('Allegro_Lettering',curve)
bpy.context.collection.objects.link(obj)
obj.location=(0,-5.26,2.1);obj.rotation_euler.x=math.pi/2;curve.materials.append(sign)
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.object.convert(target='MESH');U.cloth_detail_uv(bpy.context.object,1)
batch(set(bpy.context.scene.objects)-before,root,'Static')

rotor=empty('Wheel_Rotor','rotor')
rotor.parent=root
before=set(bpy.context.scene.objects)
def circle(radius,angle,y): return (radius*math.sin(angle),y,radius*math.cos(angle))
for y in (-.85,.85):
    for i in range(96):
        a,b=i*math.tau/96,(i+1)*math.tau/96
        for r in (15,14.45): rod('Rim',circle(r,a,y),circle(r,b,y),.075,white)
        rod('Rim_LED',circle(15.025,a,y+math.copysign(.09,y)),circle(15.025,b,y+math.copysign(.09,y)),.024,leds[i//16],6)
    for i in range(24):
        a=i*math.tau/24
        rod('Spoke',circle(.52,a,y),circle(15,a,y),.045,white)
        rod('Spoke_LED',circle(.9,a,y+math.copysign(.06,y)),circle(14.3,a,y+math.copysign(.06,y)),.018,leds[i%6],6)
        rod('Spoke_Diagonal',circle(2,a,y),circle(14.45,a+math.tau/24,y),.023,white,6)
for i in range(24):
    a=i*math.tau/24
    rod('Rim_Cross_Brace',circle(15,a,-.85),circle(15,a,.85),.055,white)
    rod('Rim_Diagonal',circle(14.45,a,-.85),circle(14.45,a+math.tau/24,.85),.035,white,6)
rod('Hub',(0,-1.1,0),(0,1.1,0),.65,orange,24)
batch(set(bpy.context.scene.objects)-before,rotor,'Rotating')
rotor.location.z=18

# One shared two-material gondola geometry, copied at all pivots without unique textures.
gondola=empty('Wheel_Gondola_00','gondola')
gondola['gondolaIndex']=0
gondola.parent=rotor
before=set(bpy.context.scene.objects)
rod('Hanger',(0,0,0),(0,0,-.42),.045,white)
box('Canopy',(0,0,-.46),(1.7,1.3,.13),orange)
box('Basket_Floor',(0,0,-2.05),(1.6,1.2,.16),orange)
box('Seat',(0,.3,-1.64),(1.4,.45,.1),orange)
for x in (-.72,.72):
    for y in (-.52,.52): rod('Cabin_Post',(x,y,-.5),(x,y,-2.0),.035,white)
    box('Basket_Side',(x,0,-1.85),(.055,1.15,.35),orange)
for y in (-.55,.55):
    box('Basket_End',(0,y,-1.85),(1.4,.055,.35),orange)
    for z in (-1.5,-1.17): rod('Safety_Rail',(-.72,y,z),(.72,y,z),.027,white)
for x in (-.72,.72): rod('Safety_Rail',(x,-.55,-1.17),(x,.55,-1.17),.027,white)
batch(set(bpy.context.scene.objects)-before,gondola,'Cabin')
gondola.location=(0,0,15)
for i in range(1,24):
    target=empty(f'Wheel_Gondola_{i:02d}','gondola')
    target['gondolaIndex']=i;target.parent=rotor
    target.location=circle(15,i*math.tau/24,0)
    for child in gondola.children:
        copy=child.copy();copy.data=child.data
        bpy.context.collection.objects.link(copy);copy.parent=target

OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False)
U.finalize_gltf(OUT)
print('FESTIVAL_WHEEL',OUT.stat().st_size)
