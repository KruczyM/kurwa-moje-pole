"""Local Blender regression tests; generated colour grid is only a disposable fixture."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

import bpy


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


T = load_module('tent_front_test', 'build-festival-tents.py')
H = load_module('siema_front_test', 'siema-shop-hall.py')


class FrontBannerTests(unittest.TestCase):
    def setUp(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)

    def test_placeholder_has_one_bounded_uv_island(self):
        panel = H.front_banner(T, T.U)
        self.assertTrue(panel['siemaShopFront'])
        self.assertEqual(len(panel.data.vertices), 5)
        self.assertEqual(len(panel.data.polygons), 1)
        coords = [tuple(item.uv) for item in panel.data.uv_layers['TentDetail'].data]
        for index, target in [(0, (0, 0)), (1, (1, 0)), (3, (.5, 1))]:
            for actual, expected in zip(coords[index], target):
                self.assertAlmostEqual(actual, expected, places=6)
        self.assertTrue(all(0 <= value <= 1 for coord in coords for value in coord))

    def test_photo_is_embedded_srgb_without_a_dark_tint(self):
        with tempfile.TemporaryDirectory(prefix='siema-front-fixture-') as directory:
            source = Path(directory) / 'diagnostic-grid.png'
            grid = bpy.data.images.new('Diagnostic grid', width=64, height=32)
            grid.generated_type = 'COLOR_GRID'
            grid.filepath_raw = str(source)
            grid.file_format = 'PNG'
            grid.save()
            panel = H.front_banner(T, T.U, source)
            material = panel.data.materials[0]
            texture = next(node for node in material.node_tree.nodes if node.type == 'TEX_IMAGE')
            self.assertIsNotNone(texture.image.packed_file)
            self.assertEqual(texture.image.colorspace_settings.name, 'sRGB')
            self.assertEqual(texture.extension, 'EXTEND')
            self.assertEqual(tuple(texture.image.size), (64, 32))
            self.assertEqual(tuple(material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value), (1, 1, 1, 1))

    def test_missing_photo_fails_instead_of_silently_using_placeholder(self):
        with tempfile.TemporaryDirectory(prefix='siema-missing-fixture-') as directory:
            with self.assertRaises(FileNotFoundError):
                H.front_banner(T, T.U, Path(directory) / 'missing.png')


# Blender otherwise returns success even when a Python test fails.
result = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(FrontBannerTests))
if not result.wasSuccessful():
    raise RuntimeError('SiemaShop front regression failed')
