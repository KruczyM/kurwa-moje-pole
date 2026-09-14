import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Odczytuje ostatni bezpiecznie zapisany stan albo zwraca pusty stan kolejki. */
export async function readState(statePath) {
  try {
    return JSON.parse(await readFile(statePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { phase: 'IDLE', updatedAt: new Date().toISOString() };
    throw error;
  }
}

/** Zapisuje stan atomowo przez plik tymczasowy i rename. */
export async function writeState(statePath, state) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, statePath);
  return next;
}

/** Usuwa wyłącznie stan wykonania; nie dotyka branchy, worktree ani zmian użytkownika. */
export async function resetState(statePath) {
  await rm(statePath, { force: true });
}
