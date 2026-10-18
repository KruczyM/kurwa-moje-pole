"""Pack generated poses into existing six-frame combat strips (no artistic edits).

Requires Pillow and numpy. Source art remains untouched. Connected alpha
silhouettes determine cells; fixed sheet scale preserves crouched proportions. Each output
records source hashes and crop rectangles for reproducibility.
"""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "art/fighter/combat-illustrated-v1"
OUTPUT = ROOT / "public/game-assets/2d/fighter/combat-illustrated-v1"
SIZE = 256
BASELINE = 230
HEIGHT = 180


def components(mask):
    """Label opaque silhouettes with run-length union/find (no scipy needed)."""
    parents, runs, previous = [], [], []
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for y, line in enumerate(mask):
        changes = np.diff(np.pad(line.astype(np.int8), (1,1)))
        current = []
        for left, right in zip(np.flatnonzero(changes == 1), np.flatnonzero(changes == -1)):
            label = len(parents)
            parents.append(label)
            for pl, pr, pi in previous:
                if pr < left: continue
                if pl > right: break
                parents[find(pi)] = find(label)
            current.append((left, right, label))
            runs.append((y, left, right, label))
        previous = current
    groups = {}
    for y, left, right, label in runs:
        groups.setdefault(find(label), []).append((y, left, right))
    return list(groups.values())


def extract(path):
    image = Image.open(path).convert("RGBA")
    mask = np.array(image.getchannel("A")) > 128
    groups = components(mask)
    major = sorted([g for g in groups if sum(r-l for y,l,r in g) > 1800],
                   key=lambda g: sum(r-l for y,l,r in g), reverse=True)[:24]
    detached = [g for g in groups if not any(g is pose for pose in major)]
    if len(major) != 24:
        raise ValueError(f"{path}: expected 24 silhouettes, found {len(major)}")
    major.sort(key=lambda g: (min(y for y,l,r in g)+max(y for y,l,r in g))/2)
    cells, rectangles = [], []
    for row in range(4):
        poses = sorted(major[row*6:row*6+6], key=lambda g: (min(l for y,l,r in g)+max(r for y,l,r in g))/2)
        row_cells, row_rects = [], []
        for col, group in enumerate(poses):
            left, top = min(l for y,l,r in group), min(y for y,l,r in group)
            right, bottom = max(r for y,l,r in group), max(y for y,l,r in group)+1
            if left == 0 or top == 0 or right == image.width or bottom == image.height:
                raise ValueError(f"{path}: source silhouette touches canvas edge, row {row+1}, column {col+1}")
            # Reattach small detached features belonging to this silhouette.
            for small in detached:
                sl, st = min(l for y,l,r in small), min(y for y,l,r in small)
                sr, sb = max(r for y,l,r in small), max(y for y,l,r in small)+1
                if sl < right+12 and sr > left-12 and st < bottom+12 and sb > top-12:
                    group = group + small
            left, top = min(l for y,l,r in group), min(y for y,l,r in group)
            right, bottom = max(r for y,l,r in group), max(y for y,l,r in group)+1
            rect = tuple(int(v) for v in (max(0,left-5), max(0,top-5), min(image.width,right+5), min(image.height,bottom+5)))
            cell = image.crop(rect)
            isolation = np.zeros((rect[3]-rect[1], rect[2]-rect[0]), dtype=np.uint8)
            for y,l,r in group:
                isolation[y-rect[1], l-rect[0]:r-rect[0]] = 255
            edge = Image.fromarray(isolation).filter(ImageFilter.MaxFilter(9))
            cell.putalpha(ImageChops.multiply(cell.getchannel("A"), edge))
            bbox = cell.getchannel("A").point(lambda a: 255 if a > 128 else 0).getbbox()
            if not bbox or (bbox[3]-bbox[1]) < 55:
                raise ValueError(f"{path}: missing pose row {row+1}, column {col+1}")
            # Only discard nearly invisible alpha noise, retain antialiased edges.
            cell.putalpha(cell.getchannel("A").point(lambda a: a if a > 8 else 0))
            row_cells.append((cell, bbox, (col+.5)*image.width/6-rect[0]))
            row_rects.append(rect)
        cells.append(row_cells)
        rectangles.append(row_rects)
    return cells, rectangles


