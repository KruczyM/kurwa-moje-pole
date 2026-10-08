"""Lossless scene/geometry layout, resized embedded textures for mobile. Original GLB untouched."""
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'public/game-assets/world/festival/authored-festival.glb'
TARGET = SOURCE.with_name('authored-festival-mobile.glb')

def main():
    with SOURCE.open('rb') as f:
        magic, version, _ = struct.unpack('<III', f.read(12))
        assert magic == 0x46546C67 and version == 2
        length, kind = struct.unpack('<II', f.read(8))
        assert kind == 0x4E4F534A
        document = json.loads(f.read(length))
        length, kind = struct.unpack('<II', f.read(8))
        assert kind == 0x004E4942
        binary = f.read(length)
    replacements = {}
    original_pixels = mobile_pixels = 0
    for image in document.get('images', []):
        if 'bufferView' not in image:
            raise ValueError('External images need an explicit packaging rule')
        view = document['bufferViews'][image['bufferView']]
        blob = binary[view.get('byteOffset', 0):view.get('byteOffset', 0) + view['byteLength']]
        with Image.open(io.BytesIO(blob)) as pixels:
            original_pixels += pixels.width * pixels.height
            pixels.thumbnail((256, 256), Image.Resampling.LANCZOS)
            mobile_pixels += pixels.width * pixels.height
            output = io.BytesIO()
            if image['mimeType'] == 'image/jpeg':
                pixels.convert('RGB').save(output, 'JPEG', quality=85)
            elif image['mimeType'] == 'image/png':
                pixels.save(output, 'PNG')
            else:
                raise ValueError(f"Unsupported image type: {image['mimeType']}")
            replacements[image['bufferView']] = output.getvalue()
    rebuilt = bytearray()
    for index, view in enumerate(document['bufferViews']):
        assert view.get('buffer', 0) == 0
        offset = view.get('byteOffset', 0)
        blob = replacements.get(index, binary[offset:offset + view['byteLength']])
        rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
        view['byteOffset'] = len(rebuilt)
        view['byteLength'] = len(blob)
        rebuilt.extend(blob)
    rebuilt.extend(b'\0' * (-len(rebuilt) % 4))
    document['buffers'][0]['byteLength'] = len(rebuilt)
    encoded = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    with TARGET.open('wb') as f:
        f.write(struct.pack('<III', magic, version, 12 + 8 + len(encoded) + 8 + len(rebuilt)))
        f.write(struct.pack('<II', len(encoded), 0x4E4F534A))
        f.write(encoded)
        f.write(struct.pack('<II', len(rebuilt), 0x004E4942))
        f.write(rebuilt)
    print(json.dumps({'sourceBytes': SOURCE.stat().st_size, 'mobileBytes': TARGET.stat().st_size,
        'images':len(replacements), 'originalTextureMiBEstimate':original_pixels*4*4/3/2**20,
        'mobileTextureMiBEstimate':mobile_pixels*4*4/3/2**20,
        'geometry':'unchanged; buffer view offsets rebuilt, accessor data preserved'},indent=2))

if __name__ == '__main__':
    main()
