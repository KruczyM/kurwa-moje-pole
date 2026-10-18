"""Static partner-zone prototypes, metres. Photo-led Pomorze; provisional other zones.

Native geometry/materials only. No external API, copied photographs or runtime lights.
Each root is a separately placeable library entry; geometry is batched by material.
"""
import importlib.util
import json
import math
from pathlib import Path
import bpy

SPEC=importlib.util.spec_from_file_location('tent_tools',Path(__file__).with_name('build-festival-tents.py'))
T=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(T)
U=T.U
ROOT=Path(__file__).resolve().parents[2]
VENDORS=json.loads((ROOT/'src/game/world/festivalVendors.json').read_text(encoding='utf-8'))
OUT=ROOT/'public/game-assets/world/festival/festivalZones.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
maps=U.weave_maps()
white=T.canvas('Zone_White_Canvas',(.83,.82,.78),maps)
black=T.canvas('Zone_Black_Canvas',(.015,.019,.023),maps)
navy=T.canvas('Umbrella_Navy',(.012,.028,.19),maps)
silver=T.canvas('Umbrella_Silver',(.63,.67,.71),maps)
blue=U.material('Container_Blue',(.012,.11,.32),.47)
dark=U.material('Zone_Equipment',(.014,.018,.022),.65)
metal=U.material('Zone_Aluminium',(.42,.46,.5),.32)
metal.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.8
floor=U.material('Zone_Deck',(.12,.11,.095),.86)
letter=U.material('Zone_Lettering',(.9,.9,.86),.65)
red=U.material('Zone_Red',(.67,.012,.025),.5)
yellow=U.material('Zone_Yellow',(.95,.61,.015),.5)
cyan=U.material('Zone_Cyan',(.015,.55,.57),.56)
pink=U.material('Zone_Magenta',(.62,.014,.27),.56)
green=U.material('Zone_Green',(.055,.43,.09),.56)
purple=U.material('Zone_Purple',(.3,.025,.52),.56)
palette=[yellow,pink,cyan,green,purple,red]

def box(name,center,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat);U.cloth_detail_uv(obj,1)
    return obj

def tube(name,a,b,r=.025,mat=metal): return T.tube(name,[a,b],r,mat)

def label(body,location,size,mat=letter):
    curve=bpy.data.curves.new('Label_'+body,'FONT');curve.body=body
    curve.align_x='CENTER';curve.size=size;curve.extrude=.001;curve.resolution_u=2
    font=Path('C:/Windows/Fonts/arialbd.ttf')
    if font.exists(): curve.font=bpy.data.fonts.load(str(font))
    obj=bpy.data.objects.new('Label_'+body,curve);bpy.context.collection.objects.link(obj)
    obj.location=location;obj.rotation_euler.x=math.pi/2;curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');U.cloth_detail_uv(bpy.context.object,1)
    return bpy.context.object

def finish(kind,before,offset):
    root=bpy.data.objects.new('Zone_'+kind,None);bpy.context.collection.objects.link(root)
    root['festivalZone']=kind;root['units']='metres'
    root['referenceStatus']=VENDORS[kind]['appearance'];root['source']=VENDORS[kind]['source']
    groups={}
    for obj in sorted(set(bpy.context.scene.objects)-before,key=lambda o:o.name):
        if obj.type=='MESH': groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    for name,parts in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts: obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        obj=bpy.context.object;obj.name=kind+'_'+name;obj.parent=root
    root.location.x=offset

def container(x,y,z,length):
    box('Container_Shell',(x,y,z+1.3),(length,2.4,2.6),blue)
    # Corrugations are real shallow ribs, including rear and end panels.
    for side in (-1,1):
        for i in range(int(length/.2)):
            xx=x-length/2+.12+i*.2
            box('Container_Rib',(xx,y+side*1.215,z+1.3),(.07,.065,2.3),blue)
        for i in range(11):
            box('End_Rib',(x+side*(length/2+.015),y-1.02+i*.2,z+1.3),(.065,.07,2.3),blue)
    for xx in (x-length/2+.07,x+length/2-.07):
        for yy in (y-1.15,y+1.15):
            box('Container_Corner',(xx,yy,z+1.3),(.12,.12,2.67),blue)
            for zz in (z+.075,z+2.525): box('Corner_Casting',(xx,yy,zz),(.16,.16,.15),metal)

