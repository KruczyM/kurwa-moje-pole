import { describe, expect, it } from 'vitest';
import { buildCampaignV6 } from './CampaignV6';
import {
  applyGeometryVariant,
  proposalBase,
  validateProposalOutput,
} from '../../../scripts/bongo-v6/geometry-variant';
import corrections from '../../../scripts/bongo-v6/reference-corrections.json';
import proposal from '../../../scripts/bongo-v6/proposal-9-core-spout.json';

describe('offline geometry proposals', () => {
  it('reproduces the accepted correction from the preserved original reference', () => {
    const accepted = buildCampaignV6()[8];
    const original = proposalBase(accepted);
    const correction = corrections.find((entry) => entry.id === 9)!;
    expect(correction.cells).toHaveLength(13);
    expect(applyGeometryVariant(original, correction)).toEqual(accepted);
    const changed = original.rows.flatMap((row, y) =>
      [...row].flatMap((cell, x) =>
        cell === accepted.rows[y][x] ? [] : [{ x, y, from: cell, to: accepted.rows[y][x] }],
      ),
    );
    expect(changed).toHaveLength(13);
    expect(changed.every((cell) => cell.from === '#' && cell.to === '.')).toBe(true);
    for (const symbol of ['R', 'Q', 'O', 'V', 'P', 'E']) {
      const positions = (rows: readonly string[]) =>
        rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === symbol ? [`${x},${y}`] : [])));
      expect(positions(accepted.rows)).toEqual(positions(original.rows));
    }
    expect(accepted.rows[15][17]).toBe('#');
    expect(accepted.rows[8][36]).toBe('#');
  });
  it('can add diggable support in a receiver without changing a body or the source definition', () => {
    const level = buildCampaignV6()[8];
    const before = JSON.stringify(level);
    const result = applyGeometryVariant(level, {
      id: 9,
      reason: 'Isolated receiver support experiment',
      cells: [{ x: 31, y: 9, from: ' ', to: '.' }],
    });
    expect(result.rows[9][31]).toBe('.');
    expect(JSON.stringify(level)).toBe(before);
    expect(result.rows.join('').match(/[QO]/g)).toHaveLength(180);
    expect(result.rows.join('').match(/R/g)).toHaveLength(level.rows.join('').match(/R/g)!.length);
    expect({ ...result, rows: level.rows }).toEqual(level);
  });
  it('keeps experimental output separate from campaign proof paths', () => {
    expect(validateProposalOutput('reports/bongo-campaign-v6/experiment-9.json')).toContain(
      'experiment-9.json',
    );
    for (const path of [
      undefined,
      '--geometry=proposal.json',
      'reports/bongo-campaign-v6/route-9.json',
      'src/games/bongo-rush/data/campaign-v6-proofs.json',
      'reports/bongo-campaign-v6/../outside.json',
    ])
      expect(() => validateProposalOutput(path)).toThrow();
  });
  it('changes only declared terrain and preserves the original definition', () => {
    const level = buildCampaignV6()[8];
    const before = JSON.stringify(level);
    const result = applyGeometryVariant(level, proposal);
    const changed: string[] = [];
    level.rows.forEach((row, y) =>
      [...row].forEach((cell, x) => {
        if (result.rows[y][x] !== cell) changed.push(`${x},${y}`);
      }),
    );
    expect(changed).toEqual(['25,14', '25,15', '25,16']);
    expect(JSON.stringify(level)).toBe(before);
    expect({ ...result, rows: level.rows }).toEqual(level);
    expect(result.rows.join('').match(/[QO]/g)).toHaveLength(180);
    expect(result.quota).toBe(153);
  });
  it.each([
    { x: 18, y: 5, from: 'O', to: '.' },
    { x: 17, y: 5, from: 'V', to: '.' },
    { x: 0, y: 5, from: '#', to: '.' },
    { x: 25, y: 14, from: '.', to: '#' },
  ])('rejects protected or mismatched fields: $x,$y', (cell) => {
    expect(() => applyGeometryVariant(buildCampaignV6()[8], { ...proposal, cells: [cell] })).toThrow();
  });
  it('rejects a proposal for a different level', () => {
    expect(() => applyGeometryVariant(buildCampaignV6()[7], proposal)).toThrow();
  });
});
