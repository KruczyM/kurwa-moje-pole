"""Validate the baked atlases, including real alpha content and changing poses."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DIRECTORY = ROOT / "public/game-assets/2d/fighter/combat"
IDS = {"amper", "korba", "klatwa", "chlebak", "kobra", "zawor", "szerszen", "dziaslo",
       "hemoroid", "jeczmien", "ambona", "antena", "gruczol", "krwiak", "pien", "pierscien"}
REQUIRED = {"idle", "jab", "cross", "hook", "elbow", "kick", "heavy_kick", "uppercut", "air_kick",
            "hit_head", "hit_body", "fall", "get_up", "block", "walk", "crouch"}


def main():
    assert {p.name for p in DIRECTORY.iterdir() if p.is_dir()} == IDS
    atlases, total, decoded = 0, 0, 0
    for char_id in sorted(IDS):
        folder = DIRECTORY / char_id
        data = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
        assert data["version"] == 1 and data["characterId"] == char_id
        assert REQUIRED.issubset(data["clips"])
        assert data["size"] * data["columns"] <= 2048
        assert all(0 <= x <= 1 for x in data["pivot"])
        for name, clip in data["clips"].items():
            path = folder / clip["file"]
            assert path.parent == folder and path.suffix == ".png"
            image = Image.open(path).convert("RGBA")
            size = data["size"]
            assert image.size == (size * data["columns"], size), (char_id, name)
            assert 1 <= clip["frames"] <= data["columns"] and clip["durationTicks"] > 0
            hashes = set()
            for frame in range(clip["frames"]):
                cell = image.crop((frame * size, 0, (frame + 1) * size, size))
                alpha = cell.getchannel("A")
                bbox = alpha.getbbox()
                assert bbox and sum(alpha.histogram()[1:]) > 200, (char_id, name, frame, "empty/tiny")
                assert bbox[0] > 0 and bbox[1] > 0 and bbox[2] < size and bbox[3] < size, (char_id, name, frame, "clipped")
                hashes.add(hashlib.sha256(cell.tobytes()).hexdigest())
            if name not in {"idle", "block", "crouch"}:
                assert len(hashes) > 1, (char_id, name, "static animation")
            atlases += 1
            total += path.stat().st_size
            decoded += image.width * image.height * 4
    print(json.dumps({"status": "PASS", "characters": len(IDS), "atlases": atlases,
                      "encodedMiB": round(total / 2**20, 2), "decodedAllCharactersMiB": round(decoded / 2**20, 2),
                      "runtimePolicy": "only two selected characters resident"}))


if __name__ == "__main__":
    main()
