"""Verify every delivered strip, legacy reference, alpha margin and phase variation."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
FOLDER = ROOT/"public/game-assets/2d/fighter/combat-illustrated-v1"
REQUIRED = {"jab","cross","kick","heavy_kick","uppercut","sweep","crouch_punch","crouch_kick",
            "jump_punch","air_kick","special","ultimate","block","block_low","hit_head","hit_body","launch_hit"}
IDS = {"amper","korba","klatwa","chlebak","kobra","zawor","szerszen","dziaslo",
       "hemoroid","jeczmien","ambona","antena","gruczol","krwiak","pien","pierscien"}


def main():
    assert {p.name for p in FOLDER.iterdir() if p.is_dir()} == IDS
    clips, frames, total = 0, 0, 0
    motion = []
    for fighter in sorted(IDS):
        directory = FOLDER/fighter
        data = json.loads((directory/"manifest.json").read_text(encoding="utf-8"))
        assert data["characterId"] == fighter and data["version"] == 1
        assert data["facing"] == 1 and data["size"] == 256 and data["columns"] == 6
        assert set(data["clips"]) == REQUIRED | {"idle","crouch","walk","fall","get_up"}
        for name, clip in data["clips"].items():
            assert clip["file"] == name+("_power" if clip.get("powers") and name != "launch_hit" else "")+".png"
            assert 1 <= clip["frames"] <= 6 and clip["durationTicks"] > 0
            if clip.get("legacy"):
                path = ROOT/"public/game-assets/2d/fighter/combat"/fighter/clip["file"]
                assert path.is_file() and clip["facing"] == -1
                continue
            size = data["size"]
            path = (ROOT/"public/game-assets/2d/fighter/combat-powers-v2"/fighter if clip.get("powers") else directory)/clip["file"]
            total += path.stat().st_size
            image = Image.open(path)
            assert image.mode == "RGBA" and image.size == (size*6,size), (fighter,name)
            hashes, masks = set(), []
            for index in range(6):
                cell = image.crop((index*size,0,(index+1)*size,size))
                alpha = cell.getchannel("A")
                bbox = alpha.getbbox()
                assert bbox and min(bbox[:2]) > 1 and max(bbox[2:]) < size-1, (fighter,name,index,bbox)
                mask = np.array(alpha) > 128
                assert mask.sum() > 2000, (fighter,name,index,"empty")
                hashes.add(hashlib.sha256(cell.tobytes()).hexdigest())
                masks.append(mask)
            if name in REQUIRED:
                assert len(hashes) >= 4, (fighter,name,"static strip")
                ratio = float(np.logical_xor(masks[0],masks[2]).sum()/np.logical_or(masks[0],masks[2]).sum())
                assert ratio > .025, (fighter,name,"no silhouette movement")
                motion.append({"fighter":fighter,"clip":name,"contactSilhouetteChange":round(ratio,3)})
                clips += 1
                frames += 6
    packing = json.loads((FOLDER/"packing.json").read_text(encoding="utf-8"))
    assert packing["characters"] == 16 and packing["clips"] == 256 and packing["frames"] == 1536
    report = {"status":"PASS","characters":len(IDS),"animations":clips,"frames":frames,
              "encodedMiB":round(total/2**20,2),"silhouetteMotion":motion,
              "visualGameplay":"VISUAL_GAMEPLAY_VERIFICATION_PENDING_HUMAN"}
    output = ROOT/"reports/fighter-combat-illustrated-v1"
    output.mkdir(parents=True,exist_ok=True)
    (output/"asset-report.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
    # Technical contact sheets for local inspection of exported cells.
    for sheet in range(2):
        preview = Image.new("RGB",(1100,8*216+35),"#192331")
        draw = ImageDraw.Draw(preview)
        for col, name in enumerate(("idle","cross","heavy_kick","block_low")):
            draw.text((90+col*250,8),name,fill="white")
        for row, fighter in enumerate(sorted(IDS)[sheet*8:sheet*8+8]):
            draw.text((8,row*216+110),fighter,fill="white")
            data = json.loads((FOLDER/fighter/"manifest.json").read_text(encoding="utf-8"))
            for col, name in enumerate(("idle","cross","heavy_kick","block_low")):
                clip = data["clips"][name]
                strip = Image.open(FOLDER/fighter/clip["file"]).convert("RGBA")
                frame = 0 if name == "idle" else 2
                cell = strip.crop((frame*256,0,(frame+1)*256,256))
                # Match runtime world size, fixed feet pivot.
                width = round(clip["worldSize"])
                cell = cell.resize((width,width),Image.Resampling.LANCZOS)
                x = 90+col*250+125-width//2
                y = 35+row*216+190-round(width*data["pivot"][1])
                preview.paste(cell,(x,y),cell)
        preview.save(output/("contact-"+str(sheet+1)+".jpg"),quality=92)
    print(json.dumps({k:v for k,v in report.items() if k!="silhouetteMotion"}))


if __name__ == "__main__":
    main()
