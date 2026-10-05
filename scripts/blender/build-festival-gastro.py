"""
Pol'and'Rock Festival 2026 - Gastro Zone & Props Builder
Builds:
1. water_curtain.glb: Rebuilt with realistic soft volumetric mist clouds (mgielka), removing laser lines
2. crowd_barrier.glb: Galvanized crowd control barrier based on user photo
3. festival_food_tent.glb: Massive white food marquee with queue barrier lanes, authentic hanging menus from photo, counters, coolers
4. foodtruck_frytki.glb: Authentic Frytki Belgijskie truck (user photo)
5. foodtruck_churros.glb: Authentic Churros truck with leaning ladder (user photo)
6. foodtruck_burger.glb: Smash Burger & Zapiekanki XXL truck (Pol'and'Rock reference)
7. foodtruck_makarun.glb: Makarun Spaghetti & Salad truck (Pol'and'Rock reference)
8. rollbar_lech.glb: Authentic Lech draft beer rollbar trailer with taps & canopy
"""

import bpy
import bmesh
import math
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXTURES_DIR = ROOT / "public" / "game-assets" / "world" / "festival" / "textures"
OUT_DIR = ROOT / "public" / "game-assets" / "world" / "festival"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Three.js (X right, Y up, Z front) -> Blender (X right, -Z forward, Y up)
def t3(x, y, z):
    return (float(x), -float(z), float(y))

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in list(bpy.data.collections):
        bpy.data.collections.remove(col, do_unlink=True)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for img in list(bpy.data.images):
        bpy.data.images.remove(img, do_unlink=True)

