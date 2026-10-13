import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROSTER } from '../data/fighters/roster';
import { renderFighterHelp } from './fighterHelp';

afterEach(() => vi.unstubAllGlobals());

describe('cabinet menu content', () => {
  it('keeps the full useful move guide without exposing combat timing for any fighter', () => {
    vi.stubGlobal('document', { createElement: () => ({ textContent: '', className: '' }) });
    for (const entry of Object.values(ROSTER)) {
      const appended: { textContent: string }[] = [];
      const host = { innerHTML: '', append: (node: { textContent: string }) => appended.push(node) };
      renderFighterHelp(host as unknown as HTMLElement, entry.definition);
      expect(host.innerHTML).not.toMatch(
        /\bms\b|zamach|powrót ciosu|recovery|startup|hitstop|okno trafienia/i,
      );
      for (const text of ['Podbródkowy', 'Podcięcie', 'Garda', '30%', '100%', 'online trwa']) {
        expect(host.innerHTML).toContain(text);
      }
      expect(appended[0]?.textContent).toContain(entry.definition.moves.ultimate!.name);
      expect(appended[0]?.textContent).toContain(entry.definition.moves.special!.name);
    }
  });

  it('retains integration IDs and uses native closed drawers for optional content', () => {
    const html = readFileSync('fighter-demo.html', 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of [
      'fight-mode',
      'roster-grid',
      'online-create',
      'online-join',
      'start-fight-btn',
      'matchup-p1',
      'matchup-p2',
    ]) {
      expect(ids).toContain(id);
    }
    expect(html.match(/<details class="cabinet-drawer">/g)).toHaveLength(2);
    expect(html).toMatch(/<details[^>]*>\s*<summary>Sterowanie[\s\S]*?class="controls-helper-box"/);
    expect(html).toMatch(/<details[^>]*>\s*<summary>Dźwięk[\s\S]*?id="selection-audio-settings"/);
    for (const mode of ['bot', 'training', 'online']) expect(html).toContain(`data-fight-mode="${mode}"`);
    expect(html).not.toContain('user-scalable=no');
  });
});
