import json
import struct
import tempfile
import unittest
from pathlib import Path
from animate_all_npcs import has_skin, inventory, select_base, validate_result, build_command


def write_glb(path, document):
    payload = json.dumps(document).encode()
    payload += b" " * (-len(payload) % 4)
    path.write_bytes(struct.pack("<4sIIII", b"glTF", 2, 20 + len(payload), len(payload), 0x4E4F534A) + payload)


class BatchAnimationTests(unittest.TestCase):
    def test_static_model_is_not_a_rig(self):
        self.assertFalse(has_skin({"meshes": [{"primitives": [{"attributes": {"POSITION": 0}}]}]}))

    def test_inventory_keeps_crowd_separate_and_rejects_path_escape(self):
        data = {"characters": [{"id": "one", "name": "One"}], "stagedCharacters": [{"id": "one", "name": "One"}], "festivalNpcs": [{"id": "one", "name": "One", "path": "npc_models/one.glb"}]}
        self.assertEqual(len(inventory(data)), 2)
        with self.assertRaises(ValueError):
            inventory({"characters": [{"id": "../escape", "name": "bad"}]})

    def test_missing_skin_is_reported_without_replacing_original(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            path = root / "public/game-assets/npc_models/one.glb"
            path.parent.mkdir(parents=True)
            write_glb(path, {"meshes": []})
            original = path.read_bytes()
            base, reason = select_base({"id": "one", "category": "festival", "source": "npc_models/one.glb"}, root, root / "rigs")
            self.assertIsNone(base)
            self.assertIn("Requires rig", reason)
            self.assertEqual(path.read_bytes(), original)
            with self.assertRaises(ValueError):
                validate_result(path)

    def test_command_reuses_retargeter_and_preserves_spaces(self):
        with tempfile.TemporaryDirectory() as folder:
            motion = Path(folder) / "lie down.fbx"
            motion.touch()
            command = build_command(Path("Blender Path/blender.exe"), Path("base.glb"), Path("donor.glb"), Path("out.glb"), [f"LieDown={motion}"])
            self.assertEqual(command[0], str(Path("Blender Path/blender.exe")))
            self.assertIn("--python-exit-code", command)
            self.assertEqual(command[-1], f"LieDown={motion.resolve()}")

    def test_validated_export_requires_all_three_locomotion_clips_and_hashes_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'result.glb'
            document = {'nodes': [{'mesh': 0, 'skin': 0}], 'skins': [{'joints': [1]}],
                        'meshes': [{'primitives': [{'attributes': {'JOINTS_0': 0, 'WEIGHTS_0': 1}}]}],
                        'animations': [{'name': name, 'channels': [{}], 'samplers': [{}]} for name in ('Idle', 'Walk', 'Run')]}
            write_glb(path, document)
            self.assertEqual(len(validate_result(path)['sha256']), 64)
            document['animations'].pop()
            write_glb(path, document)
            with self.assertRaisesRegex(ValueError, 'Run'):
                validate_result(path)


if __name__ == "__main__":
    unittest.main()
