import os
import shutil

dest_dir = r"E:\kodowanie\gra\.ai\worktrees\festival-2026-tent-upgrades\public\game-assets\characters"
for folder in os.listdir(dest_dir):
    folder_path = os.path.join(dest_dir, folder)
    if os.path.isdir(folder_path):
        anim_path = os.path.join(folder_path, "npc-animations.glb")
        prev_path = os.path.join(folder_path, "preview.glb")
        if os.path.exists(anim_path) and not os.path.exists(prev_path):
            shutil.copy(anim_path, prev_path)
            print(f"Created preview.glb for {folder}")

