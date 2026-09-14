import { spawn } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { resolveSpawnCommand, terminateProcessTree } from '../process-runner.mjs';

const activeServers = new Set();

async function waitForUrl(url, timeoutMs, processExit) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'brak odpowiedzi';
  while (Date.now() < deadline) {
    if (processExit.value !== null) throw new Error(`Serwer zakończył się kodem ${processExit.value}.`);
    if (processExit.error) throw processExit.error;
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.ok || (response.status >= 300 && response.status < 400)) return response.status;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`DEV_SERVER_TIMEOUT: ${url}: ${lastError}`);
}

/** Uruchamia klienta i serwer gry, czeka na localhost oraz zwraca kontrolowane sprzątanie PID. */
export async function startGameServer(config, worktree, issueLogDirectory) {
  const logFile = path.join(issueLogDirectory, 'dev-server.log');
  await mkdir(path.dirname(logFile), { recursive: true });
  const resolved = resolveSpawnCommand(config.game.serverCommand, config.game.serverArgs);
  const child = spawn(resolved.command, resolved.args, {
    cwd: worktree,
    env: process.env,
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const processExit = { value: null, error: null };
  child.once('exit', (code) => {
    processExit.value = code ?? -1;
  });
  child.once('error', (error) => {
    processExit.error = error;
  });
  child.stdout.on('data', (chunk) => void appendFile(logFile, chunk).catch(() => undefined));
  child.stderr.on('data', (chunk) => void appendFile(logFile, chunk).catch(() => undefined));
  activeServers.add(child);
  try {
    const httpStatus = await waitForUrl(
      config.game.readyUrl,
      config.limits.devServerStartTimeoutMs,
      processExit,
    );
    let stopped = false;
    return {
      pid: child.pid,
      url: config.game.readyUrl,
      httpStatus,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        activeServers.delete(child);
        await terminateProcessTree(child);
      },
    };
  } catch (error) {
    activeServers.delete(child);
    await terminateProcessTree(child);
    throw error;
  }
}

/** Sprząta wyłącznie serwery utworzone przez bieżący proces orkiestratora. */
export async function stopAllGameServers() {
  await Promise.all([...activeServers].map((child) => terminateProcessTree(child)));
  activeServers.clear();
}