def create_pbr_material(name, texture_name=None, base_color=(0.8, 0.8, 0.8, 1.0),
                        metallic=0.0, roughness=0.5, emissive_strength=0.0,
                        emissive_color=(1.0, 1.0, 1.0, 1.0), alpha_mode='OPAQUE', opacity=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if alpha_mode == 'BLEND':
        mat.blend_method = 'BLEND'
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
        mat.show_transparent_back = True

    if texture_name:
        tex_path = TEXTURES_DIR / texture_name
        if tex_path.exists():
            img = bpy.data.images.load(str(tex_path))
            img.colorspace_settings.name = 'sRGB'
            tex_node = nodes.new("ShaderNodeTexImage")
            tex_node.image = img
            links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
            if alpha_mode == 'BLEND':
                links.new(tex_node.outputs["Alpha"], bsdf.inputs["Alpha"])
            if emissive_strength > 0:
                links.new(tex_node.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
            return mat

    bsdf.inputs["Base Color"].default_value = base_color
    if alpha_mode == 'BLEND':
        bsdf.inputs["Alpha"].default_value = opacity
    if emissive_strength > 0:
        bsdf.inputs["Emission Color"].default_value = emissive_color
        bsdf.inputs["Emission Strength"].default_value = emissive_strength

    return mat

def make_box(name, cx, cy, cz, sx, sy, sz, mat):
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    pts = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    b_verts = [t3(*p) for p in pts]
    faces = [
        (0, 1, 2, 3), # rear
        (4, 5, 6, 7), # front
        (0, 4, 7, 3), # left
        (1, 2, 6, 5), # right
        (3, 2, 6, 7), # top
        (0, 1, 5, 4), # bottom
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(b_verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_cylinder(name, cx, cy, cz, radius, height, mat, axis='Y', segments=12):
    """axis: 'X', 'Y' (vertical in Three.js), 'Z'"""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rot = (0, 0, 0)
    if axis == 'Y':
        rot = (math.pi / 2, 0, 0) # in Blender, cylinder default is along Z. Rotate so it's vertical along Blender Z
    elif axis == 'X':
        rot = (0, math.pi / 2, 0)
    elif axis == 'Z':
        rot = (math.pi / 2, 0, 0) # aligned with depth

    # Create in Blender coordinates
    bx, by, bz = t3(cx, cy, cz)
    bmesh.ops.create_cylinder(
        bm,
        cap_ends=True,
        cap_tris=False,
        radius=radius,
        depth=height,
        segments=segments
    )
    # Apply rotation according to axis
    if axis == 'Y':
        # Default bmesh cylinder is along Z, which is Three.js Y! No rotation needed!
        pass
    elif axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, matrix=bpy.context.scene.transform_orientation_slots[0].type and 
                         bmesh.ops.rotate(bm, verts=bm.verts, matrix=bmesh.ops.create_cube and None or None) or None)
    bm.to_mesh(mesh)
    bm.free()

    # Position
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (bx, by, bz)
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Z':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_textured_quad(name, p0, p1, p2, p3, mat, uv_bounds=(0.0, 0.0, 1.0, 1.0), double_sided=True):
    """Creates a quad in Three.js coordinates (p0..p3) with UV mapping"""
    b_verts = [t3(*p) for p in [p0, p1, p2, p3]]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(b_verts, [], [(0, 1, 2, 3)])
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    u0, v0, u1, v1 = uv_bounds
    uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    for i, loop in enumerate(mesh.loops):
        uv_layer.data[loop.index].uv = uvs[i]

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    if double_sided and hasattr(mat, 'use_backface_culling'):
        mat.use_backface_culling = False
    bpy.context.collection.objects.link(obj)
    return obj

def export_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    print(f"Exported: {filepath} ({os.path.getsize(filepath):,} bytes)")

# ==============================================================================
# 1. WATER CURTAIN (KURTYNA WODNA - REALISTIC MIST)
# ==============================================================================
def build_water_curtain():
    clear_scene()
    print("Building Kurtyna Wodna with Realistic Cooling Mist...")

    mat_truss = create_pbr_material("Truss_Alu", base_color=(0.82, 0.84, 0.86, 1.0), roughness=0.3, metallic=0.9)
    mat_water_pipe = create_pbr_material("Water_Pipe_Blue", base_color=(0.10, 0.50, 0.90, 1.0), roughness=0.4)
    mat_brass = create_pbr_material("Brass_Nozzle", base_color=(0.85, 0.70, 0.25, 1.0), roughness=0.35, metallic=0.8)
    mat_sign = create_pbr_material("Curtain_Sign_Tex", "kurtyna_wodna_sign.png", roughness=0.5, emissive_strength=0.25)
    mat_ballast = create_pbr_material("Concrete_Ballast", base_color=(0.45, 0.46, 0.48, 1.0), roughness=0.9)
    mat_hose = create_pbr_material("Yellow_Hose", base_color=(0.95, 0.80, 0.10, 1.0), roughness=0.5)
    mat_puddle = create_pbr_material("Puddle_Wet", base_color=(0.15, 0.20, 0.25, 0.7), roughness=0.1, metallic=0.2, alpha_mode='BLEND', opacity=0.6)
    # SOFT VOLUMETRIC MIST MATERIAL
    mat_mist = create_pbr_material("Water_Mist", "kurtyna_wodna_mist.png", base_color=(0.95, 0.98, 1.0, 1.0),
                                   roughness=0.9, metallic=0.0, alpha_mode='BLEND')

    # Base ballast blocks
    make_box("Ballast_Left", -2.6, 0.175, 0.0, 1.0, 0.35, 1.0, mat_ballast)
    make_box("Ballast_Right", 2.6, 0.175, 0.0, 1.0, 0.35, 1.0, mat_ballast)

    # 2 Vertical Box Truss Columns (4 chords each, width 0.35m, height 4.2m)
    for col_name, cx in [("Left", -2.6), ("Right", 2.6)]:
        for ox in [-0.15, 0.15]:
            for oz in [-0.15, 0.15]:
                make_box(f"Chord_{col_name}_{ox}_{oz}", cx + ox, 2.1, oz, 0.04, 4.2, 0.04, mat_truss)
        for step in range(9):
            ly = 0.45 + step * 0.42
            make_box(f"Lace_F_{col_name}_{step}", cx, ly, 0.15, 0.32, 0.025, 0.025, mat_truss)
            make_box(f"Lace_B_{col_name}_{step}", cx, ly, -0.15, 0.32, 0.025, 0.025, mat_truss)

    # Overhead Box Truss Beam (spanning 5.2m between X = -2.6 and X = +2.6 at Y = 3.85m)
    for oy in [-0.15, 0.15]:
        for oz in [-0.15, 0.15]:
            make_box(f"Header_Chord_{oy}_{oz}", 0.0, 3.85 + oy, oz, 5.2, 0.04, 0.04, mat_truss)
    for step in range(11):
        hx = -2.2 + step * 0.44
        make_box(f"Header_Lace_T_{step}", hx, 4.0, 0.0, 0.025, 0.025, 0.32, mat_truss)
        make_box(f"Header_Lace_B_{step}", hx, 3.7, 0.0, 0.025, 0.025, 0.32, mat_truss)

    # Water Supply Manifold Pipe
    make_box("Water_Manifold_Pipe", 0.0, 3.65, 0.0, 4.8, 0.06, 0.06, mat_water_pipe)
    # Supply hose down left column
    make_box("Water_Supply_Hose", -2.6, 1.85, 0.18, 0.04, 3.7, 0.04, mat_hose)

    # Double-sided Sign "KURTYNA WODNA - OCHŁOŃ!"
    make_textured_quad("Curtain_Sign_F", (-1.4, 4.05, 0.18), (1.4, 4.05, 0.18), (1.4, 4.85, 0.18), (-1.4, 4.85, 0.18), mat_sign)
    make_textured_quad("Curtain_Sign_B", (1.4, 4.05, -0.18), (-1.4, 4.05, -0.18), (-1.4, 4.85, -0.18), (1.4, 4.85, -0.18), mat_sign)

    # Wet ground puddle
    make_box("Wet_Ground_Puddle", 0.0, 0.01, 0.0, 4.8, 0.02, 2.2, mat_puddle)

    # 12 Brass Nozzles and REALISTIC SOFT MIST CLOUDS
    # Nozzles spaced across X in [-2.0, 2.0]
    import random
    random.seed(99)

    for i in range(12):
        nx = -2.0 + i * (4.0 / 11.0)
        make_box(f"Nozzle_{i}", nx, 3.58, 0.0, 0.03, 0.08, 0.03, mat_brass)

        # Cross-billboard soft mist plumes extending from nozzle (Y=3.5) down to floor (Y=0.2)
        # Instead of sharp laser cones, we use wide spreading alpha-textured quads
        w_top = 0.25
        w_bot = 0.95
        y_top = 3.55
        y_bot = 0.15

        # Plume Plane 1: along X-axis
        make_textured_quad(
            f"Mist_Plume_A_{i}",
            (nx - w_bot / 2, y_bot, 0.0),
            (nx + w_bot / 2, y_bot, 0.0),
            (nx + w_top / 2, y_top, 0.0),
            (nx - w_top / 2, y_top, 0.0),
            mat_mist
        )
        # Plume Plane 2: rotated ~60 deg
        cos60 = math.cos(math.radians(60))
        sin60 = math.sin(math.radians(60))
        make_textured_quad(
            f"Mist_Plume_B_{i}",
            (nx - (w_bot / 2) * cos60, y_bot, -(w_bot / 2) * sin60),
            (nx + (w_bot / 2) * cos60, y_bot, (w_bot / 2) * sin60),
            (nx + (w_top / 2) * cos60, y_top, (w_top / 2) * sin60),
            (nx - (w_top / 2) * cos60, y_top, -(w_top / 2) * sin60),
            mat_mist
        )

        # Ambient floating mist cloud cards staggered in the middle zone
        for c_idx in range(2):
            cy = 1.0 + c_idx * 1.2 + random.uniform(-0.2, 0.2)
            cw = random.uniform(1.0, 1.4)
            ch = random.uniform(0.8, 1.1)
            cz = random.uniform(-0.35, 0.35)
            cx = nx + random.uniform(-0.15, 0.15)
            make_textured_quad(
                f"Mist_Cloud_{i}_{c_idx}",
                (cx - cw / 2, cy - ch / 2, cz),
                (cx + cw / 2, cy - ch / 2, cz),
                (cx + cw / 2, cy + ch / 2, cz),
                (cx - cw / 2, cy + ch / 2, cz),
                mat_mist
            )

    export_glb(OUT_DIR / "water_curtain.glb")

# ==============================================================================
# 2. CROWD BARRIER (BARIERKA ZAPOROWA)
# ==============================================================================
def build_crowd_barrier():
    clear_scene()
    print("Building Galvanized Crowd Control Barrier...")

    mat_galv = create_pbr_material("Galvanized_Steel", "galvanized_steel.png",
                                   base_color=(0.82, 0.84, 0.86, 1.0),
                                   metallic=0.85, roughness=0.35)

    # Main Dimensions: 2.5m wide (X: -1.25 to 1.25), 1.1m high (Y: 0.0 to 1.1)
    # Tube diameter ~0.038m (radius 0.019m)
    r_main = 0.019
    r_picket = 0.009

    # Top horizontal tube
    make_box("Frame_Top", 0.0, 1.08, 0.0, 2.30, r_main * 2, r_main * 2, mat_galv)
    # Bottom horizontal tube
    make_box("Frame_Bottom", 0.0, 0.16, 0.0, 2.30, r_main * 2, r_main * 2, mat_galv)

    # Left and Right vertical side tubes
    make_box("Frame_Left", -1.22, 0.62, 0.0, r_main * 2, 0.96, r_main * 2, mat_galv)
    make_box("Frame_Right", 1.22, 0.62, 0.0, r_main * 2, 0.96, r_main * 2, mat_galv)

    # Rounded top corners (45-deg corner gusset struts)
    make_box("Corner_L", -1.16, 1.02, 0.0, 0.14, 0.14, r_main * 2, mat_galv)
    make_box("Corner_R", 1.16, 1.02, 0.0, 0.14, 0.14, r_main * 2, mat_galv)

    # Splayed Arched Tubular Feet at both ends
    # Splayed across Z in [-0.25, 0.25]
    for fx in [-1.05, 1.05]:
        make_box(f"Foot_Base_{fx}", fx, 0.05, 0.0, 0.06, 0.10, 0.50, mat_galv)
        # Splayed front/rear tubular slant legs
        make_box(f"Foot_Leg_F_{fx}", fx, 0.08, 0.22, 0.038, 0.06, 0.18, mat_galv)
        make_box(f"Foot_Leg_B_{fx}", fx, 0.08, -0.22, 0.038, 0.06, 0.18, mat_galv)

    # Infill vertical pickets (17 vertical tubes, spaced ~0.13m apart)
    num_pickets = 17
    picket_span = 2.16
    for p in range(num_pickets):
        px = -picket_span / 2.0 + p * (picket_span / (num_pickets - 1))
        make_box(f"Picket_{p}", px, 0.62, 0.0, r_picket * 2, 0.90, r_picket * 2, mat_galv)

    # Interlocking connectors (Hook on left, Loop on right)
    # Left hook
    make_box("Hook_Upper", -1.27, 0.85, 0.04, 0.06, 0.025, 0.08, mat_galv)
    make_box("Hook_Lower", -1.27, 0.35, 0.04, 0.06, 0.025, 0.08, mat_galv)
    # Right eye/loop
    make_box("Loop_Upper", 1.27, 0.85, 0.0, 0.06, 0.03, 0.08, mat_galv)
    make_box("Loop_Lower", 1.27, 0.35, 0.0, 0.06, 0.03, 0.08, mat_galv)

    export_glb(OUT_DIR / "crowd_barrier.glb")

# ==============================================================================
# 3. LARGE FESTIVAL FOOD TENT (NAMIOT GASTRONOMICZNY DUŻY)
# ==============================================================================
def build_festival_food_tent():
    clear_scene()
    print("Building Massive Festival Food Tent with Queue Barrier Lanes & Menus...")

    # Materials
    mat_tarpaulin = create_pbr_material("Tent_PVC_White", base_color=(0.95, 0.95, 0.96, 1.0), roughness=0.6)
    mat_frame_alu = create_pbr_material("Tent_Alu_Frame", base_color=(0.80, 0.82, 0.85, 1.0), roughness=0.35, metallic=0.8)
    mat_wood_counter = create_pbr_material("Wood_Counter", base_color=(0.75, 0.55, 0.32, 1.0), roughness=0.45)
    mat_green_apron = create_pbr_material("Green_Apron_Fabric", base_color=(0.08, 0.28, 0.15, 1.0), roughness=0.85)
    mat_cooler = create_pbr_material("Beverage_Cooler_Tex", "beverage_cooler.png", roughness=0.3, emissive_strength=0.3)
    mat_chafing = create_pbr_material("Stainless_Chafing", base_color=(0.90, 0.92, 0.94, 1.0), roughness=0.2, metallic=0.95)
    mat_banner = create_pbr_material("Food_Tent_Banner_Tex", "food_tent_banner.png", roughness=0.5, emissive_strength=0.2)
    mat_menu = create_pbr_material("Food_Menus_Tex", "food_station_menus.png", roughness=0.4)
    mat_galv = create_pbr_material("Galvanized_Steel_Barrier", "galvanized_steel.png", base_color=(0.82, 0.84, 0.86, 1.0), metallic=0.85, roughness=0.35)

    # Dimensions
    # Width: 32m (X: -16 to +16)
    # Depth: 14m (Z: -7 to +7)
    # Eave height: 3.2m
    # Ridge height: 5.8m (at Z = 0)
    w_tent = 32.0
    d_tent = 14.0
    h_eave = 3.2
    h_ridge = 5.8

    # Roof Tarpaulin Panels (Left slope and Right slope)
    # Slope 1: Front half (Z: -7 to 0, Y: 3.2 to 5.8)
    # Slope length ~7.47m
    roof_f_p0 = (-w_tent / 2, h_eave, -d_tent / 2)
    roof_f_p1 = (w_tent / 2, h_eave, -d_tent / 2)
    roof_f_p2 = (w_tent / 2, h_ridge, 0.0)
    roof_f_p3 = (-w_tent / 2, h_ridge, 0.0)
    make_textured_quad("Roof_Front_Slope", roof_f_p0, roof_f_p1, roof_f_p2, roof_f_p3, mat_tarpaulin)

    # Slope 2: Rear half (Z: 0 to +7, Y: 5.8 to 3.2)
    roof_r_p0 = (w_tent / 2, h_eave, d_tent / 2)
    roof_r_p1 = (-w_tent / 2, h_eave, d_tent / 2)
    roof_r_p2 = (-w_tent / 2, h_ridge, 0.0)
    roof_r_p3 = (w_tent / 2, h_ridge, 0.0)
    make_textured_quad("Roof_Rear_Slope", roof_r_p0, roof_r_p1, roof_r_p2, roof_r_p3, mat_tarpaulin)

    # Rear wall (Z = +7)
    make_box("Rear_Wall", 0.0, h_eave / 2.0, d_tent / 2, w_tent, h_eave, 0.08, mat_tarpaulin)

    # Side walls (Left X = -16, Right X = +16)
    make_box("Left_Wall", -w_tent / 2, h_eave / 2.0, 0.0, 0.08, h_eave, d_tent, mat_tarpaulin)
    make_box("Right_Wall", w_tent / 2, h_eave / 2.0, 0.0, 0.08, h_eave, d_tent, mat_tarpaulin)

    # Front Gable triangular top wall (above eave at Z = -7)
    # In addition, large colorful Pol'and'Rock banner mounted on front gable
    make_textured_quad(
        "Front_Gable_Banner",
        (7.0, 3.4, -7.02),
        (-7.0, 3.4, -7.02),
        (-7.0, 5.4, -7.02),
        (7.0, 5.4, -7.02),
        mat_banner
    )

    # Structural Aluminum Portal Frames (Truss rafters & columns every 5.3m)
    num_frames = 7
    for f in range(num_frames):
        fx = -w_tent / 2 + f * (w_tent / (num_frames - 1))
        # Left column
        make_box(f"Frame_Col_L_{f}", fx, h_eave / 2.0, -d_tent / 2, 0.16, h_eave, 0.16, mat_frame_alu)
        # Right column
        make_box(f"Frame_Col_R_{f}", fx, h_eave / 2.0, d_tent / 2, 0.16, h_eave, 0.16, mat_frame_alu)
        # Front rafter
        make_box(f"Frame_Rafter_F_{f}", fx, (h_eave + h_ridge) / 2.0, -d_tent / 4.0, 0.14, 0.18, d_tent / 2.0, mat_frame_alu)
        # Rear rafter
        make_box(f"Frame_Rafter_R_{f}", fx, (h_eave + h_ridge) / 2.0, d_tent / 4.0, 0.14, 0.18, d_tent / 2.0, mat_frame_alu)

    # Front Serving Counter & Green Apron Skirt
    # Continuous counter along Z = -6.5m, height 1.05m, depth 0.65m
    make_box("Front_Counter_Top", 0.0, 1.02, -6.5, w_tent - 1.0, 0.08, 0.65, mat_wood_counter)
    make_box("Front_Counter_Skirt", 0.0, 0.50, -6.78, w_tent - 1.0, 0.98, 0.04, mat_green_apron)

    # 6 Hanging Station Menu Signs under front roof eave (Z = -6.65, Y = 2.3m)
    # Atlas layout: 3 columns x 2 rows
    # Stations:
    # 0: Zurek (col 0, row 0)
    # 1: Pomidorowa (col 1, row 0)
    # 2: Bigos (col 2, row 0)
    # 3: Placki (col 0, row 1)
    # 4: Gulasz (col 1, row 1)
    # 5: Schabowy (col 2, row 1)
    num_stations = 6
    station_centers = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5]
    sign_w = 1.35
    sign_h = 1.25

    for s_idx, sx in enumerate(station_centers):
        # UV bounds in 3x2 atlas:
        row = s_idx // 3 # 0 top, 1 bottom in image
        col = s_idx % 3
        # In texture: row 0 is top (V from 0.5 to 1.0), row 1 is bottom (V from 0.0 to 0.5)
        u0 = col / 3.0
        u1 = (col + 1) / 3.0
        v0 = 0.5 if row == 0 else 0.0
        v1 = 1.0 if row == 0 else 0.5

        sy = 2.25
        sz = -6.65

        # Thin hanging wire cables from ceiling (Y=3.3 down to 2.8)
        make_box(f"Sign_Wire_L_{s_idx}", sx - 0.5, 2.95, sz, 0.015, 0.70, 0.015, mat_frame_alu)
        make_box(f"Sign_Wire_R_{s_idx}", sx + 0.5, 2.95, sz, 0.015, 0.70, 0.015, mat_frame_alu)

        # Front sign face (facing out towards customer: -Z)
        make_textured_quad(
            f"Station_Menu_Front_{s_idx}",
            (sx + sign_w / 2, sy - sign_h / 2, sz),
            (sx - sign_w / 2, sy - sign_h / 2, sz),
            (sx - sign_w / 2, sy + sign_h / 2, sz),
            (sx + sign_w / 2, sy + sign_h / 2, sz),
            mat_menu,
            uv_bounds=(u0, v0, u1, v1)
        )
        # Back sign face
        make_textured_quad(
            f"Station_Menu_Back_{s_idx}",
            (sx - sign_w / 2, sy - sign_h / 2, sz + 0.02),
            (sx + sign_w / 2, sy - sign_h / 2, sz + 0.02),
            (sx + sign_w / 2, sy + sign_h / 2, sz + 0.02),
            (sx - sign_w / 2, sy + sign_h / 2, sz + 0.02),
            mat_menu,
            uv_bounds=(u0, v0, u1, v1)
        )

    # Equipment Behind Counter:
    # 4 Red Coca-Cola Beverage Coolers along rear interior wall (Z = -2.0m)
    for c_i, cx in enumerate([-10.0, -4.0, 4.0, 10.0]):
        # Cooler box body (width 0.9m, height 2.0m, depth 0.75m)
        make_box(f"Cooler_Body_{c_i}", cx, 1.0, -4.5, 0.90, 2.0, 0.75, mat_tarpaulin)
        # Front illuminated door texture
        make_textured_quad(
            f"Cooler_Front_{c_i}",
            (cx + 0.45, 0.0, -4.88),
            (cx - 0.45, 0.0, -4.88),
            (cx - 0.45, 2.0, -4.88),
            (cx + 0.45, 2.0, -4.88),
            mat_cooler
        )

    # Stainless Steel Chafing Warmers / Bain-Maries on back prep table
    for ch_i, cx in enumerate([-13.0, -8.0, -3.0, 2.0, 7.0, 12.0]):
        make_box(f"Prep_Table_{ch_i}", cx, 0.45, -5.4, 2.4, 0.90, 0.8, mat_wood_counter)
        for unit in range(2):
            ux = cx - 0.5 + unit * 1.0
            make_box(f"Chafing_Dish_{ch_i}_{unit}", ux, 0.98, -5.4, 0.70, 0.22, 0.45, mat_chafing)

    # QUEUE CORRIDORS IN FRONT OF THE TENT (Drogi z barierek)
    # Barrier lanes extending from counter (Z = -6.8m to Z = -11.3m, length 4.5m)
    # Partitioning each of the 6 stations so customers queue orderly
    lane_dividers = [-15.0, -10.0, -5.0, 0.0, 5.0, 10.0, 15.0]
    for l_idx, lx in enumerate(lane_dividers):
        # 2 barrier segments in length (each ~2.25m)
        for b_sub in range(2):
            bz = -7.9 - b_sub * 2.25
            # Simplified barrier model for queue lane divider
            make_box(f"Queue_Barrier_Top_{l_idx}_{b_sub}", lx, 1.08, bz, 0.04, 0.04, 2.20, mat_galv)
            make_box(f"Queue_Barrier_Bot_{l_idx}_{b_sub}", lx, 0.16, bz, 0.04, 0.04, 2.20, mat_galv)
            make_box(f"Queue_Barrier_PostF_{l_idx}_{b_sub}", lx, 0.62, bz - 1.05, 0.04, 0.96, 0.04, mat_galv)
            make_box(f"Queue_Barrier_PostB_{l_idx}_{b_sub}", lx, 0.62, bz + 1.05, 0.04, 0.96, 0.04, mat_galv)
            # Pickers
            for pk in range(6):
                pz = bz - 0.8 + pk * 0.32
                make_box(f"Queue_Barrier_Pk_{l_idx}_{b_sub}_{pk}", lx, 0.62, pz, 0.02, 0.88, 0.02, mat_galv)

    export_glb(OUT_DIR / "festival_food_tent.glb")

# ==============================================================================
# 4. FOOD TRUCK GENERATOR HELPER
# ==============================================================================
def build_foodtruck_base(name, livery_texture, sign_texture, sign_text, body_color,
                         ladder=False, fryer=False, griddle=False, pasta=False):
    clear_scene()
    print(f"Building Food Truck: {name}...")

    mat_livery = create_pbr_material(f"{name}_Livery", livery_texture, roughness=0.35)
    mat_body_main = create_pbr_material(f"{name}_Body", base_color=body_color, roughness=0.35)
    mat_cab_white = create_pbr_material("Cab_White", base_color=(0.95, 0.95, 0.96, 1.0), roughness=0.3)
    mat_glass = create_pbr_material("Van_Glass", base_color=(0.10, 0.15, 0.20, 0.8), roughness=0.1, metallic=0.9, alpha_mode='BLEND', opacity=0.7)
    mat_black_trim = create_pbr_material("Van_Black_Trim", base_color=(0.12, 0.12, 0.14, 1.0), roughness=0.7)
    mat_tire = create_pbr_material("Van_Tire_Rubber", base_color=(0.10, 0.10, 0.10, 1.0), roughness=0.9)
    mat_rim = create_pbr_material("Van_Wheel_Rim", base_color=(0.80, 0.82, 0.85, 1.0), roughness=0.3, metallic=0.85)
    mat_counter = create_pbr_material("Gastro_Wood_Counter", base_color=(0.75, 0.55, 0.32, 1.0), roughness=0.45)
    mat_stainless = create_pbr_material("Gastro_Stainless", base_color=(0.90, 0.92, 0.95, 1.0), roughness=0.2, metallic=0.95)
    mat_sign = create_pbr_material(f"{name}_Sign", sign_texture, roughness=0.4, emissive_strength=0.2)
    mat_galv = create_pbr_material("Ladder_Galv", base_color=(0.85, 0.85, 0.88, 1.0), roughness=0.3, metallic=0.85)

    # 1. Front Van Cab (Renault Master / Fiat Ducato style)
    # Cab is at front: +Z direction (Z from 1.5 to 3.6m)
    # Hood & Engine Bay
    make_box("Cab_Hood", 0.0, 0.85, 2.9, 2.15, 0.55, 1.4, mat_cab_white)
    make_box("Cab_Bumper", 0.0, 0.42, 3.65, 2.20, 0.45, 0.25, mat_black_trim)
    make_box("Cab_Grille", 0.0, 0.65, 3.62, 1.20, 0.30, 0.06, mat_black_trim)
    # Headlights
    make_box("Headlight_L", -0.85, 0.78, 3.60, 0.35, 0.20, 0.06, mat_glass)
    make_box("Headlight_R", 0.85, 0.78, 3.60, 0.35, 0.20, 0.06, mat_glass)

    # Cab Cabin & Windshield
    make_box("Cab_Cabin", 0.0, 1.65, 2.0, 2.15, 1.15, 1.2, mat_cab_white)
    # Slanted Windshield
    make_textured_quad("Cab_Windshield", (-0.95, 1.25, 2.55), (0.95, 1.25, 2.55), (0.95, 2.15, 2.10), (-0.95, 2.15, 2.10), mat_glass)
    # Side Windows
    make_box("Cab_SideWin_L", -1.09, 1.65, 2.0, 0.04, 0.65, 0.85, mat_glass)
    make_box("Cab_SideWin_R", 1.09, 1.65, 2.0, 0.04, 0.65, 0.85, mat_glass)
    # Side Mirrors
    make_box("Mirror_L", -1.22, 1.55, 2.3, 0.15, 0.28, 0.08, mat_black_trim)
    make_box("Mirror_R", 1.22, 1.55, 2.3, 0.15, 0.28, 0.08, mat_black_trim)

    # 4 Wheels (Front Z = 2.6, Rear Z = -1.6)
    for wz in [2.6, -1.6]:
        for wx in [-1.08, 1.08]:
            make_box(f"Tire_{wx}_{wz}", wx, 0.40, wz, 0.24, 0.80, 0.80, mat_tire)
            make_box(f"Rim_{wx}_{wz}", wx + (0.02 if wx > 0 else -0.02), 0.40, wz, 0.22, 0.50, 0.50, mat_rim)

    # 2. Gastro Container Box Body
    # Dimensions: width 2.3m (X: -1.15 to 1.15), length 4.4m (Z: -2.8 to 1.6), height 2.4m (Y: 0.5 to 2.9)
    make_box("Gastro_Box_Body", 0.0, 1.70, -0.6, 2.30, 2.35, 4.4, mat_body_main)
    # Black lower chassis skirt
    make_box("Gastro_Chassis_Skirt", 0.0, 0.42, -0.6, 2.26, 0.25, 4.3, mat_black_trim)

    # 3. Serving Window & Awning Flap on Right Side (+X = 1.15m)
    # Window opening: Z from -2.0 to 0.8 (length 2.8m), Y from 1.1 to 2.3 (height 1.2m)
    # Inside counter
    make_box("Interior_Counter", 0.85, 1.05, -0.6, 0.55, 0.10, 2.8, mat_counter)
    make_box("Interior_Backdrop", 0.0, 1.70, -0.6, 1.80, 2.20, 4.2, mat_black_trim)

    # Side Awning Flap: propped open upwards at ~25 deg angle on hydraulic struts
    awning_p0 = (1.16, 2.28, -2.0)
    awning_p1 = (1.16, 2.28, 0.8)
    awning_p2 = (2.15, 2.68, 0.8)
    awning_p3 = (2.15, 2.68, -2.0)
    make_textured_quad("Awning_Flap_Top", awning_p0, awning_p1, awning_p2, awning_p3, mat_body_main)
    make_textured_quad("Awning_Flap_Bot", awning_p3, awning_p2, awning_p1, awning_p0, mat_body_main)

    # Hydraulic gas struts holding the awning
    make_box("Awning_Strut_F", 1.65, 1.85, 0.75, 0.03, 0.95, 0.03, mat_rim)
    make_box("Awning_Strut_R", 1.65, 1.85, -1.95, 0.03, 0.95, 0.03, mat_rim)

    # Side Livery Graphic Panel on the right side next to window
    # Texture mapped across the side of the truck (looking towards -X, +Z is left, -Z is right)
    make_textured_quad(
        "Side_Livery_Right",
        (1.16, 0.55, 1.55),
        (1.16, 0.55, -2.75),
        (1.16, 2.85, -2.75),
        (1.16, 2.85, 1.55),
        mat_livery,
        uv_bounds=(0.0, 0.35, 1.0, 0.75)
    )

    # Menu Blackboard next to the window
    make_textured_quad(
        "Menu_Blackboard",
        (1.16, 1.15, -2.05),
        (1.16, 1.15, -2.70),
        (1.16, 2.25, -2.70),
        (1.16, 2.25, -2.05),
        mat_livery,
        uv_bounds=(0.0, 0.0, 1.0, 0.35)
    )

    # 4. Elevated Roof Marquee Signboard
    # Width 2.8m, Height 0.75m, mounted on roof (Y = 2.9m to 3.65m)
    make_box("Roof_Sign_Frame", 0.0, 3.25, -0.6, 0.12, 0.70, 2.80, mat_rim)
    make_textured_quad(
        "Roof_Sign_Face_R",
        (0.07, 2.92, 0.8),
        (0.07, 2.92, -2.0),
        (0.07, 3.62, -2.0),
        (0.07, 3.62, 0.8),
        mat_sign,
        uv_bounds=(0.0, 0.75, 1.0, 1.0)
    )
    make_textured_quad(
        "Roof_Sign_Face_L",
        (-0.07, 2.92, -2.0),
        (-0.07, 2.92, 0.8),
        (-0.07, 3.62, 0.8),
        (-0.07, 3.62, -2.0),
        mat_sign,
        uv_bounds=(0.0, 0.75, 1.0, 1.0)
    )
    # Floodlight over sign
    make_box("Sign_Spotlight", 0.50, 3.70, -0.6, 0.25, 0.14, 0.20, mat_black_trim)

    # Specific Equipment
    if fryer:
        # Fry warmer & basket on counter
        make_box("Fry_Warmer", 0.85, 1.25, 0.2, 0.45, 0.30, 0.70, mat_stainless)
    if griddle:
        # Flat top griddle & rooftop vent chimney
        make_box("Griddle_Unit", 0.85, 1.22, 0.2, 0.50, 0.25, 0.85, mat_stainless)
        make_box("Vent_Chimney", 0.0, 3.20, -0.2, 0.35, 0.55, 0.35, mat_stainless)
    if pasta:
        make_box("Pasta_Cooker", 0.85, 1.25, 0.2, 0.45, 0.30, 0.80, mat_stainless)

    if ladder:
        # Telescopic aluminum ladder leaning against front left corner (from photo media_1790645591100.png!)
        ladder_angle = math.radians(15)
        make_box("Ladder_Rail_L", 1.25, 1.45, 1.05, 0.04, 2.65, 0.04, mat_galv)
        make_box("Ladder_Rail_R", 1.25, 1.45, 1.45, 0.04, 2.65, 0.04, mat_galv)
        for r_step in range(8):
            ry = 0.35 + r_step * 0.30
            make_box(f"Ladder_Rung_{r_step}", 1.25, ry, 1.25, 0.03, 0.03, 0.38, mat_galv)

    export_glb(OUT_DIR / f"{name}.glb")

def build_all_foodtrucks():
    # 1. Frytki Belgijskie
    build_foodtruck_base(
        name="foodtruck_frytki",
        livery_texture="foodtruck_frytki.png",
        sign_texture="foodtruck_frytki.png",
        sign_text="FRYTKI BELGIJSKIE",
        body_color=(0.95, 0.95, 0.96, 1.0),
        fryer=True
    )

    # 2. Churros (with leaning ladder)
    build_foodtruck_base(
        name="foodtruck_churros",
        livery_texture="foodtruck_churros.png",
        sign_texture="foodtruck_churros.png",
        sign_text="CHURROS",
        body_color=(0.88, 0.35, 0.20, 1.0),
        ladder=True
    )

    # 3. Smash Burger & Zapiekanki XXL
    build_foodtruck_base(
        name="foodtruck_burger",
        livery_texture="foodtruck_burger.png",
        sign_texture="foodtruck_burger.png",
        sign_text="SMASH BURGERS",
        body_color=(0.12, 0.12, 0.14, 1.0),
        griddle=True
    )

    # 4. Makarun Spaghetti & Salad
    build_foodtruck_base(
        name="foodtruck_makarun",
        livery_texture="foodtruck_makarun.png",
        sign_texture="foodtruck_makarun.png",
        sign_text="MAKARUN",
        body_color=(0.95, 0.45, 0.08, 1.0),
        pasta=True
    )

# ==============================================================================
# 5. ROLLBAR LECH (PIWNY ROLLBAR Z NALEWAKAMI I PARASOLEM)
# ==============================================================================
def build_rollbar_lech():
    clear_scene()
    print("Building Authentic Lech Beer Rollbar Station...")

    mat_green = create_pbr_material("Lech_Green", "rollbar_lech.png", roughness=0.4, emissive_strength=0.15)
    mat_wood = create_pbr_material("Rollbar_Wood", base_color=(0.45, 0.32, 0.20, 1.0), roughness=0.6)
    mat_stainless = create_pbr_material("Beer_Stainless", base_color=(0.92, 0.94, 0.96, 1.0), roughness=0.15, metallic=0.95)
    mat_cup = create_pbr_material("Eco_Cup_Plastic", base_color=(0.90, 0.95, 0.92, 0.6), roughness=0.3, alpha_mode='BLEND', opacity=0.6)
    mat_parasol = create_pbr_material("Lech_Parasol_Green", base_color=(0.06, 0.25, 0.14, 1.0), roughness=0.7)
    mat_chassis = create_pbr_material("Trailer_Chassis", base_color=(0.18, 0.20, 0.22, 1.0), roughness=0.6, metallic=0.7)

    # Trailer Base Box (width 2.8m, depth 1.8m, counter height 1.1m)
    make_box("Rollbar_Body", 0.0, 0.55, 0.0, 2.70, 0.88, 1.70, mat_wood)
    # Front branded panel with Lech Shield
    make_textured_quad(
        "Rollbar_Front_Panel",
        (1.36, 0.12, 0.86),
        (-1.36, 0.12, 0.86),
        (-1.36, 1.02, 0.86),
        (1.36, 1.02, 0.86),
        mat_green,
        uv_bounds=(0.0, 0.30, 1.0, 0.70)
    )

    # Wooden service counter top
    make_box("Rollbar_Counter_Top", 0.0, 1.08, 0.0, 2.85, 0.08, 1.85, mat_wood)

    # Trailer wheels and axle
    make_box("Axle", 0.0, 0.22, 0.0, 2.80, 0.08, 0.08, mat_chassis)
    make_box("Wheel_L", -1.45, 0.30, 0.0, 0.20, 0.60, 0.60, mat_chassis)
    make_box("Wheel_R", 1.45, 0.30, 0.0, 0.20, 0.60, 0.60, mat_chassis)
    # Trailer hitch tow bar
    make_box("Tow_Hitch", 0.0, 0.28, -1.35, 0.12, 0.08, 1.20, mat_chassis)

    # Dual Draft Beer Dispensing Towers (Kolumny do piwa)
    for t_idx, tx in enumerate([-0.65, 0.65]):
        # Chrome cylinder tower
        make_box(f"Tap_Tower_{t_idx}", tx, 1.35, 0.25, 0.14, 0.46, 0.14, mat_stainless)
        # 2 Beer tap faucets pointing forward
        for f_idx, fx in enumerate([-0.05, 0.05]):
            make_box(f"Faucet_{t_idx}_{f_idx}", tx + fx, 1.45, 0.36, 0.03, 0.04, 0.12, mat_stainless)
            # Black tap handle
            make_box(f"Tap_Handle_{t_idx}_{f_idx}", tx + fx, 1.55, 0.38, 0.025, 0.14, 0.025, mat_chassis)
        # Stainless drip tray with grid under taps
        make_box(f"Drip_Tray_{t_idx}", tx, 1.13, 0.42, 0.45, 0.03, 0.26, mat_stainless)

    # Stacks of festival eco reusable cups (Kubki festiwalowe)
    for c_stack in range(3):
        cx = -0.15 + c_stack * 0.15
        make_box(f"Cup_Stack_{c_stack}", cx, 1.30, 0.25, 0.10, 0.36, 0.10, mat_cup)

    # Overhead Center Mast & Large Branded Hexagonal Umbrella / Parasol
    make_box("Parasol_Mast", 0.0, 2.10, 0.0, 0.08, 2.10, 0.08, mat_chassis)

    # Hexagonal umbrella canopy (radius ~2.2m, height 0.6m at Y = 3.1m to 3.7m)
    p_rad = 2.2
    num_pts = 6
    for i in range(num_pts):
        a1 = math.radians(i * 60)
        a2 = math.radians((i + 1) * 60)
        x1, z1 = p_rad * math.cos(a1), p_rad * math.sin(a1)
        x2, z2 = p_rad * math.cos(a2), p_rad * math.sin(a2)
        # Triangle panel
        make_textured_quad(
            f"Parasol_Panel_{i}",
            (x1, 3.1, z1),
            (x2, 3.1, z2),
            (0.0, 3.7, 0.0),
            (0.0, 3.7, 0.0),
            mat_parasol
        )

    # Branded Header Sign mounted under the umbrella
    make_textured_quad(
        "Rollbar_Header_Sign",
        (1.2, 2.65, 0.0),
        (-1.2, 2.65, 0.0),
        (-1.2, 3.05, 0.0),
        (1.2, 3.05, 0.0),
        mat_green,
        uv_bounds=(0.0, 0.0, 1.0, 0.30)
    )

    export_glb(OUT_DIR / "rollbar_lech.glb")


def main():
    print("=" * 60)
    print("Starting Pol'and'Rock 2026 Gastro Zone & Props Generation")
    print("=" * 60)

    build_water_curtain()
    build_crowd_barrier()
    build_festival_food_tent()
    build_all_foodtrucks()
    build_rollbar_lech()

    print("=" * 60)
    print("All Gastro Zone models built successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
