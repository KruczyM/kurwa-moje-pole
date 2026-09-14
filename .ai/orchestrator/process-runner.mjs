import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const activeChildren = new Set();

/** Zachowuje natywną nazwę programu; rozszerzenie wybiera systemowy PATH. */
export function executableName(command) {
  return command;
}

/** Omija windowsowe shimy .cmd, uruchamiając znane npm CLI bezpośrednio przez Node. */
export function resolveSpawnCommand(command, args = [], platform = process.platform, env = process.env) {
  if (platform !== 'win32') return { command, args };
  if (command === 'npm' || command === 'npx') {
    const script = path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      command === 'npm' ? 'npm-cli.js' : 'npx-cli.js',
    );
    if (existsSync(script)) return { command: process.execPath, args: [script, ...args] };
  }
  if (command === 'codex' && env.APPDATA) {
    const script = path.join(env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    if (existsSync(script)) return { command: process.execPath, args: [script, ...args] };
  }
  return { command, args };
}

/** Kończy znane drzewo procesu; nie wyszukuje ani nie zabija procesów po nazwie. */
export async function terminateProcessTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

/** Uruchamia proces bez sklejania polecenia w shellu oraz zapisuje wynik i czas wykonania. */
export async function runProcess({
  command,
  args = [],
  cwd,
  env = process.env,
  input,
  timeoutMs = 120000,
  logFile,
  allowFailure = false,
  onSpawn,
}) {
  const startedAt = Date.now();
  const resolved = resolveSpawnCommand(command, args, process.platform, env);
  const child = spawn(resolved.command, resolved.args, {
    cwd,
    env,
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  activeChildren.add(child);
  child.once('exit', () => activeChildren.delete(child));
  child.once('error', () => activeChildren.delete(child));
  child.stdin.on('error', () => undefined);
  onSpawn?.(child);
  let stdout = '';
  let stderr = '';
  const maxCapturedCharacters = 2_000_000;
  child.stdout.on('data', (chunk) => {
    stdout = (stdout + chunk.toString()).slice(-maxCapturedCharacters);
  });
  child.stderr.on('data', (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-maxCapturedCharacters);
  });
  if (input !== undefined) child.stdin.end(input);
  else child.stdin.end();

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void terminateProcessTree(child);
  }, timeoutMs);

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? -1));
  }).finally(() => clearTimeout(timeout));
  const result = {
    command,
    args,
    exitCode,
    stdout,
    stderr,
    timedOut,
    durationMs: Date.now() - startedAt,
    status: exitCode === 0 && !timedOut ? 'PASS' : 'FAIL',
  };
  if (logFile) {
    await mkdir(path.dirname(logFile), { recursive: true });
    await appendFile(
      logFile,
      `${JSON.stringify({ ...result, stdout: undefined, stderr: undefined })}\n${stdout}${stderr}\n`,
    );
  }
  if (!allowFailure && result.status === 'FAIL') {
    const error = new Error(`${command} zakończył się kodem ${exitCode}${timedOut ? ' (timeout)' : ''}.`);
    error.result = result;
    throw error;
  }
  return result;
}

/** Kończy wszystkie procesy uruchomione przez bezpieczny runner bieżącej instancji. */
export async function stopAllChildProcesses() {
  await Promise.all([...activeChildren].map((child) => terminateProcessTree(child)));
  activeChildren.clear();
}

/** Sprawdza obecność programu poprzez PATH, nie uruchamiając samego dostawcy AI. */
export async function commandExists(command, cwd = process.cwd()) {
  const probe =
    process.platform === 'win32'
      ? { command: 'where.exe', args: [command] }
      : { command: 'which', args: [command] };
  const result = await runProcess({ ...probe, cwd, timeoutMs: 10000, allowFailure: true });
  return result.exitCode === 0;
}