def pack_cells(cells, scale):
    strip = Image.new("RGBA", (SIZE*6, SIZE))
    first, bbox, nominal = cells[0]
    alpha = np.array(first.getchannel("A")) > 128
    foot_y, foot_x = np.nonzero(alpha[max(0, bbox[3]-12):bbox[3]])
    offset = float(np.mean(foot_x))-nominal
    for index, (cell, bbox, nominal) in enumerate(cells):
        # Share an anchor across a row: extended fists never recenter the torso.
        anchor = nominal+offset
        resized = cell.resize((round(cell.width*scale), round(cell.height*scale)), Image.Resampling.LANCZOS)
        x = round(SIZE/2-anchor*scale)
        y = round(BASELINE-bbox[3]*scale)
        out = Image.new("RGBA", (SIZE, SIZE))
        out.alpha_composite(resized, (x,y))
        out.putalpha(out.getchannel("A").point(lambda a: a if a > 8 else 0))
        box = out.getchannel("A").getbbox()
        if not box or min(box[:2]) <= 1 or max(box[2:]) >= SIZE-1:
            raise ValueError(f"Pose exceeds output margin: frame {index}, bbox {box}")
        strip.alpha_composite(out, (index*SIZE, 0))
    return strip


def main():
    config = json.loads((SOURCE/"generation.json").read_text(encoding="utf-8"))
    entries = {(e["id"], e["pack"]):e for e in config["entries"]}
    ids = sorted({e["id"] for e in config["entries"]})
    audit = {"characters":len(ids), "clips":0, "frames":0, "sources":[]}
    for fighter in ids:
        folder = OUTPUT/fighter
        folder.mkdir(parents=True, exist_ok=True)
        manifest = {"version":1, "characterId":fighter, "size":SIZE, "columns":6,
                    "pivot":[.5, BASELINE/SIZE], "worldSize":200, "facing":1, "clips":{}}
        for pack in config["packs"]:
            entry = entries[(fighter, pack["key"])]
            path = SOURCE/entry["file"]
            rows, rects = extract(path)
            # Air rows tuck the legs: use grounded special guard for scale.
            reference = rows[2 if pack["key"] == "air_special" else 0][0][1]
            scale = HEIGHT/(reference[3]-reference[1])
            # A single scale for all poses; props and limb extension may require space.
            for row in rows:
                for _, bbox, _ in row:
                    scale = min(scale, (SIZE-28)/(bbox[2]-bbox[0]), (BASELINE-12)/(bbox[3]-bbox[1]))
            for attempt in range(12):
                try:
                    strips = [pack_cells(row, scale) for row in rows]
                    break
                except ValueError:
                    scale *= .92
            else:
                raise ValueError(f"Cannot fit {fighter}/{pack['key']}")
            for name, strip in zip(pack["clips"], strips):
                strip.save(folder/(name+".png"), optimize=True)
                world_size = HEIGHT*200/((reference[3]-reference[1])*scale)
                manifest["clips"][name] = {"file":name+".png", "frames":6, "durationTicks":48,
                                           "worldSize":world_size}
                audit["clips"] += 1
                audit["frames"] += 6
                if name in {"jab", "crouch_punch"}:
                    guard = Image.new("RGBA", (SIZE*6, SIZE))
                    for col in range(6):
                        guard.alpha_composite(strip.crop((0,0,SIZE,SIZE)), (col*SIZE,0))
                    guard_name = "idle" if name == "jab" else "crouch"
                    guard.save(folder/(guard_name+".png"), optimize=True)
                    manifest["clips"][guard_name] = {"file":guard_name+".png", "frames":6, "durationTicks":60,
                                                    "worldSize":world_size}
            audit["sources"].append({"character":fighter, "pack":pack["key"], "file":entry["file"],
                                     "sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                                     "scale":scale, "rectangles":rects})
        # Movement and knockdown continue using their existing baked geometry.
        legacy = json.loads((ROOT/"public/game-assets/2d/fighter/combat"/fighter/"manifest.json").read_text())
        for name in ("walk", "fall", "get_up"):
            manifest["clips"][name] = {**legacy["clips"][name], "legacy":True,
                **{key:legacy[key] for key in ("size","pivot","worldSize","facing")}}
        powers = ROOT/"public/game-assets/2d/fighter/combat-powers-v2"/fighter/"manifest.json"
        if powers.is_file():
            manifest["clips"].update(json.loads(powers.read_text(encoding="utf-8"))["clips"])
        (folder/"manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8")
    (OUTPUT/"packing.json").write_text(json.dumps(audit, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({key:value for key,value in audit.items() if key != "sources"}))


if __name__ == "__main__":
    main()
