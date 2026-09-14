import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { sanitizeAiEnvironment } from '../cost-guard.mjs';
import { commandExists, runProcess } from '../process-runner.mjs';
import { classifyProviderFailure, ProviderStatus } from '../provider-status.mjs';

/** Potwierdza, że Codex działa z logowaniem ChatGPT, a nie z kluczem API. */
export async function probeCodex(config) {
  const executable = config.providers.codex.executable;
  if (!(await commandExists(executable, config.paths.root))) {
    return { provider: 'codex', status: ProviderStatus.CONFIG_ERROR, reason: 'Nie znaleziono Codex CLI.' };
  }
  const result = await runProcess({
    command: executable,
    args: ['login', 'status'],
    cwd: config.paths.root,
    env: sanitizeAiEnvironment(),
    timeoutMs: 15000,
    allowFailure: true,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.exitCode === 0 && /logged in using chatgpt/i.test(output)) {
    return { provider: 'codex', status: ProviderStatus.AVAILABLE, reason: 'Logowanie przez ChatGPT.' };
  }
  return { provider: 'codex', status: classifyProviderFailure(output), reason: output.trim() };
}

function baseArguments(config, cwd, sandbox, schemaPath, outputPath) {
  const args = ['-a', 'never'];
  if (config.providers.codex.profile) args.push('--profile', config.providers.codex.profile);
  args.push(
    'exec',
    '--ephemeral',
    '--json',
    '--color',
    'never',
    '-C',
    cwd,
    '--sandbox',
    sandbox,
    '--output-schema',
    schemaPath,
    '--output-last-message',
    outputPath,
    '-',
  );
  return args;
}

/** Uruchamia świeżą, subskrypcyjną sesję Codex i zwraca jej ustrukturyzowany rezultat. */
export async function runCodexTask({ config, cwd, prompt, schema, outputPath, logFile, sandbox }) {
  const result = await runProcess({
    command: config.providers.codex.executable,
    args: baseArguments(config, cwd, sandbox, path.join(config.paths.schemas, schema), outputPath),
    cwd,
    env: sanitizeAiEnvironment(),
    input: prompt,
    timeoutMs: config.limits.agentTimeoutMs,
    logFile,
    allowFailure: true,
  });
  if (result.status === 'FAIL') {
    return { status: classifyProviderFailure(`${result.stdout}\n${result.stderr}`), process: result };
  }
  try {
    return {
      status: ProviderStatus.AVAILABLE,
      report: JSON.parse(await readFile(outputPath, 'utf8')),
      process: result,
    };
  } catch (error) {
    return {
      status: ProviderStatus.FAILED,
      reason: `Niepoprawny raport JSON Codex: ${error.message}`,
      process: result,
    };
  }
}

/** Implementuje Issue w worktree; treść Issue jest przekazywana przez stdin, nigdy przez shell. */
export function implementWithCodex(context) {
  return runCodexTask({
    ...context,
    schema: 'implementation-report.schema.json',
    sandbox: 'workspace-write',
  });
}

/** Odrzuca niepełny lub niejednoznaczny raport recenzenta. */
export function validateCodexReviewReport(report) {
  if (
    !['PASS', 'CHANGES_REQUIRED', 'BLOCKED'].includes(report?.verdict) ||
    !Array.isArray(report?.findings)
  ) {
    throw new Error('CODEX_REVIEW_REPORT_INVALID');
  }
  return report;
}

/** Uruchamia niezależnego recenzenta w świeżym procesie i wyłącznie w trybie odczytu. */
export async function reviewWithCodex(context) {
  const result = await runCodexTask({
    ...context,
    schema: 'codex-review.schema.json',
    sandbox: 'read-only',
  });
  if (!result.report) return result;
  try {
    result.report = validateCodexReviewReport(result.report);
    return result;
  } catch (error) {
    return {
      ...result,
      status: ProviderStatus.FAILED,
      reason: error.message,
      report: undefined,
    };
  }
}
