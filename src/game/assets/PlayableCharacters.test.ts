import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import catalog from './assetCatalog.json';
import { characterAssets } from './assetManifest';
import { CANONICAL_CHARACTERS, isCharacterName } from '../network/networkProtocol';
import { Room } from '../../../server/Room';

it('offers all 16 animated characters in the menu, loader and multiplayer', () => {
  expect(CANONICAL_CHARACTERS).toHaveLength(16);
  expect(characterAssets.map((asset) => asset.name)).toEqual([...CANONICAL_CHARACTERS]);
  const room = new Room({ roomId: 'new-characters' });
  for (const asset of catalog.characters) {
    expect(isCharacterName(asset.name)).toBe(true);
    for (const file of ['npc-animations.glb', 'preview.glb']) {
      expect(
        existsSync(new URL(`../../../public/game-assets/characters/${asset.id}/${file}`, import.meta.url)),
        `${asset.id}/${file}`,
      ).toBe(true);
    }
    expect(
      room.getPublicState().slots[asset.name as keyof ReturnType<typeof room.getPublicState>['slots']].status,
    ).toBe('free');
  }
});
