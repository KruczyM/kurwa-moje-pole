"""Deterministic packing tests; python scripts/fighter/test-illustrated-packing.py."""
import importlib.util
from io import BytesIO
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("packer", Path(__file__).with_name("pack-illustrated-combat.py"))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PackingTest(unittest.TestCase):
    def test_uneven_rows_and_extended_limbs_are_not_cut_at_regular_grid_lines(self):
        atlas = Image.new("RGBA", (1536,1024))
        draw = ImageDraw.Draw(atlas)
        for row in range(4):
            for col in range(6):
                x, y = col*256+65, row*245+12
                draw.rectangle((x,y,x+85,y+205), fill="white")
                if col == 2:
                    draw.rectangle((x+80,y+80,x+185,y+95), fill="white")
        buffer = BytesIO()
        atlas.save(buffer, format="PNG")
        buffer.seek(0)
        rows, rectangles = p.extract(buffer)
        self.assertEqual(len(rows),4)
        self.assertTrue(all(len(row)==6 for row in rows))
        self.assertEqual(rows[0][2][1][2]-rows[0][2][1][0],186)
        strip = p.pack_cells(rows[0],.75)
        self.assertEqual(strip.size,(1536,256))
        for col in range(6):
            bbox = strip.crop((col*256,0,(col+1)*256,256)).getchannel("A").getbbox()
            self.assertGreater(bbox[0],0)
            self.assertLess(bbox[2],256)
            self.assertAlmostEqual(bbox[3],p.BASELINE,delta=2)

    def test_missing_row_is_rejected_instead_of_exporting_blank_frames(self):
        atlas = Image.new("RGBA",(1536,1024))
        draw = ImageDraw.Draw(atlas)
        for row in range(3):
            for col in range(6):
                draw.rectangle((col*256+65,row*256+20,col*256+150,row*256+230),fill="white")
        buffer = BytesIO()
        atlas.save(buffer, format="PNG")
        buffer.seek(0)
        with self.assertRaisesRegex(ValueError,"expected 24 silhouettes"):
            p.extract(buffer)


if __name__ == "__main__":
    unittest.main()