before=set(bpy.context.scene.objects)
# The official photos show blue container stacks, a small black central canopy,
# exposed truss and a colorful white front banner, not another main stage.
for x in (-6.1,6.1):
    for z in (.08,2.73): container(x,.4,z,4.2)
for z in (.08,2.73): container(0,1.25,z,4.1)
box('Stage_Deck',(0,-.6,2.65),(16.6,4.9,.16),floor)
box('Front_Banner',(0,-3.06,1.38),(16.5,.04,2.45),white)
label('Pomorze Zachodnie',(0,-3.092,1.13),1.03,dark)
# Original mesh-based pop-art border. It is not a copied official print/logo.
for i in range(31):
    x=-7.8+i*.52
    mat=palette[i%len(palette)]
    for top in (False,True):
        z=2.45 if top else .32
        points=[(x+.21*math.cos(a*math.tau/16),-3.10,z+.25*math.sin(a*math.tau/16)) for a in range(16)]
        T.mesh('Pop_Art_Petal',points,[tuple(range(16))],mat)
        tube('Ink_Stroke',(x-.13,-3.12,z-.12),(x+.1,-3.12,z+.13),.017,dark)
# Lightweight horizontal box truss, deliberately modest.
for y in (-1.0,-.65):
    for z in (5.38,5.73): tube('Truss_Chord',(-8.25,y,z),(8.25,y,z),.035)
    for i in range(33):
        x=-8.25+i*.5
        tube('Truss_Diagonal',(x,y,5.38),(x+.5,y,5.73),.018)
        tube('Truss_Web',(x,y,5.38),(x,y,5.73),.018)
for x in (-7.8,-5,-2.7,2.7,5,7.8):
    box('Moving_Head',(x,-.95,4.94),(.24,.3,.39),dark)
    tube('Light_Hanger',(x,-.85,5.48),(x,-.85,5.13),.026,dark)
    box('Lens',(x,-1.108,4.86),(.16,.015,.14),yellow)
for x in (-4.35,4.35):
    for z in (3.92,4.2,4.48): box('Line_Array',(x,-1.2,z),(.58,.47,.25),dark)
for x in (-1.65,1.65):
    for y in (-1.7,1.45): tube('Canopy_Post',(x,y,2.74),(x,y,5.71),.035,dark)
for side in (-1,1):
    T.quad('Black_Canopy',[(0,-1.85,6.38),(side*1.82,-1.85,5.72),(side*1.82,1.62,5.72),(0,1.62,6.38)],black)
box('DJ_Booth',(0,-1.56,3.3),(2.65,.66,1.12),dark)
label('Pomorze',(0,-1.91,3.46),.37)
label('Zachodnie',(0,-1.91,3.03),.35)
for x in (-.8,.8):
    box('Mixer',(x,-1.51,3.91),(.58,.42,.09),metal)
finish('pomorze',before,0)

before=set(bpy.context.scene.objects)
# Six grounded arms and high scalloped openings, from user references 1 and 25.
# Native estimated dimensions: 11 m between opposite anchors, 5.7 m apex.
star=T.canvas('RedBull_Star_Canvas',(.008,.045,.36),maps)
box('Star_Mast_Base',(0,0,.1),(.5,.5,.2),dark)
tube('Star_Centre_Mast',(0,0,.12),(0,0,5.71),.075)
def star_point(angle,t):
    u=(angle%(math.tau/6))/(math.tau/6)
    arch=max(0,math.sin(math.pi*u))
    radius=5.5-2*arch
    edge=.045+2.65*arch**.8
    r=radius*t
    z=5.7*(1-t)**1.3+edge*t
    return (r*math.cos(angle),r*math.sin(angle),z)
