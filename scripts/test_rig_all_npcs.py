import json
import math
import struct
import tempfile
import unittest
from pathlib import Path

from rig_all_npcs import validate_skin


class SkinValidationTests(unittest.TestCase):
    def fixture(self, folder, weights=(1, 0, 0, 0), invalid_joint=False, unskinned=False):
        binary = b''.join(struct.pack('<4H', 99 if invalid_joint else i, 0, 0, 0) for i in range(10))
        binary += b''.join(struct.pack('<4f', *weights) for _ in range(10))
        document = {
            'asset': {'version': '2.0'},
            'buffers': [{'byteLength': len(binary)}],
            'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': 80}, {'buffer': 0, 'byteOffset': 80, 'byteLength': 160}],
            'accessors': [{'bufferView': 0, 'componentType': 5123, 'type': 'VEC4', 'count': 10},
                          {'bufferView': 1, 'componentType': 5126, 'type': 'VEC4', 'count': 10}, {'count': 10}],
            'nodes': [{'mesh': 0, **({} if unskinned else {'skin': 0})}],
            'skins': [{'joints': list(range(10))}],
            'meshes': [{'primitives': [{'attributes': {'JOINTS_0': 0, 'WEIGHTS_0': 1, 'POSITION': 2}}]}],
        }
        payload = json.dumps(document).encode()
        payload += b' ' * (-len(payload) % 4)
        raw = struct.pack('<4sII', b'glTF', 2, 28 + len(payload) + len(binary))
        raw += struct.pack('<II', len(payload), 0x4E4F534A) + payload
        raw += struct.pack('<II', len(binary), 0x004E4942) + binary
        target = Path(folder) / 'test.glb'
        target.write_bytes(raw)
        return target

    def test_normalized_full_skin(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(validate_skin(self.fixture(folder)), {'weightedVertices': 10, 'weightedJoints': 10})

    def test_rejects_unweighted_vertices(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            validate_skin(self.fixture(folder, weights=(0, 0, 0, 0)))

    def test_rejects_unnormalized_weights(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            validate_skin(self.fixture(folder, weights=(.4, 0, 0, 0)))

    def test_rejects_nan(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            validate_skin(self.fixture(folder, weights=(math.nan, 0, 0, 0)))

    def test_rejects_invalid_joint(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            validate_skin(self.fixture(folder, invalid_joint=True))

    def test_rejects_static_mesh(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            validate_skin(self.fixture(folder, unskinned=True))


if __name__ == '__main__':
    unittest.main()
