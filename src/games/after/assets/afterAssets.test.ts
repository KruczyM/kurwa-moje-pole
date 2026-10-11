import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const ASSETS_DIR = path.join(ROOT_DIR, 'public', 'game-assets', '2d', 'after');

const CHARACTERS = [
  'amper', 'antena', 'gruczol', 'klatwa', 'krwiak', 'pien', 'pierscien', 'zawor',
  'ambona', 'chlebak', 'dziaslo', 'hemoroid', 'jeczmien', 'kobra', 'korba', 'szerszen'
];

describe('After: ostatnia noc - 2D Asset Integrity', () => {
  describe('Portraits', () => {
    it('contains valid bust portraits for all 16 characters', () => {
      const portraitsDir = path.join(ASSETS_DIR, 'portraits');
      expect(fs.existsSync(portraitsDir)).toBe(true);

      for (const charId of CHARACTERS) {
        const file = path.join(portraitsDir, `${charId}.png`);
        expect(fs.existsSync(file), `Portrait missing: ${charId}.png`).toBe(true);
        const stats = fs.statSync(file);
        expect(stats.size).toBeGreaterThan(1000);
      }
    });
  });

  describe('Character Sprite Sheets', () => {
    it('contains 4-direction spritesheet and meta.json for all 16 characters', () => {
      const charsDir = path.join(ASSETS_DIR, 'characters');
      expect(fs.existsSync(charsDir)).toBe(true);

      for (const charId of CHARACTERS) {
        const dir = path.join(charsDir, charId);
        expect(fs.existsSync(dir), `Directory missing for: ${charId}`).toBe(true);

        const sheetFile = path.join(dir, 'spritesheet.png');
        expect(fs.existsSync(sheetFile), `Spritesheet missing: ${charId}/spritesheet.png`).toBe(true);
        const stats = fs.statSync(sheetFile);
        expect(stats.size).toBeGreaterThan(1000);

        const metaFile = path.join(dir, 'meta.json');
        expect(fs.existsSync(metaFile), `Meta JSON missing: ${charId}/meta.json`).toBe(true);

        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
        expect(meta.character).toBe(charId);
        expect(meta.frameWidth).toBe(64);
        expect(meta.frameHeight).toBe(64);
        expect(meta.directions).toEqual(['down', 'right', 'up', 'left']);
        expect(meta.rows.down).toBe(0);
        expect(meta.rows.right).toBe(1);
        expect(meta.rows.up).toBe(2);
        expect(meta.rows.left).toBe(3);
        expect(meta.animationColumns.idle).toEqual([0]);
        expect(meta.animationColumns.walk).toEqual([0, 1, 2, 3]);
      }
    });
  });

  describe('Tileset', () => {
    it('contains modular tiles, tileset.png and valid tileset.json metadata', () => {
      const tilesDir = path.join(ASSETS_DIR, 'tiles');
      expect(fs.existsSync(tilesDir)).toBe(true);

      const atlasFile = path.join(tilesDir, 'tileset.png');
      expect(fs.existsSync(atlasFile)).toBe(true);
      expect(fs.statSync(atlasFile).size).toBeGreaterThan(5000);

      const jsonFile = path.join(tilesDir, 'tileset.json');
      expect(fs.existsSync(jsonFile)).toBe(true);

      const meta = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
      expect(meta.tileSize).toBe(64);
      expect(meta.cols).toBe(4);
      expect(meta.rows).toBe(3);

      const expectedTiles = [
        'grass', 'grass_trampled', 'dirt_path', 'mud',
        'concrete_slab', 'asphalt_road', 'wood_planks',
        'fence_barrier', 'tent_tarp', 'hazard_strip'
      ];

      for (const tileId of expectedTiles) {
        expect(meta.tiles[tileId]).toBeDefined();
        const tile = meta.tiles[tileId];
        expect(tile.width).toBe(64);
        expect(tile.height).toBe(64);
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeGreaterThanOrEqual(0);

        const individualTile = path.join(tilesDir, `${tileId}.png`);
        expect(fs.existsSync(individualTile), `Individual tile missing: ${tileId}.png`).toBe(true);
      }
    });
  });

  describe('Props and Quest Items', () => {
    it('contains rendered props and camp equipment', () => {
      const propsDir = path.join(ASSETS_DIR, 'props');
      expect(fs.existsSync(propsDir)).toBe(true);

      const props = [
        'toitoi.png', 'camping_chair.png', 'picnic_table.png', 'camp_flag.png',
        'tent_small.png', 'tent_large.png', 'power_generator.png',
        'cable_reel.png', 'pavilion.png', 'gastro_stall.png', 'beer_crate.png'
      ];

      for (const p of props) {
        const file = path.join(propsDir, p);
        expect(fs.existsSync(file), `Prop missing: ${p}`).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(100);
      }
    });

    it('contains quest items', () => {
      const itemsDir = path.join(ASSETS_DIR, 'props', 'items');
      expect(fs.existsSync(itemsDir)).toBe(true);

      const items = [
        'missing_shoe.png', 'cracked_phone.png', 'powerbank.png',
        'acoustic_guitar.png', 'golden_can.png', 'water_bottle.png', 'sunglasses.png'
      ];

      for (const itm of items) {
        const file = path.join(itemsDir, itm);
        expect(fs.existsSync(file), `Item missing: ${itm}`).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(100);
      }
    });
  });

  describe('UI & HUD Assets', () => {
    it('contains all necessary 2D UI elements', () => {
      const uiDir = path.join(ASSETS_DIR, 'ui');
      expect(fs.existsSync(uiDir)).toBe(true);

      const uiElements = [
        'dialogue_box.png', 'portrait_frame.png', 'hud_stamina_bar.png',
        'inventory_slot.png', 'inventory_slot_selected.png',
        'target_indicator.png', 'title_banner.png'
      ];

      for (const ui of uiElements) {
        const file = path.join(uiDir, ui);
        expect(fs.existsSync(file), `UI asset missing: ${ui}`).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(100);
      }
    });
  });

  describe('Zone Map Previews', () => {
    it('contains zone map preview compositions', () => {
      const mapsDir = path.join(ASSETS_DIR, 'maps');
      expect(fs.existsSync(mapsDir)).toBe(true);

      const previews = ['camp_zone_preview.png', 'night_strip_preview.png'];
      for (const prev of previews) {
        const file = path.join(mapsDir, prev);
        expect(fs.existsSync(file), `Map preview missing: ${prev}`).toBe(true);
        expect(fs.statSync(file).size).toBeGreaterThan(10000);
      }
    });
  });
});
