import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sanitizeAiEnvironment } from '../cost-guard.mjs';
import { commandExists, runProcess } from '../process-runner.mjs';
import { classifyProviderFailure, ProviderStatus } from '../provider-status.mjs';

/** Weryfikuje headless CLI i jawne potwierdzenie logowania subskrypcyjnego. */
export async function probeAntigravity(config, capability = 'implementation') {
  const provider = config.providers.antigravity;
  if (!(await commandExists(provider.executable, config.paths.root))) {
    return {
      provider: 'antigravity',
      status: ProviderStatus.CONFIG_ERROR,
      reason: 'Brak headless Antigravity CLI w PATH. Sam Antigravity IDE nie udostępnia raportów JSON.',
    };
  }
  const capabilityArgs =
    capability === 'browser'
      ? provider.browserArgs
      : capability === 'review'
        ? provider.reviewArgs
        : provider.implementationArgs;
  if (!Array.isArray(capabilityArgs) || !provider.subscriptionAuthConfirmed) {
    return {
      provider: 'antigravity',
      status: ProviderStatus.CONFIG_ERROR,
      reason: 'Brak zweryfikowanych argumentów CLI lub potwierdzenia logowania subskrypcyjnego.',
    };
  }
  const result = await runProcess({
    command: provider.executable,
    args: provider.probeArgs,
    cwd: config.paths.root,
    env: sanitizeAiEnvironment(),
    timeoutMs: 15000,
    allowFailure: true,
  });
  return result.exitCode === 0
    ? { provider: 'antigravity', status: ProviderStatus.AVAILABLE, reason: result.stdout.trim() }
    : {
        provider: 'antigravity',
        status: classifyProviderFailure(`${result.stdout}\n${result.stderr}`),
        reason: result.stderr.trim(),
      };
}

/** Odczytuje końcowy wynik z JSON lub strumienia zdarzeń NDJSON programu agy. */
export function parseAntigravityOutput(stdout) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error('Antigravity nie zwrócił żadnego wyniku.');

  const envelopes = lines.map((line) => JSON.parse(line));
  const terminal =
    [...envelopes].reverse().find((entry) => entry?.event === 'result')?.result ??
    envelopes.at(-1)?.result ??
    envelopes.at(-1);
  if (terminal?.status !== 'SUCCESS') {
    throw new Error(terminal?.error ?? terminal?.response ?? `Status: ${terminal?.status ?? 'brak'}`);
  }
  if (terminal.denied_actions?.length) {
    const denied = terminal.denied_actions.map((entry) => entry.action ?? entry.display_name).join(', ');
    throw new Error(`Antigravity odmówił wymaganych działań: ${denied}`);
  }
  if (terminal.structured_output && typeof terminal.structured_output === 'object') {
    return terminal.structured_output;
  }
  if (typeof terminal.response === 'string' && terminal.response.trim()) {
    return JSON.parse(terminal.response);
  }
  throw new Error('Antigravity nie zwrócił structured_output ani odpowiedzi JSON.');
}

/** Uruchamia Antigravity Headless i zapisuje jego zweryfikowany raport w pliku pipeline. */
export async function runAntigravityTask({ config, capability, cwd, prompt, outputPath, logFile }) {
  const provider = config.providers.antigravity;
  const configuredArgs =
    capability === 'browser'
      ? provider.browserArgs
      : capability === 'review'
        ? provider.reviewArgs
        : provider.implementationArgs;
  const args = configuredArgs.map((value) =>
    value
      .replaceAll('{cwd}', cwd)
      .replaceAll(
        '{schema}',
        path.join(
          config.paths.schemas,
          capability === 'browser'
            ? 'browser-report.schema.json'
            : capability === 'review'
              ? 'codex-review.schema.json'
              : 'implementation-report.schema.json',
        ),
      ),
  );
  const result = await runProcess({
    command: provider.executable,
    args,
    cwd,
    env: sanitizeAiEnvironment(),
    input: `${JSON.stringify({ event: 'user', message: { content: prompt } })}\n`,
    timeoutMs: capability === 'browser' ? config.limits.browserTimeoutMs : config.limits.agentTimeoutMs,
    logFile,
    allowFailure: true,
  });
  if (result.status === 'FAIL')
    return { status: classifyProviderFailure(`${result.stdout}\n${result.stderr}`), process: result };
  try {
    const report = parseAntigravityOutput(result.stdout);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return {
      status: ProviderStatus.AVAILABLE,
      report,
      process: result,
    };
  } catch (error) {
    return {
      status: ProviderStatus.FAILED,
      reason: `Niepoprawny raport Antigravity: ${error.message}`,
      process: result,
    };
  }
}

/** Uruchamia świeżą sesję Antigravity jako recenzenta tylko do odczytu logicznego. */
export async function reviewWithAntigravity(context) {
  const result = await runAntigravityTask({ ...context, capability: 'review' });
  if (!result.report) return result;
  if (
    !['PASS', 'CHANGES_REQUIRED', 'BLOCKED'].includes(result.report.verdict) ||
    !Array.isArray(result.report.findings)
  ) {
    return {
      ...result,
      status: ProviderStatus.FAILED,
      reason: 'ANTIGRAVITY_REVIEW_REPORT_INVALID',
      report: undefined,
    };
  }
  return result;
}
