"""Export four upgraded combat strips per fighter, reusing the alpha packer."""
import hashlib
import importlib.util
import json
from pathlib import Path

spec = importlib.util.spec_from_file_location("packer", Path(__file__).with_name("pack-illustrated-combat.py"))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
SOURCE = p.ROOT/"art/fighter/combat-powers-v2"
OUTPUT = p.ROOT/"public/game-assets/2d/fighter/combat-powers-v2"
NAMES = ["uppercut","launch_hit","special","ultimate"]


def main():
    config = json.loads((p.ROOT/"docs/fighter-powers-generation.json").read_text(encoding="utf-8"))
    selected = {entry["id"]:entry for entry in config["entries"]}
    audit = {"characters":len(selected),"clips":0,"frames":0,"sources":[]}
    for fighter, entry in sorted(selected.items()):
        path = SOURCE/entry["file"]
        rows, rects = p.extract(path)
        reference = rows[0][0][1]
        height = reference[3]-reference[1]
        scale = p.HEIGHT/height
        for row in rows:
            for _, box, _ in row:
                scale = min(scale,(p.SIZE-28)/(box[2]-box[0]),(p.BASELINE-12)/(box[3]-box[1]))
        for attempt in range(12):
            try:
                strips = [p.pack_cells(row,scale) for row in rows]
                break
            except ValueError:
                scale *= .92
        else:
            raise ValueError(f"Cannot fit {fighter}")
        folder = OUTPUT/fighter
        folder.mkdir(parents=True,exist_ok=True)
        manifest = {"version":2,"characterId":fighter,"clips":{}}
        for name, strip in zip(NAMES,strips):
            filename = name+".png" if name == "launch_hit" else name+"_power.png"
            strip.save(folder/filename,optimize=True)
            manifest["clips"][name] = {"file":filename,"frames":6,"durationTicks":48,"powers":True,
                "size":p.SIZE,"pivot":[.5,p.BASELINE/p.SIZE],"facing":1,
                "worldSize":p.HEIGHT*200/(height*scale)}
            audit["clips"] += 1
            audit["frames"] += 6
        (folder/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
        active = p.OUTPUT/fighter/"manifest.json"
        current = json.loads(active.read_text(encoding="utf-8"))
        current["clips"].update(manifest["clips"])
        active.write_text(json.dumps(current,indent=2)+"\n",encoding="utf-8")
        audit["sources"].append({"id":fighter,"file":entry["file"],"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),
                                "scale":scale,"rectangles":rects})
    (OUTPUT/"packing.json").write_text(json.dumps(audit,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({k:v for k,v in audit.items() if k!="sources"}))


if __name__ == "__main__":
    main()
