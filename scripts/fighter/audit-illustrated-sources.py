"""Report source grid errors before exporting, including cut silhouettes."""
import importlib.util
import json
from pathlib import Path
import numpy as np

spec = importlib.util.spec_from_file_location("packer", Path(__file__).with_name("pack-illustrated-combat.py"))
packer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packer)
config = json.loads((packer.SOURCE/"generation.json").read_text(encoding="utf-8"))
entries = {(e["id"],e["pack"]):e for e in config["entries"]}
issues = []
for key, entry in entries.items():
    try:
        rows, rects = packer.extract(packer.SOURCE/entry["file"])
        edges = []
        for i, row in enumerate(rows):
            for j, (cell, bbox, nominal) in enumerate(row):
                a = np.array(cell.getchannel("A")) > 128
                count = int(a[[0,-1],:].sum()+a[:,[0,-1]].sum())
                if count > 5:
                    edges.append([i,j,count])
        if edges:
            issues.append({"source":key, "edges":edges})
    except ValueError as error:
        issues.append({"source":key, "error":str(error)})
print(json.dumps({"sources":len(entries),"issues":issues},indent=2))
