#!/usr/bin/env node
import { acquireLock } from './lock.mjs';
import { loadConfig } from './config.mjs';
import { dryRun, ensureLifecycleLabels, processIssue, readState, selectIssueForRun } from './pipeline.mjs';
import { resetState } from './state-store.mjs';
import { stopAllGameServers } from './game/dev-server.mjs';
import { stopAllChildProcesses } from './process-runner.mjs';

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

let releaseActiveLock;
let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    void Promise.all([stopAllGameServers(), stopAllChildProcesses()])
      .then(() => releaseActiveLock?.())
      .finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
  });
}

async function main() {
  const command = process.argv[2] ?? 'status';
  const config = await loadConfig();
  if (command === 'status') return print(await readState(config.paths.state));
  if (command === 'dry-run') return print(await dryRun(config));
  if (command === 'reset') {
    await resetState(config.paths.state);
    return print({ status: 'RESET', note: 'Branche, worktree i zmiany użytkownika pozostawiono bez zmian.' });
  }
  if (!['start', 'one', 'continue'].includes(command)) {
    throw new Error('Użycie: cli.mjs start|one|continue|status|dry-run|reset');
  }

  const release = await acquireLock(config.paths.lock);
  releaseActiveLock = release;
  try {
    await ensureLifecycleLabels(config);
    const selected = await selectIssueForRun(config, command === 'continue');
    if (!selected.issue)
      return print({ status: 'IDLE', reason: `Brak otwartego Issue z etykietą ${config.issue.readyLabel}.` });
    const result = await processIssue(config, selected.issue, selected.state);
    print(result);
  } finally {
    await release();
    releaseActiveLock = undefined;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
