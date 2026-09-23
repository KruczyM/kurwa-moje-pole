"""White modular market stalls, inspired by the user's passage photo.

Generic categories plus confirmed SiemaShop presence; dimensions/position provisional.
One GLB library with shared structural meshes, no external image services.
"""
import importlib.util
import json
import math
from pathlib import Path
import bpy
import numpy as np

SPEC=importlib.util.spec_from_file_location('tent_tools',Path(__file__).with_name('build-festival-tents.py'))
T=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(T)
U=T.U
OUT=Path(__file__).resolve().parents[2]/'public/game-assets/world/festival/marketStalls.glb'
VENDORS=json.loads((Path(__file__).resolve().parents[2]/'src/game/world/festivalVendors.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
maps=U.weave_maps()
cloth=T.canvas('Market_White_Canvas',(.8,.79,.73),maps)
metal=U.material('Market_Aluminium',(.35,.38,.4),.35)
metal.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value=.65
floor=U.material('Market_Floor',(.14,.12,.085),.88)
wood=U.material('Market_Counter',(.36,.22,.095),.8)
dark=U.material('Market_Dark_Equipment',(.025,.03,.035),.58)
white=U.material('Market_Lettering',(.92,.89,.8),.85)
colors=[T.canvas('Market_Fabric_'+name,color,maps) for name,color in (
    ('Teal',(.015,.2,.19)),('Ochre',(.48,.18,.018)),('Burgundy',(.24,.02,.04)))]

def box(name,center,size,mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat);U.cloth_detail_uv(obj,1)
    return obj

def batch(objects,prefix):
    groups={}
    for obj in sorted(objects,key=lambda obj:obj.name):
        if obj.type=='MESH': groups.setdefault(obj.data.materials[0].name,[]).append(obj)
    result=[]
    for name,parts in sorted(groups.items()):
        bpy.ops.object.select_all(action='DESELECT')
        for obj in parts: obj.select_set(True)
        bpy.context.view_layer.objects.active=parts[0]
        if len(parts)>1: bpy.ops.object.join()
        obj=bpy.context.object;obj.name=prefix+'_'+name;result.append(obj)
    return result

def bar(name,a,b,r=.025): return T.tube(name,[a,b],r,metal)

def label(body,location,size,mat):
    curve=bpy.data.curves.new('Label_'+body,'FONT');curve.body=body
    curve.align_x='CENTER';curve.size=size;curve.extrude=.001;curve.resolution_u=3
    font=Path('C:/Windows/Fonts/arialbd.ttf')
    if font.exists(): curve.font=bpy.data.fonts.load(str(font))
    obj=bpy.data.objects.new('Label_'+body,curve);bpy.context.collection.objects.link(obj)
    obj.location=location;obj.rotation_euler.x=math.pi/2;curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.convert(target='MESH');U.cloth_detail_uv(bpy.context.object,1)

# 4.6 x 4 m pavilion. The roof extends beyond the wall line, with tensioned panels.
corners=[(-2.4,-2.2),(2.4,-2.2),(2.4,2.2),(-2.4,2.2)]
for side in range(4):
    a,b=corners[side],corners[(side+1)%4]
    points=[]
    for j in range(13):
        t=.015+.985*j/12
        for i in range(17):
            u=i/16
            x,y=(a[0]*(1-u)+b[0]*u)*t,(a[1]*(1-u)+b[1]*u)*t
            z=3.95-1.35*t-.09*math.sin(math.pi*u)*math.sin(math.pi*t)
            points.append((x,y,z))
    faces=[(j*17+i,j*17+i+1,(j+1)*17+i+1,(j+1)*17+i) for j in range(12) for i in range(16)]
    T.mesh('Pagoda_Panel',points,faces,cloth,True,density=2)
    bar('Roof_Rib',(0,0,3.95),(a[0],a[1],2.59),.02)
    T.quad('Valance',[(a[0],a[1],2.62),(b[0],b[1],2.62),(b[0],b[1],2.4),(a[0],a[1],2.4)],cloth)
T.mesh('Roof_Cap',[(x*.015,y*.015,3.94) for x,y in corners]+[(0,0,3.96)],[(i,(i+1)%4,4) for i in range(4)],cloth)
pagoda_parts=set(bpy.context.scene.objects)
for x in (-2.25,2.25):
    for y in (-1.95,1.95):
        bar('Post',(x,y,.04),(x,y,2.59),.035)
        box('Weighted_Foot',(x,y,.13),(.32,.32,.23),dark)
    # Side curtains with slight folds, leaving a fully open customer-facing front.
    points=[(x+.018*math.sin(j*math.pi/2),-1.95+3.9*j/32,z) for z in (.08,2.42) for j in range(33)]
    T.mesh('Side_Curtain',points,[(j,j+1,j+34,j+33) for j in range(32)],cloth,True,density=2)
T.quad('Rear_Curtain',[(-2.25,1.95,.08),(2.25,1.95,.08),(2.25,1.95,2.42),(-2.25,1.95,2.42)],cloth)
box('Floor',(0,0,.035),(4.5,3.9,.05),floor)
box('Counter',(0,-1.65,.96),(4.05,.62,.09),wood)
for x in (-1.7,1.7):
    for y in (-1.88,-1.43): bar('Counter_Leg',(x,y,.07),(x,y,.92),.025)
# Projecting front awning with visible support struts and a sewn edge.
T.quad('Awning',[(-2.3,-2.15,2.65),(2.3,-2.15,2.65),(2.3,-2.85,2.43),(-2.3,-2.85,2.43)],cloth)
for x in (-2.25,2.25): bar('Awning_Strut',(x,-1.95,1.9),(x,-2.85,2.42),.018)
T.tube('Awning_Binding',[(-2.3,-2.85,2.43),(2.3,-2.85,2.43)],.015,cloth)
T.quad('Counter_Fabric',[(-2.02,-1.98,.12),(2.02,-1.98,.12),(2.02,-1.98,.91),(-2.02,-1.98,.91)],cloth)
common=batch(set(bpy.context.scene.objects)-pagoda_parts,'Shared')
roofs={'pagoda':batch(pagoda_parts,'Pagoda')}
# A repeatable double-pitched hall bay, ridge along the row of neighboring shops.
before=set(bpy.context.scene.objects)
for side in (-1,1):
    points=[(-2.4+4.8*i/16,side*2.2*j/12,
             3.95-1.35*j/12-.045*math.sin(math.pi*i/16)*math.sin(math.pi*j/12))
            for j in range(13) for i in range(17)]
    T.mesh('Hall_Roof_Panel',points,[(j*17+i,j*17+i+1,(j+1)*17+i+1,(j+1)*17+i) for j in range(12) for i in range(16)],cloth,True,density=2)
    T.quad('Hall_Valance',[(-2.4,side*2.2,2.6),(2.4,side*2.2,2.6),(2.4,side*2.2,2.4),(-2.4,side*2.2,2.4)],cloth)
for x in (-2.4,2.4):
    T.mesh('Hall_Gable',[(x,-2.2,2.6),(x,0,3.95),(x,2.2,2.6)],[(0,1,2)],cloth)
    T.quad('Hall_End_Valance',[(x,-2.2,2.6),(x,2.2,2.6),(x,2.2,2.38),(x,-2.2,2.38)],cloth)
for x in (-2.25,0,2.25):
    for side in (-1,1): bar('Hall_Rafter',(x,0,3.8),(x,side*2.15,2.47),.027)
bar('Hall_Ridge',(-2.4,0,3.8),(2.4,0,3.8),.027)
roofs['segmentHall']=batch(set(bpy.context.scene.objects)-before,'Hall')
for architecture,parts in roofs.items():
    for obj in parts: obj['marketRoof']=architecture

variants=[('merch','KOSZULKI',colors[0]),('food','JEDZENIE',colors[1]),('coffee','KAWA',colors[2]),
          ('siemaShop',VENDORS['siemaShop']['label'],colors[2]),
          ('antykwariat','Antykwariat',colors[0]),('informacja','INFORMACJA',white),
          ('kodano',VENDORS['kodano']['label'],white)]
for index,(kind,title,color) in enumerate(variants):
    root=bpy.data.objects.new('Market_'+kind,None);bpy.context.collection.objects.link(root)
    root['marketVariant']=kind;root['units']='metres'
    architecture='segmentHall' if kind in ('antykwariat','informacja','kodano') else 'pagoda'
    root['marketArchitecture']=architecture
    root['referenceStatus']='Provisional dimensions and review position; '+('generic category' if kind not in VENDORS else VENDORS[kind]['presence'])
    if kind in VENDORS: root['vendorSource']=VENDORS[kind]['source']
    if kind=='siemaShop':
        spec=importlib.util.spec_from_file_location('siema_hall',Path(__file__).with_name('siema-shop-hall.py'))
        hall=importlib.util.module_from_spec(spec);spec.loader.exec_module(hall)
        before=set(bpy.context.scene.objects)
        hall.build(T,U,root,cloth,metal,floor,dark,white,box,bar,label)
        for obj in batch(set(bpy.context.scene.objects)-before,'SiemaShop'): obj.parent=root
        root.location.x=40
        continue
    for obj in common+roofs[architecture]:
        copy=obj.copy();copy.data=obj.data;bpy.context.collection.objects.link(copy);copy.parent=root
    before=set(bpy.context.scene.objects)
    box('Sign_Backboard',(0,-2.89,2.46),(3.95,.035,.43),color)
    if kind=='antykwariat':
        label('Festiwalowy',(0,-2.915,2.53),.13,white)
        label(title,(0,-2.915,2.28),.29,white)
    elif kind=='informacja':
        label('PUNKT INFORMACYJNY',(0,-2.915,2.47),.23,dark)
        label('INFORMATION',(0,-2.915,2.28),.16,dark)
    else: label(title,(0,-2.915,2.33),.31 if kind=='kodano' else .36,dark if kind=='kodano' else white)
    if kind in ('merch','siemaShop'):
        bar('Clothes_Rail',(-1.7,.8,2.13),(1.7,.8,2.13))
        for x in (-1.55,-.78,0,.78,1.55):
            T.tube('Hanger',[(x-.25,.79,1.86),(x,.79,2.08),(x+.25,.79,1.86),(x-.25,.79,1.86)],.012,metal)
            # Sewn T-shirt silhouette with sleeves and neck indentation.
            outline=[(-.23,0),(-.43,-.14),(-.32,-.36),(-.22,-.28),(-.23,-.83),(.23,-.83),(.22,-.28),(.32,-.36),(.43,-.14),(.23,0),(.11,-.07),(-.11,-.07)]
            T.mesh('Shirt',[(x+dx,.75,1.96+dz) for dx,dz in outline],[tuple(range(len(outline)))],color if x in (-.78,.78) else dark)
        for x in (-1.35,-.45,.45,1.35):
            for z in (1.04,1.1,1.16): box('Folded_Shirt',(x,-1.63,z),(.48,.36,.045),color)
    elif kind=='food':
        box('Griddle',(0,.6,1.15),(1.7,.78,.35),metal)
        box('Griddle_Surface',(0,.6,1.34),(1.57,.67,.035),dark)
        for x in (-1.4,1.4):
            box('Food_Crate',(x,.55,.82),(.62,.7,.7),wood)
            for z in (1.21,1.38): box('Tray',(x,.55,z),(.6,.6,.04),metal)
        for x in (-1.45,-.75,0,.75,1.45): box('Serving_Tray',(x,-1.65,1.03),(.5,.36,.045),white)
        box('Menu_Board',(0,1.86,1.96),(1.3,.04,.68),dark)
        label('MENU',(0,1.82,2.04),.2,white)
        label('DANIE DNIA',(0,1.82,1.78),.105,white)
    elif kind=='coffee':
        box('Coffee_Machine',(-.8,-.85,1.23),(1.15,.55,.53),metal)
        box('Coffee_Front',(-.8,-1.14,1.27),(1.06,.04,.33),dark)
        for x in (-1.1,-.55): bar('Coffee_Spout',(x,-1.2,1.27),(x,-1.2,1.11),.018)
        box('Coffee_Grinder',(.22,-.83,1.25),(.3,.3,.48),dark)
        for x in (.85,1.15,1.45):
            for y in (-1.65,-1.2):
                bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=.05,radius2=.065,depth=.15,location=(x,y,1.09))
                obj=bpy.context.object;obj.name='Paper_Cup';obj.data.materials.append(white);U.cloth_detail_uv(obj,1)
        box('Menu_Board',(0,1.86,1.85),(1.5,.04,.72),dark)
        label('KAWA  HERBATA',(0,1.82,1.93),.13,white)
        label('ZIMNE NAPOJE',(0,1.82,1.68),.12,white)
    elif kind=='antykwariat':
        # Open shelves with upright books, front stacks and record sleeves.
        for x in (-1.7,1.7): box('Bookshelf_Upright',(x,1.55,1.2),(.09,.45,2.25),wood)
        for level in range(4):
            z=.35+level*.48
            box('Bookshelf',(0,1.55,z),(3.5,.48,.06),wood)
            for i in range(18):
                x=-1.56+i*.177
                box('Book',(x,1.54,z+.18),(.105,.27,.29+(i%3)*.035),colors[(i+level)%3])
        for x in (-1.35,-.6,.3):
            for level in range(3): box('Book_Stack',(x,-1.63,1.05+level*.055),(.48,.34,.05),colors[level%3])
        box('Record_Crate',(1.35,-1.6,1.12),(.58,.44,.27),wood)
        for j in range(6): box('Record_Sleeve',(1.35,-1.76+j*.062,1.34),(.3,.012,.3),colors[j%3])
    elif kind=='informacja':
        box('Information_Board',(0,1.86,1.8),(2.8,.05,1.0),white)
        label('INFORMACJA',(0,1.82,2.03),.25,dark)
        label('PROGRAM   MAPA',(0,1.82,1.64),.18,dark)
        for x in (-1.35,-.45,.45,1.35):
            for z in (1.035,1.05,1.065): box('Leaflets',(x,-1.65,z),(.36,.29,.012),white)
    elif kind=='kodano':
        box('Optical_Display',(0,1.76,1.55),(3.1,.16,1.5),white)
        for z in (1.08,1.47,1.86):
            box('Optical_Shelf',(0,1.5,z),(3,.45,.035),wood)
        for x in (-1.35,0,1.35):
            box('Glasses_Tray',(x,-1.64,1.03),(.67,.39,.035),dark)
            for y in (-1.72,-1.53):
                for side in (-1,1):
                    T.tube('Glasses_Rim',[(x+side*.08+.064*math.cos(i*math.tau/12),y+.045*math.sin(i*math.tau/12),1.06) for i in range(13)],.004,metal)
                bar('Glasses_Bridge',(x-.02,y,1.06),(x+.02,y,1.06),.004)
                for side in (-1,1): bar('Glasses_Temple',(x+side*.145,y,1.06),(x+side*.13,y+.12,1.06),.004)
    for obj in batch(set(bpy.context.scene.objects)-before,kind): obj.parent=root
    root.location.x=(index-1)*6
for obj in common+roofs['pagoda']+roofs['segmentHall']: bpy.data.objects.remove(obj,do_unlink=True)
# A reusable asphalt material swatch; runtime builds a terrain-following lane with it.
asphalt=U.material('Market_Concrete',(.44,.43,.4),.94)
rng=np.random.default_rng(32026);grain=rng.random((128,128))
pixels=np.ones((128,128,4));pixels[:,:,:3]=(.36+.09*grain)[:,:,None]
pixels[:2,:,:3]*=.65;pixels[:,:2,:3]*=.65
texture=U.image_data('Market_Asphalt_Color',pixels)
node=U.texture_node(asphalt,texture,'TentDetail')
asphalt.node_tree.links.new(node.outputs['Color'],asphalt.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
pixels[:,:,:3]=(.78+.15*grain)[:,:,None]
node=U.texture_node(asphalt,U.image_data('Market_Asphalt_Roughness',pixels),'TentDetail')
asphalt.node_tree.links.new(node.outputs['Color'],asphalt.node_tree.nodes['Principled BSDF'].inputs['Roughness'])
tile=T.quad('Market_Asphalt_Template',[(-.5,-4.5,0),(.5,-4.5,0),(.5,-3.5,0),(-.5,-3.5,0)],asphalt)
tile['marketSurface']='concrete'
OUT.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT),export_format='GLB',export_extras=True,export_animations=False)
U.finalize_gltf(OUT)
print('MARKET_STALLS',OUT.stat().st_size)
