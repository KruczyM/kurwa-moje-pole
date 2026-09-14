import path from 'node:path';
import { runProcess } from './process-runner.mjs';

/** Wykonuje rzeczywiste polecenia projektu po kolei i zatrzymuje się na pierwszej porażce. */
export async function runValidation(config, worktree, issueLogDirectory) {
  const results = [];
  for (const check of config.validation.commands) {
    const result = await runProcess({
      command: check.command,
      args: check.args,
      cwd: worktree,
      timeoutMs: config.limits.validationTimeoutMs,
      allowFailure: true,
      logFile: path.join(issueLogDirectory, 'validation.log'),
    });
    results.push({ name: check.name, ...result });
    if (result.status === 'FAIL') break;
  }
  return { status: results.every((entry) => entry.status === 'PASS') ? 'PASS' : 'FAIL', results };
}
