import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Bongo Rush main menu entry', () => {
  it('links directly to the standalone game relative to the deployed site', () => {
    const menu = readFileSync('index.html', 'utf8');
    expect(menu).toMatch(/<a\s+id="play-bongo-rush"[^>]+href="\.\/bongo-rush\.html"/);
    expect(readFileSync('bongo-rush.html', 'utf8')).toContain('/src/games/bongo-rush/main.ts');
    expect(menu).toContain('data-tab="bongo"');
    expect(menu).toContain('id="guide-panel-bongo"');
    expect(menu.match(/href="\.\/bongo-rush\.html"/g)).toHaveLength(2);
    expect(menu).toContain('Walka o tasiorowe bongo');
    const game = readFileSync('bongo-rush.html', 'utf8');
    expect(game).toContain('<title>After: Walka o tasiorowe bongo</title>');
    expect(game).not.toContain('BONGO RUSH');
    expect(game).not.toContain('id="menu-listen"');
    expect(game).toContain('rel="preload" href="./game-assets/audio/bongo-rush/soundtrack-v1/menu-jazz.mp3"');
    expect(game).toContain('class="menu-track"');
  });
});
