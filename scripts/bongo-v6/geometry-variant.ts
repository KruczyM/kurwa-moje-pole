/** Offline geometry proposals stay separate until a fresh complete proof exists. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { adaptGrid, buildCampaignV6 } from '../../src/games/bongo-rush/CampaignV6';
import references from './reference-grids.json';
import corrections from './reference-corrections.json';
import type { LevelDefinition } from '../../src/games/bongo-rush/types';

export type GeometryVariant = {
  id: number;
  reason: string;
  cells: { x: number; y: number; from: string; to: string }[];
};

export function applyGeometryVariant(level: LevelDefinition, proposal: GeometryVariant): LevelDefinition {
  if (proposal.id !== level.id || !proposal.reason.trim() || !proposal.cells.length)
    throw new Error('Invalid geometry proposal');
  const rows = level.rows.map((row) => [...row]);
  const changed = new Set<string>();
  for (const cell of proposal.cells) {
    const { x, y, from, to } = cell;
    const key = `${x},${y}`;
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x <= 0 ||
      y <= 0 ||
      y >= rows.length - 1 ||
      x >= rows[y].length - 1 ||
      changed.has(key) ||
      rows[y][x] !== from ||
      !['#', '.', ' '].includes(from) ||
      !['#', '.', ' '].includes(to) ||
      from === to
    )
      throw new Error(`Invalid proposal cell ${key}`);
    rows[y][x] = to;
    changed.add(key);
  }
  // Only terrain can change. Loot, mandatory identities, nests, enemies and portals stay intact.
  return { ...level, rows: rows.map((row) => row.join('')) };
}

/** Historical proposals always address the literal reference, even after promotion. */
export function proposalBase(level: LevelDefinition): LevelDefinition {
  if (!corrections.some((correction) => correction.id === level.id)) return level;
  const reference = references.find((reference) => reference.id === level.id);
  if (!reference) throw new Error('Correction has no original reference');
  return { ...level, ...adaptGrid(reference.rows) };
}

export function authorLevel(id: number): LevelDefinition {
  const level = buildCampaignV6()[id - 1];
  const path = process.argv.find((arg) => arg.startsWith('--geometry='))?.slice(11);
  return path ? applyGeometryVariant(proposalBase(level), JSON.parse(readFileSync(path, 'utf8'))) : level;
}

export function validateProposalOutput(path: string | undefined): string {
  if (!path || path.startsWith('--')) throw new Error('Geometry variants require a separate explicit output');
  const output = resolve(path);
  const within = relative(resolve('reports/bongo-campaign-v6'), output);
  if (
    within.startsWith('..') ||
    isAbsolute(within) ||
    !output.endsWith('.json') ||
    /^route-\d+\.json$/i.test(basename(output))
  )
    throw new Error('Variant output must be a separate JSON under reports/bongo-campaign-v6');
  return output;
}

export function declareVariantOutput(level: LevelDefinition, path: string | undefined) {
  const source = process.argv.find((arg) => arg.startsWith('--geometry='))?.slice(11);
  if (!source) return;
  const output = validateProposalOutput(path);
  const proposal = JSON.parse(readFileSync(source, 'utf8'));
  const sha256 = createHash('sha256')
    .update(JSON.stringify({ ...level, solution: [], replay: [] }))
    .digest('hex');
  writeFileSync(
    `${output}.geometry.json`,
    JSON.stringify({ source, proposal, sha256, status: 'EXPERIMENTAL_NOT_A_CAMPAIGN_PROOF' }, null, 2) + '\n',
  );
}
