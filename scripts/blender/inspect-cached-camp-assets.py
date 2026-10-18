"""Inspect cached BlenderKit model geometry; never reads account preferences."""
from pathlib import Path
import bpy
root=Path('C:/Users/krucz/blenderkit_data/models')
for pattern in ('plastic-monobloc*','small-woven-tabl*','park-bench*'):
    for folder in root.glob(pattern):
        for path in folder.glob('*.blend'):
            with bpy.data.libraries.load(str(path),link=False) as (source,target):
                print('CACHE',str(path),'COLLECTIONS',source.collections,'OBJECTS',source.objects[:15])
                target.collections=source.collections
            for c in target.collections:
                for obj in c.all_objects:
                    props=obj.get('blenderkit')
                    if props:
                        print('METADATA',obj.name,{k:props.get(k) for k in ('is_free','license','asset_base_id')})
