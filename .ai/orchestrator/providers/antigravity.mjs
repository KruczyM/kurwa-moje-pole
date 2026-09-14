import { readFile } from 'node:fs/promises';
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
  const capabilityArgs = capability === 'browser' ? provider.browserArgs : provider.implementationArgs;
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

/** Uruchamia skonfigurowany tryb Antigravity, oczekując końcowego raportu JSON w pliku. */
export async function runAntigravityTask({ config, capability, cwd, prompt, outputPath, logFile }) {
  const provider = config.providers.antigravity;
  const configuredArgs = capability === 'browser' ? provider.browserArgs : provider.implementationArgs;
  const args = configuredArgs.map((value) =>
    value
      .replaceAll('{output}', outputPath)
      .replaceAll('{cwd}', cwd)
      .replaceAll(
        '{schema}',
        path.join(
          config.paths.schemas,
          capability === 'browser' ? 'browser-report.schema.json' : 'implementation-report.schema.json',
        ),
      ),
  );
  const result = await runProcess({
    command: provider.executable,
    args,
    cwd,
    env: sanitizeAiEnvironment(),
    input: prompt,
    timeoutMs: capability === 'browser' ? config.limits.browserTimeoutMs : config.limits.agentTimeoutMs,
    logFile,
    allowFailure: true,
  });
  if (result.status === 'FAIL')
    return { status: classifyProviderFailure(`${result.stdout}\n${result.stderr}`), process: result };
  try {
    return {
      status: ProviderStatus.AVAILABLE,
      report: JSON.parse(await readFile(outputPath, 'utf8')),
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
