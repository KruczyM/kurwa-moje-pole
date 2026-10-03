"""
Decimate heavy models in kurwa-moje-pole using Blender 5.2.2 LTS.
Usage:
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" -b --factory-startup -P scripts/blender/decimate-heavy-models-52.py
"""
import sys
import os
import shutil
import time
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parent.parent.parent
ASSETS_DIR = ROOT / "public" / "game-assets"
DIST_ASSETS_DIR = ROOT / "dist" / "game-assets"
BACKUP_DIR = ROOT / "reports" / "model-backups"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

TARGET_MODELS = [
    {
        "rel_path": "world/tents/upgraded/main.glb",
        "ratio": 0.11,   # 352k -> ~39k trójkątów (redukcja o 89%)
        "description": "Namiot główny festiwalu",
    },
    {
        "rel_path": "interactables/lsd.glb",
        "ratio": 0.025,  # 160k -> ~4k trójkątów (redukcja o 97.5%)
        "description": "Rekwizyt znaczka LSD na stole",
    },
    {
        "rel_path": "world/festival/marketStalls.glb",
        "ratio": 0.45,   # 91k -> ~41k trójkątów
        "description": "Kramy festiwalowe",
    },
    {
        "rel_path": "npc_models/dino.glb",
        "ratio": 0.33,   # 121k -> ~40k trójkątów (standard pozostałych 90 NPC)
        "description": "NPC w stroju dinozaura (Dino)",
    },
]


def count_triangles():
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            mesh = obj.data
            for poly in mesh.polygons:
                v_count = len(poly.vertices)
                if v_count == 3:
                    total += 1
                elif v_count == 4:
                    total += 2
                else:
                    total += v_count - 2
    return total


def decimate_single_model(config):
    rel_path = config["rel_path"]
    ratio = config["ratio"]
    desc = config["description"]

    input_file = ASSETS_DIR / rel_path
    if not input_file.exists():
        print(f"[SKIP] Nie znaleziono: {input_file}")
        return

    # Kopia zapasowa (tylko jeśli jeszcze nie istnieje, by zachować oryginał)
    backup_file = BACKUP_DIR / rel_path.replace("/", "_")
    if not backup_file.exists():
        shutil.copy2(input_file, backup_file)
        print(f"[BACKUP] Utworzono kopię zapasową oryginału: {backup_file.name}")
    else:
        print(f"[BACKUP] Kopia zapasowa już istnieje: {backup_file.name}")

    start_time = time.time()
    file_size_before_kb = input_file.stat().st_size / 1024
    print(f"\n=======================================================")
    print(f"Blender 5.2 decymacja: {desc}")
    print(f"Plik: {rel_path} ({file_size_before_kb:.1f} KB)")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(input_file))

    tris_before = count_triangles()
    print(f"Trójkąty przed decymacją: {tris_before:,}")

    mesh_count = 0
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            poly_count = len(obj.data.polygons)
            # Pomijamy miniaturowe elementy w marketStalls (np. literki tabliczek reklamowych)
            if poly_count < 100:
                continue

            mesh_count += 1
            armature_mod = None
            for mod in obj.modifiers:
                if mod.type == 'ARMATURE':
                    armature_mod = mod
                    break

            dec_mod = obj.modifiers.new(name="Decimate52", type="DECIMATE")
            dec_mod.decimate_type = 'COLLAPSE'
            dec_mod.ratio = ratio
            dec_mod.use_collapse_triangulate = True

            # Dla SkinnedMesh (z armature): decymacja musi być PRZED Armature w stosie
            if armature_mod:
                while obj.modifiers[0].name != dec_mod.name:
                    bpy.context.view_layer.objects.active = obj
                    bpy.ops.object.modifier_move_up(modifier=dec_mod.name)

    print(f"Zastosowano Decimate (ratio={ratio}) do {mesh_count} siatek...")

    temp_out = input_file.with_name(f"{input_file.stem}.b52_tmp.glb")
    if temp_out.exists():
        temp_out.unlink()

    bpy.ops.export_scene.gltf(
        filepath=str(temp_out),
        export_format='GLB',
        export_apply=True,
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_materials='EXPORT',
        export_texcoords=True,
        export_normals=True,
    )

    if temp_out.exists() and temp_out.stat().st_size > 1000:
        # Zweryfikuj trójkąty w wyeksportowanym pliku
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(temp_out))
        tris_after = count_triangles()

        shutil.move(temp_out, input_file)
        file_size_after_kb = input_file.stat().st_size / 1024
        elapsed = time.time() - start_time

        # Jeśli istnieje plik w dist, również go aktualizujemy
        dist_file = DIST_ASSETS_DIR / rel_path
        if dist_file.exists():
            shutil.copy2(input_file, dist_file)

        saved_kb = file_size_before_kb - file_size_after_kb
        reduction_pct = (1 - (tris_after / max(1, tris_before))) * 100
        print(f"[OK] Sukces! Zapisano w {elapsed:.2f} s")
        print(f"Trójkąty: {tris_before:,} -> {tris_after:,} (-{reduction_pct:.1f}%)")
        print(f"Rozmiar: {file_size_before_kb:.1f} KB -> {file_size_after_kb:.1f} KB (oszczędzono {saved_kb:.1f} KB)")
    else:
        print(f"[BŁĄD] Plik wyjściowy nie powstał prawidłowo!")


def main():
    print(f"Uruchomiono Blender {bpy.app.version_string}")
    for model_cfg in TARGET_MODELS:
        decimate_single_model(model_cfg)
    print("\n[ZAKOŃCZONO] Wszystkie modele zostały zoptymalizowane w Blenderze 5.2!")


if __name__ == "__main__":
    main()
