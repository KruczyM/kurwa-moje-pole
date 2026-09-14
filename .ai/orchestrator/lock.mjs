import { mkdir, open, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Zakłada blokadę PID i usuwa ją tylko, gdy należy do bieżącego procesu. */
export async function acquireLock(lockPath) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, 'wx');
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
    await handle.close();
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = JSON.parse(await readFile(lockPath, 'utf8'));
    if (Number.isInteger(existing.pid) && processIsAlive(existing.pid)) {
      throw new Error(`PIPELINE_LOCKED: działa proces PID ${existing.pid}.`, { cause: error });
    }
    await rm(lockPath, { force: true });
    return acquireLock(lockPath);
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    try {
      const existing = JSON.parse(await readFile(lockPath, 'utf8'));
      if (existing.pid === process.pid) await rm(lockPath, { force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  };
}
