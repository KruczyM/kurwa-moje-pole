import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSubscriptionOnlyMode } from './cost-guard.mjs';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(moduleDirectory, '..', '..');

/** Wczytuje konfigurację i zamienia wszystkie ścieżki względne na ścieżki repozytorium. */
export async function loadConfig(configPath = path.join(repositoryRoot, '.ai', 'pipeline.config.json')) {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  assertSubscriptionOnlyMode(config);
  config.paths = {
    root: repositoryRoot,
    config: configPath,
    runtime: path.join(repositoryRoot, '.ai', 'runtime'),
    state: path.join(repositoryRoot, '.ai', 'runtime', 'state.json'),
    lock: path.join(repositoryRoot, '.ai', 'runtime', 'pipeline.lock'),
    logs: path.join(repositoryRoot, '.ai', 'logs'),
    artifacts: path.join(repositoryRoot, '.ai', 'artifacts'),
    worktrees: path.resolve(repositoryRoot, config.git.worktreeRoot),
    schemas: path.join(repositoryRoot, '.ai', 'schemas'),
  };
  return config;
}
