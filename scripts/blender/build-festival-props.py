"""
Pol'and'Rock Festival 2026 - Procedural 3D Props Generator (PyData Clean Geometry)
Builds authentic festival environment props in Blender 5.0:
1. trash_corral.glb ("Zaraz Będzie Czysto" waste corral & 4 sorting stands)
2. festival_signpost.glb (Directional wooden totem with painted arrow signs)
3. foh_tower.glb (FOH audio/lighting mixing tower with desks and flight cases)
4. patrol_tent.glb (Pokojowy Patrol first aid / information marquee tent)
5. water_curtain.glb (Kurtyna Wodna cooling mist arch)
"""

import os
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
TEXTURES_DIR = ROOT / "public" / "game-assets" / "world" / "festival" / "textures"
OUT_DIR = ROOT / "public" / "game-assets" / "world" / "festival"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Coordinate adapter: Three.js (X, Y up, Z front) -> Blender (X, -Z, Y up)
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
                        emissive_color=(1.0, 1.0, 1.0, 1.0)):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links

    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new("ShaderNodeBsdfPrincipled")

    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if texture_name:
        tex_path = TEXTURES_DIR / texture_name
        if tex_path.exists():
            img = bpy.data.images.load(str(tex_path))
            img.colorspace_settings.name = 'sRGB'
            tex_node = nodes.new("ShaderNodeTexImage")
            tex_node.image = img
            links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
            if emissive_strength > 0:
                links.new(tex_node.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
            return mat

    bsdf.inputs["Base Color"].default_value = base_color
    if emissive_strength > 0:
        bsdf.inputs["Emission Color"].default_value = emissive_color
        bsdf.inputs["Emission Strength"].default_value = emissive_strength

    return mat

def make_box(name, cx, cy, cz, sx, sy, sz, mat):
    """Creates a box with Three.js coordinates (cx, cy, cz) and dimensions (sx, sy, sz)"""
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
        (0, 1, 2, 3), # rear (-Z)
        (4, 5, 6, 7), # front (+Z)
        (0, 4, 7, 3), # left (-X)
        (1, 2, 6, 5), # right (+X)
        (3, 2, 6, 7), # top (+Y)
        (0, 1, 5, 4), # bottom (-Y)
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(b_verts, [], faces)
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    uvs_box = [
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
        ((0,0), (1,0), (1,1), (0,1)),
    ]
    for p_idx, poly in enumerate(mesh.polygons):
        for l_idx, loop in enumerate(poly.loop_indices):
            uv_layer.data[loop].uv = uvs_box[p_idx][l_idx]

    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_textured_quad(name, p0_t, p1_t, p2_t, p3_t, mat, uvs=((0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0))):
    verts = [t3(*p0_t), t3(*p1_t), t3(*p2_t), t3(*p3_t)]
    faces = [(0, 1, 2, 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    poly = mesh.polygons[0]
    for loop_idx, loop in enumerate(poly.loop_indices):
        uv_layer.data[loop].uv = uvs[loop_idx]
    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def make_vertical_cylinder(name, cx, cy, cz, r, h, mat, segments=16):
    """Vertical cylinder along Y axis centered at (cx, cy, cz)"""
    verts = []
    half_h = h / 2.0
    for i in range(segments):
        theta = i * (2.0 * math.pi / segments)
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        # bottom ring
        verts.append(t3(cx + r * cos_t, cy - half_h, cz + r * sin_t))
        # top ring
        verts.append(t3(cx + r * cos_t, cy + half_h, cz + r * sin_t))

    faces = []
    for i in range(segments):
        b0 = i * 2
        t0 = i * 2 + 1
        b1 = ((i + 1) % segments) * 2
        t1 = ((i + 1) % segments) * 2 + 1
        faces.append((b0, b1, t1, t0))

    # top cap & bottom cap
    verts.append(t3(cx, cy - half_h, cz)) # bottom center
    bot_center = len(verts) - 1
    verts.append(t3(cx, cy + half_h, cz)) # top center
    top_center = len(verts) - 1

    for i in range(segments):
        b0 = i * 2
        b1 = ((i + 1) % segments) * 2
        faces.append((bot_center, b1, b0))
        t0 = i * 2 + 1
        t1 = ((i + 1) % segments) * 2 + 1
        faces.append((top_center, t0, t1))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop in poly.loop_indices:
            uv_layer.data[loop].uv = (0.5, 0.5)

    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    bpy.context.collection.objects.link(obj)
    return obj

def export_glb(filepath):
    bpy.ops.object.select_all(action='SELECT')
    print(f"Exporting GLB to {filepath}...")
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format='GLB',
        use_selection=False,
        export_apply=True,
        export_yup=True
    )
    size = os.path.getsize(filepath)
    print(f"Exported {Path(filepath).name}: {size} bytes ({size / 1024:.1f} KB)")

# ==============================================================================
# 1. TRASH CORRAL ("Zaraz Będzie Czysto" waste corral & 4 sorting stands)
# ==============================================================================
def build_trash_corral():
    clear_scene()
    print("Building Trash Corral ('Zaraz Będzie Czysto')...")

    mat_wood = create_pbr_material("Corral_Wood", base_color=(0.55, 0.40, 0.25, 1.0), roughness=0.85)
    mat_banner = create_pbr_material("Corral_Banner", "zaraz_bedzie_czysto_corral.png", roughness=0.6, emissive_strength=0.15)
    mat_metal = create_pbr_material("Corral_Metal", base_color=(0.3, 0.32, 0.35, 1.0), roughness=0.4, metallic=0.8)

    # 4 Sorting Sacks materials
    mat_sack_yellow = create_pbr_material("Sack_Yellow", base_color=(0.95, 0.75, 0.05, 1.0), roughness=0.35)
    mat_sack_blue   = create_pbr_material("Sack_Blue",   base_color=(0.15, 0.45, 0.90, 1.0), roughness=0.35)
    mat_sack_green  = create_pbr_material("Sack_Green",  base_color=(0.10, 0.65, 0.25, 1.0), roughness=0.35)
    mat_sack_black  = create_pbr_material("Sack_Black",  base_color=(0.20, 0.22, 0.24, 1.0), roughness=0.45)

    # Pallet ground deck (Width=4.4m, Depth=2.2m, Height=0.12m)
    make_box("Pallet_Base", 0.0, 0.06, 0.0, 4.4, 0.12, 2.2, mat_wood)
    for sx in [-1.8, -0.6, 0.6, 1.8]:
        make_box(f"Pallet_Stringer_{sx}", sx, 0.05, 0.0, 0.12, 0.10, 2.2, mat_wood)

    # Fence corner & support timber posts (height = 1.35m)
    post_coords = [
        (-2.2, -1.1), (-2.2, 1.1),
        (2.2, -1.1),  (2.2, 1.1),
        (-0.7, -1.1), (0.7, -1.1),
        (-2.2, 0.0),  (2.2, 0.0)
    ]
    for idx, (px, pz) in enumerate(post_coords):
        make_box(f"Fence_Post_{idx}", px, 0.675, pz, 0.12, 1.35, 0.12, mat_wood)

    # Horizontal wooden rails:
    # Back rails (-Z side)
    make_box("Rail_Back_Top", 0.0, 1.25, -1.1, 4.4, 0.06, 0.04, mat_wood)
    make_box("Rail_Back_Mid", 0.0, 0.65, -1.1, 4.4, 0.06, 0.04, mat_wood)
    make_box("Rail_Back_Bot", 0.0, 0.25, -1.1, 4.4, 0.06, 0.04, mat_wood)

    # Left rails (-X side)
    make_box("Rail_Left_Top", -2.2, 1.25, 0.0, 0.04, 0.06, 2.2, mat_wood)
    make_box("Rail_Left_Mid", -2.2, 0.65, 0.0, 0.04, 0.06, 2.2, mat_wood)

    # Right rails (+X side)
    make_box("Rail_Right_Top", 2.2, 1.25, 0.0, 0.04, 0.06, 2.2, mat_wood)
    make_box("Rail_Right_Mid", 2.2, 0.65, 0.0, 0.04, 0.06, 2.2, mat_wood)

    # Front rails (+Z side, with central pedestrian opening)
    make_box("Rail_Front_Left_Top",  -1.6, 1.25, 1.1, 1.2, 0.06, 0.04, mat_wood)
    make_box("Rail_Front_Left_Mid",  -1.6, 0.65, 1.1, 1.2, 0.06, 0.04, mat_wood)
    make_box("Rail_Front_Right_Top",  1.6, 1.25, 1.1, 1.2, 0.06, 0.04, mat_wood)
    make_box("Rail_Front_Right_Mid",  1.6, 0.65, 1.1, 1.2, 0.06, 0.04, mat_wood)

    # Main "Zaraz Będzie Czysto!" Banner mounted across the back fence interior (+Z facing)
    make_textured_quad(
        "Banner_Zaraz_Bedzie_Czysto",
        (-2.1, 0.25, -1.06), (2.1, 0.25, -1.06),
        (2.1, 1.25, -1.06), (-2.1, 1.25, -1.06),
        mat_banner
    )
    # Double-sided for exterior view (-Z facing)
    make_textured_quad(
        "Banner_Zaraz_Bedzie_Czysto_Ext",
        (2.1, 0.25, -1.14), (-2.1, 0.25, -1.14),
        (-2.1, 1.25, -1.14), (2.1, 1.25, -1.14),
        mat_banner
    )

    # 4 Sorting Stands inside the corral:
    # Yellow (Plastik), Blue (Papier), Green (Szkło), Black (Zmieszane)
    stand_configs = [
        ("Yellow_Plastik", -1.4, mat_sack_yellow, (0.95, 0.75, 0.05, 1.0)),
        ("Blue_Papier",    -0.45, mat_sack_blue,   (0.15, 0.45, 0.90, 1.0)),
        ("Green_Szklo",     0.45, mat_sack_green,  (0.10, 0.65, 0.25, 1.0)),
        ("Black_Zmieszane", 1.4, mat_sack_black,  (0.25, 0.28, 0.30, 1.0)),
    ]

    for name, sx, sack_mat, hoop_color in stand_configs:
        mat_hoop = create_pbr_material(f"Hoop_{name}", base_color=hoop_color, roughness=0.4)

        # Stand metal frame legs (tubular base)
        make_box(f"Stand_Leg_L_{name}", sx - 0.26, 0.55, 0.0, 0.035, 1.0, 0.035, mat_metal)
        make_box(f"Stand_Leg_R_{name}", sx + 0.26, 0.55, 0.0, 0.035, 1.0, 0.035, mat_metal)

        # Stand top bag-holding ring / hoop
        make_vertical_cylinder(f"Stand_Hoop_{name}", sx, 1.02, 0.0, 0.28, 0.06, mat_hoop, segments=16)

        # Bulging full garbage sack
        make_vertical_cylinder(f"Sack_Base_{name}", sx, 0.48, 0.0, 0.26, 0.65, sack_mat, segments=12)
        make_vertical_cylinder(f"Sack_Mid_{name}",  sx, 0.68, 0.0, 0.29, 0.35, sack_mat, segments=12)
        make_vertical_cylinder(f"Sack_Neck_{name}", sx, 0.95, 0.0, 0.25, 0.15, sack_mat, segments=12)

    export_glb(OUT_DIR / "trash_corral.glb")

# ==============================================================================
# 2. FESTIVAL SIGNPOST (Multi-directional wooden landmark totem)
# ==============================================================================
def build_festival_signpost():
    clear_scene()
    print("Building Festival Directional Signpost...")

    mat_timber = create_pbr_material("Post_Timber", base_color=(0.48, 0.35, 0.22, 1.0), roughness=0.9)
    mat_metal = create_pbr_material("Post_Metal", base_color=(0.25, 0.26, 0.28, 1.0), roughness=0.5, metallic=0.7)
    mat_sunflower = create_pbr_material("Sunflower_Yellow", base_color=(0.95, 0.70, 0.05, 1.0), roughness=0.5)
    mat_heart_red = create_pbr_material("Heart_Red", base_color=(0.85, 0.12, 0.12, 1.0), roughness=0.4)
    mat_signs = create_pbr_material("Festival_Signs_Atlas", "festival_directional_signs.png", roughness=0.6)

    # Vertical rustic timber mast (height = 3.8m, diameter = 0.16m)
    make_vertical_cylinder("Signpost_Mast", 0.0, 1.9, 0.0, 0.08, 3.8, mat_timber, segments=12)

    # Steel ground collar anchor plate
    make_box("Ground_Anchor_Plate", 0.0, 0.015, 0.0, 0.6, 0.03, 0.6, mat_metal)
    for bx in [-0.22, 0.22]:
        for bz in [-0.22, 0.22]:
            make_vertical_cylinder(f"Ground_Bolt_{bx}_{bz}", bx, 0.03, bz, 0.02, 0.06, mat_metal, segments=6)

    # Splayed timber support braces at the bottom
    for angle_deg in [0, 90, 180, 270]:
        rad = math.radians(angle_deg)
        bx = 0.32 * math.cos(rad)
        bz = 0.32 * math.sin(rad)
        make_box(f"Brace_{angle_deg}", bx, 0.35, bz, 0.08, 0.7, 0.08, mat_timber)

    # 6 Directional Arrow Wooden Planks at various heights and angles
    plank_configs = [
        ("Plank_Duza_Scena",       2.1,  math.radians(25),   0),
        ("Plank_ASP",              2.4,  math.radians(-145), 1),
        ("Plank_Wioska_Kryszny",   2.7,  math.radians(85),   2),
        ("Plank_Pokojowy_Patrol",  3.0,  math.radians(-75),  3),
        ("Plank_Pole_Namiotowe",   3.3,  math.radians(135),  4),
        ("Plank_Grzybek_Wodny",    3.6,  math.radians(-25),  5),
    ]

    for name, py, rot_y, atlas_row in plank_configs:
        # UV slice for this plank in the 8-row atlas
        v0 = 1.0 - (atlas_row + 1) * 0.125
        v1 = 1.0 - atlas_row * 0.125

        # Oriented wooden plank arm: 1.35m long, 0.22m tall, 0.04m thick
        cos_r = math.cos(rot_y)
        sin_r = math.sin(rot_y)
        off_x = 0.58 * cos_r
        off_z = 0.58 * sin_r

        # Create oriented quad for front & back of plank
        half_w = 0.65
        half_h = 0.11
        p0 = (off_x - half_w * cos_r, py - half_h, off_z - half_w * sin_r)
        p1 = (off_x + half_w * cos_r, py - half_h, off_z + half_w * sin_r)
        p2 = (off_x + half_w * cos_r, py + half_h, off_z + half_w * sin_r)
        p3 = (off_x - half_w * cos_r, py + half_h, off_z - half_w * sin_r)

        make_textured_quad(f"{name}_Front", p0, p1, p2, p3, mat_signs, uvs=((0.0, v0), (1.0, v0), (1.0, v1), (0.0, v1)))
        make_textured_quad(f"{name}_Back",  p1, p0, p3, p2, mat_signs, uvs=((1.0, v0), (0.0, v0), (0.0, v1), (1.0, v1)))

        # Timber core backing
        make_box(f"{name}_Core", off_x, py, off_z, 0.14, 0.22, 0.14, mat_timber)
        make_vertical_cylinder(f"{name}_Bracket", 0.0, py, 0.0, 0.09, 0.08, mat_metal, segments=8)

    # Top Finial: Woodstock Peace Sunflower / Heart Crest at 3.95m
    make_box("Top_Sunflower_Center", 0.0, 3.95, 0.0, 0.28, 0.28, 0.05, mat_heart_red)
    for p in range(8):
        prad = math.radians(p * 45)
        px = 0.24 * math.cos(prad)
        py = 3.95 + 0.24 * math.sin(prad)
        make_box(f"Petal_{p}", px, py, 0.0, 0.10, 0.10, 0.04, mat_sunflower)

    export_glb(OUT_DIR / "festival_signpost.glb")

# ==============================================================================
# 3. FOH MIXING TOWER (Front of House audio & lighting tower)
# ==============================================================================
def build_foh_tower():
    clear_scene()
    print("Building FOH Mixing Tower...")

    mat_scaffold = create_pbr_material("Scaffold_Steel", base_color=(0.75, 0.77, 0.80, 1.0), roughness=0.35, metallic=0.85)
    mat_deck = create_pbr_material("Deck_Plywood", base_color=(0.35, 0.28, 0.22, 1.0), roughness=0.9)
    mat_tarp = create_pbr_material("Roof_Tarpaulin", base_color=(0.12, 0.14, 0.16, 1.0), roughness=0.7)
    mat_console = create_pbr_material("Audio_Console_Face", "foh_audio_console.png", roughness=0.4, emissive_strength=0.3)
    mat_banner = create_pbr_material("FOH_Crew_Banner", "foh_banner.png", roughness=0.6, emissive_strength=0.2)
    mat_case = create_pbr_material("Flight_Case", base_color=(0.10, 0.11, 0.12, 1.0), roughness=0.5)

    # 4 Main corner scaffolding uprights (Width=5.2m, Depth=3.6m, Height=4.2m)
    cols = [(-2.6, -1.8), (-2.6, 1.8), (2.6, -1.8), (2.6, 1.8)]
    for idx, (cx, cz) in enumerate(cols):
        make_vertical_cylinder(f"Scaffold_Upright_{idx}", cx, 2.1, cz, 0.045, 4.2, mat_scaffold, segments=8)
        make_box(f"Base_Foot_{idx}", cx, 0.025, cz, 0.3, 0.05, 0.3, mat_scaffold)

    # Scaffolding horizontal ring ledgers at Y = 1.4m, 2.4m, 4.0m
    for y_level in [1.4, 2.4, 4.0]:
        make_box(f"Ledger_Front_{y_level}", 0.0, y_level, 1.8, 5.2, 0.06, 0.06, mat_scaffold)
        make_box(f"Ledger_Back_{y_level}",  0.0, y_level, -1.8, 5.2, 0.06, 0.06, mat_scaffold)
        make_box(f"Ledger_Left_{y_level}",  -2.6, y_level, 0.0, 0.06, 0.06, 3.6, mat_scaffold)
        make_box(f"Ledger_Right_{y_level}",  2.6, y_level, 0.0, 0.06, 0.06, 3.6, mat_scaffold)

    # Platform riser floor at Y = 1.45m
    make_box("FOH_Platform_Floor", 0.0, 1.44, 0.0, 5.2, 0.08, 3.6, mat_deck)

    # Safety Guardrails around upper perimeter
    make_box("Guardrail_Back",   0.0, 2.45, -1.78, 5.2, 0.05, 0.05, mat_scaffold)
    make_box("Guardrail_Left",  -2.58, 2.45, 0.0, 0.05, 0.05, 3.6, mat_scaffold)
    make_box("Guardrail_Right",  2.58, 2.45, 0.0, 0.05, 0.05, 3.6, mat_scaffold)

    # Canopy Roof at Y = 4.15m
    make_box("FOH_Roof_Tarp", 0.0, 4.15, 0.0, 5.6, 0.10, 4.2, mat_tarp)

    # Front Hanging Banner ("FRONT OF HOUSE • REŻYSERIA DŹWIĘKU") at Y = 0.75m facing +Z
    make_textured_quad(
        "FOH_Front_Banner",
        (-2.55, 0.15, 1.82), (2.55, 0.15, 1.82),
        (2.55, 1.38, 1.82), (-2.55, 1.38, 1.82),
        mat_banner
    )
    make_textured_quad(
        "FOH_Front_Banner_Back",
        (2.55, 0.15, 1.80), (-2.55, 0.15, 1.80),
        (-2.55, 1.38, 1.80), (2.55, 1.38, 1.80),
        mat_banner
    )

    # Audio Console Desk (Center-Left)
    make_box("Audio_Desk_Stand", -0.8, 1.88, 0.5, 1.8, 0.85, 0.9, mat_case)
    make_textured_quad(
        "Audio_Console_Face",
        (-1.65, 2.30, 0.95), (0.05, 2.30, 0.95),
        (0.05, 2.45, 0.15), (-1.65, 2.45, 0.15),
        mat_console
    )

    # Lighting Console Desk (Center-Right)
    make_box("Lighting_Desk_Stand", 1.1, 1.88, 0.5, 1.4, 0.85, 0.9, mat_case)
    make_textured_quad(
        "Lighting_Console_Face",
        (0.40, 2.30, 0.95), (1.80, 2.30, 0.95),
        (1.80, 2.45, 0.15), (0.40, 2.45, 0.15),
        mat_console
    )

    # Stacked Road Flight Cases on the back wall
    for c_idx, (fx, fz, fh) in enumerate([(-1.8, -1.1, 0.6), (-1.8, -1.1, 1.2), (1.8, -1.1, 0.75), (0.0, -1.2, 0.55)]):
        make_box(f"FlightCase_{c_idx}", fx, 1.48 + fh - 0.28, fz, 0.9, 0.55, 0.6, mat_case)

    export_glb(OUT_DIR / "foh_tower.glb")

# ==============================================================================
# 4. POKOJOWY PATROL TENT (First Aid / Info Marquee Gazebo)
# ==============================================================================
def build_patrol_tent():
    clear_scene()
    print("Building Pokojowy Patrol Tent...")

    mat_tent = create_pbr_material("Patrol_Fabric", "pokojowy_patrol_tent.png", roughness=0.6)
    mat_frame = create_pbr_material("Alu_Frame", base_color=(0.85, 0.86, 0.88, 1.0), roughness=0.3, metallic=0.9)
    mat_table = create_pbr_material("Table_White", base_color=(0.95, 0.95, 0.95, 1.0), roughness=0.5)
    mat_med_red = create_pbr_material("Med_Red", base_color=(0.85, 0.12, 0.12, 1.0), roughness=0.4)
    mat_patrol_yellow = create_pbr_material("Patrol_Yellow", base_color=(0.98, 0.80, 0.08, 1.0), roughness=0.5)

    # 4 Aluminum square legs (height = 2.2m)
    leg_coords = [(-1.95, -1.95), (-1.95, 1.95), (1.95, -1.95), (1.95, 1.95)]
    for idx, (lx, lz) in enumerate(leg_coords):
        make_box(f"Tent_Leg_{idx}", lx, 1.1, lz, 0.08, 2.2, 0.08, mat_frame)
        make_box(f"Foot_Plate_{idx}", lx, 0.015, lz, 0.22, 0.03, 0.22, mat_frame)

    # Perimeter header eaves at Y = 2.2m
    make_box("Eave_Front", 0.0, 2.2, 1.95, 3.9, 0.08, 0.08, mat_frame)
    make_box("Eave_Back",  0.0, 2.2, -1.95, 3.9, 0.08, 0.08, mat_frame)
    make_box("Eave_Left", -1.95, 2.2, 0.0, 0.08, 0.08, 3.9, mat_frame)
    make_box("Eave_Right", 1.95, 2.2, 0.0, 0.08, 0.08, 3.9, mat_frame)

    # Pyramidal fabric roof canopy: 4 sloped facets rising to peak at (0, 3.3, 0)
    peak = (0.0, 3.3, 0.0)
    c_fl = (-2.0, 2.2,  2.0)
    c_fr = ( 2.0, 2.2,  2.0)
    c_br = ( 2.0, 2.2, -2.0)
    c_bl = (-2.0, 2.2, -2.0)

    # Triangular roof facets using make_textured_quad (degenerated quad)
    make_textured_quad("Roof_Front", c_fl, c_fr, peak, peak, mat_tent)
    make_textured_quad("Roof_Back",  c_br, c_bl, peak, peak, mat_tent)
    make_textured_quad("Roof_Left",  c_bl, c_fl, peak, peak, mat_tent)
    make_textured_quad("Roof_Right", c_fr, c_br, peak, peak, mat_tent)

    # Front Valance banner ("POKOJOWY PATROL") at Y = 2.05m
    make_textured_quad(
        "Valance_Front",
        (-2.02, 1.85, 2.02), (2.02, 1.85, 2.02),
        (2.02, 2.25, 2.02), (-2.02, 2.25, 2.02),
        mat_tent, uvs=((0.0, 0.78), (1.0, 0.78), (1.0, 1.0), (0.0, 1.0))
    )

    # Rear Enclosure Wall (Backdrop)
    make_textured_quad(
        "Tent_Wall_Back",
        (-1.95, 0.0, -1.95), (1.95, 0.0, -1.95),
        (1.95, 2.2, -1.95), (-1.95, 2.2, -1.95),
        mat_tent
    )

    # Front Reception: Folding Trestle Table
    make_box("Patrol_Table_Top", 0.0, 0.78, 0.8, 2.0, 0.05, 0.8, mat_table)
    for tx in [-0.85, 0.85]:
        for tz in [0.55, 1.05]:
            make_vertical_cylinder(f"Table_Leg_{tx}_{tz}", tx, 0.40, tz, 0.02, 0.75, mat_frame, segments=6)

    # Medical Emergency First-Aid Kit cases on the table
    make_box("Med_Kit_1", -0.5, 0.92, 0.8, 0.45, 0.22, 0.32, mat_med_red)
    make_box("Med_Kit_2",  0.3, 0.90, 0.85, 0.40, 0.18, 0.28, mat_patrol_yellow)

    # Two Peace Patrol Feather / Winder Flags flanking the entrance
    for f_idx, fx in enumerate([-2.3, 2.3]):
        make_vertical_cylinder(f"Flagpole_{f_idx}", fx, 1.6, 2.1, 0.025, 3.2, mat_frame, segments=8)
        # Teardrop flag fabric
        flag_ox = 0.35 if fx > 0 else -0.35
        make_box(f"Feather_Flag_{f_idx}", fx + flag_ox, 2.0, 2.1, 0.65, 2.2, 0.02, mat_patrol_yellow)

    export_glb(OUT_DIR / "patrol_tent.glb")

# ==============================================================================
# 5. WATER CURTAIN (Kurtyna Wodna cooling mist arch)
# ==============================================================================
def build_water_curtain():
    clear_scene()
    print("Building Kurtyna Wodna (Misting Arch)...")

    mat_truss = create_pbr_material("Truss_Alu", base_color=(0.82, 0.84, 0.86, 1.0), roughness=0.3, metallic=0.9)
    mat_water_pipe = create_pbr_material("Water_Pipe_Blue", base_color=(0.10, 0.50, 0.90, 1.0), roughness=0.4)
    mat_brass = create_pbr_material("Brass_Nozzle", base_color=(0.85, 0.70, 0.25, 1.0), roughness=0.35, metallic=0.8)
    mat_sign = create_pbr_material("Curtain_Sign_Tex", "kurtyna_wodna_sign.png", roughness=0.5, emissive_strength=0.2)
    mat_ballast = create_pbr_material("Concrete_Ballast", base_color=(0.45, 0.46, 0.48, 1.0), roughness=0.9)

    # Base ballast blocks
    make_box("Ballast_Left",  -2.2, 0.175, 0.0, 1.2, 0.35, 1.2, mat_ballast)
    make_box("Ballast_Right",  2.2, 0.175, 0.0, 1.2, 0.35, 1.2, mat_ballast)

    # 2 Vertical Box Truss Columns (4 chords each)
    for col_name, cx in [("Left", -2.2), ("Right", 2.2)]:
        for ox in [-0.15, 0.15]:
            for oz in [-0.15, 0.15]:
                make_vertical_cylinder(f"Chord_{col_name}_{ox}_{oz}", cx + ox, 2.05, oz, 0.025, 3.5, mat_truss, segments=6)
        for step in range(7):
            ly = 0.55 + step * 0.45
            make_box(f"Lacing_{col_name}_{step}", cx, ly, 0.0, 0.30, 0.03, 0.30, mat_truss)

    # Horizontal Box Truss Header (Length = 4.8m at Y = 3.65m)
    for oy in [-0.15, 0.15]:
        for oz in [-0.15, 0.15]:
            make_box(f"Header_Chord_{oy}_{oz}", 0.0, 3.65 + oy, oz, 4.8, 0.04, 0.04, mat_truss)

    # Blue high-pressure water pipe
    make_box("Water_Supply_Pipe", 0.0, 3.48, 0.0, 4.6, 0.06, 0.06, mat_water_pipe)

    # Row of 10 Brass Misting Nozzles pointing downward
    for i in range(10):
        nx = -1.8 + i * 0.4
        make_vertical_cylinder(f"Nozzle_{i}", nx, 3.40, 0.0, 0.018, 0.08, mat_brass, segments=6)

    # Main Header Sign ("KURTYNA WODNA - OCHŁOŃ!")
    make_textured_quad(
        "Curtain_Sign_Front",
        (-1.4, 3.82, 0.03), (1.4, 3.82, 0.03),
        (1.4, 4.68, 0.03), (-1.4, 4.68, 0.03),
        mat_sign
    )
    make_textured_quad(
        "Curtain_Sign_Back",
        (1.4, 3.82, -0.03), (-1.4, 3.82, -0.03),
        (-1.4, 4.68, -0.03), (1.4, 4.68, -0.03),
        mat_sign
    )

    export_glb(OUT_DIR / "water_curtain.glb")

def main():
    print("=" * 60)
    print("Starting Pol'and'Rock 2026 Festival Props Generation")
    print("=" * 60)
    build_trash_corral()
    build_festival_signpost()
    build_foh_tower()
    build_patrol_tent()
    build_water_curtain()
    print("=" * 60)
    print("All festival props successfully generated with PyData!")
    print("=" * 60)

if __name__ == "__main__":
    main()