for segment in range(6):
    a0=segment*math.tau/6
    points=[star_point(a0+math.tau/6*i/24,.003+.997*j/24) for j in range(25) for i in range(25)]
    T.mesh('Star_Tension_Panel',points,[(j*25+i,j*25+i+1,(j+1)*25+i+1,(j+1)*25+i) for j in range(24) for i in range(24)],star,True,density=2)
    T.tube('Star_Sewn_Hem',[points[24*25+i] for i in range(25)],.015,navy)
    T.tube('Star_Radial_Seam',[points[j*25] for j in range(25)],.01,navy)
    x,y,_=star_point(a0,1)
    box('Star_Anchor',(x,y,.035),(.13,.13,.06),metal)
    tube('Star_Peg',(x,y,.025),(x,y,.14),.012,dark)
# Cover the small polar opening around the central mast.
T.mesh('Star_Apex_Cap',[(0,0,5.72)]+[star_point(i*math.tau/24,.006) for i in range(24)],
       [(0,i+1,(i+1)%24+1) for i in range(24)],star,True)
# Native lettering follows the actual cloth surface, without embedding a photograph.
sign=label('Red Bull',(0,-2.65,0),.62,red)
sign.rotation_euler.x=0
bpy.context.view_layer.update()
transform=sign.matrix_world.copy()
for vertex in sign.data.vertices:
    point=transform @ vertex.co
    angle=math.atan2(point.y,point.x)
    u=(angle%(math.tau/6))/(math.tau/6)
    radius=5.5-2*max(0,math.sin(math.pi*u))
    point.z=star_point(angle,math.hypot(point.x,point.y)/radius)[2]+.018
    vertex.co=point
sign.location=(0,0,0)
U.cloth_detail_uv(sign,1)
box('Sales_Counter',(0,-1.3,.61),(3.7,.85,1.22),navy)
box('Counter_Top',(0,-1.3,1.24),(3.86,1.0,.08),metal)
box('Brand_Panel',(0,-1.74,.72),(2.4,.02,.75),silver)
label('Red Bull',(0,-1.761,.64),.42,red)
for x in (-1.4,1.4):
    box('Cooler',(x,.95,.64),(.7,.65,1.2),navy)
    box('Cooler_Door',(x,.61,.68),(.59,.025,.9),silver)
for i in range(8):
    x=-.95+i*.27
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.038,depth=.16,location=(x,-1.3,1.37))
    obj=bpy.context.object;obj.name='Drink_Can';obj.data.materials.append(silver);U.cloth_detail_uv(obj,1)
finish('redBull',before,23)

before=set(bpy.context.scene.objects)
# Exterior-only placeholder village. Presence supported; architecture NOT verified.
box('Village_Platform',(0,0,.08),(8.8,5.5,.16),floor)
for index,x in enumerate((-2.25,2.25)):
    accent=cyan if index==0 else purple
    box('Kiosk_Rear',(x,2.15,1.65),(4,.12,3),white)
    for xx in (x-1.95,x+1.95):
        box('Kiosk_Side',(xx,.5,1.65),(.1,3.4,3),white)
    box('Kiosk_Roof',(x,.5,3.22),(4.15,3.6,.18),accent)
    box('Kiosk_Counter',(x,-1.05,.69),(3.65,.68,1.05),white)
    box('Kiosk_Counter_Top',(x,-1.05,1.26),(3.8,.8,.1),dark)
    box('Kiosk_Header',(x,-1.34,2.79),(4.05,.12,.68),accent)
    label('IQOS' if index==0 else 'STREFA 18+',(x,-1.414,2.64),.39)
    # No product offers, prices, rewards, or nicotine sales interactions.
    label('18+',(x,2.071,1.8),.3,dark)
for x in (-4.05,4.05):
    tube('Village_Rail',(x,-2.4,.2),(x,-2.4,1.0),.035)
    tube('Village_Rail',(x,-2.4,1.0),(x,2.5,1.0),.035)
finish('iqos',before,38)
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False)
U.finalize_gltf(OUT)
print('FESTIVAL_ZONES',OUT.stat().st_size)
