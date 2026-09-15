import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertSubscriptionOnlyMode,
  detectPaidAiEnvironment,
  sanitizeAiEnvironment,
} from '../orchestrator/cost-guard.mjs';
import { acquireLock } from '../orchestrator/lock.mjs';
import { executableName, resolveSpawnCommand, runProcess } from '../orchestrator/process-runner.mjs';
import { classifyProviderFailure, ProviderStatus } from '../orchestrator/provider-status.mjs';
import { readState, resetState, writeState } from '../orchestrator/state-store.mjs';
import { assessIssueQuality } from '../orchestrator/issue-quality.mjs';
import { issueBranch, prepareIssueWorktree } from '../orchestrator/git-worktree.mjs';
import { detectLocalBrowserTool, validateBrowserReport } from '../orchestrator/game/browser-verifier.mjs';
import {
  chooseAvailableProvider,
  shouldContinueIssueQueue,
  shouldFallbackImplementationProvider,
} from '../orchestrator/pipeline.mjs';
import { selectEligibleIssueQueue } from '../orchestrator/github.mjs';
import { runValidation } from '../orchestrator/validation.mjs';
import { validateCodexReviewReport } from '../orchestrator/providers/codex.mjs';
import { parseAntigravityOutput } from '../orchestrator/providers/antigravity.mjs';
import { implementationPrompt } from '../orchestrator/prompts.mjs';

async function withTemporaryDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'camp-ai-pipeline-'));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('zero-cost guard rejects every paid configuration', () => {
  const safe = {
    cost: { subscriptionOnly: true, allowPaidApi: false, allowAiCredits: false },
    github: { autoMerge: false },
  };
  assert.equal(assertSubscriptionOnlyMode(safe), true);
  assert.throws(
    () => assertSubscriptionOnlyMode({ ...safe, cost: { ...safe.cost, allowPaidApi: true } }),
    /PAID_AI_CONFIGURATION_DETECTED/,
  );
  assert.throws(
    () => assertSubscriptionOnlyMode({ ...safe, github: { autoMerge: true } }),
    /automatyczny merge/,
  );
});

test('AI environment sanitizer removes keys without mutating parent environment', () => {
  const source = { OPENAI_API_KEY: 'secret', GEMINI_API_KEY: 'secret2', PATH: 'ok' };
  assert.deepEqual(detectPaidAiEnvironment(source), ['OPENAI_API_KEY', 'GEMINI_API_KEY']);
  const sanitized = sanitizeAiEnvironment(source);
  assert.equal(sanitized.OPENAI_API_KEY, undefined);
  assert.equal(sanitized.GEMINI_API_KEY, undefined);
  assert.equal(sanitized.PATH, 'ok');
  assert.equal(source.OPENAI_API_KEY, 'secret');
});

test('provider errors distinguish quota, rate limit, auth and paid API', () => {
  assert.equal(classifyProviderFailure('quota exceeded'), ProviderStatus.QUOTA_EXHAUSTED);
  assert.equal(
    classifyProviderFailure("You've hit your usage limit. Purchase more credits or try again later."),
    ProviderStatus.QUOTA_EXHAUSTED,
  );
  assert.equal(classifyProviderFailure('too many requests'), ProviderStatus.TEMPORARILY_RATE_LIMITED);
  assert.equal(classifyProviderFailure('login required'), ProviderStatus.AUTH_ERROR);
  assert.equal(classifyProviderFailure('set GEMINI_API_KEY and billing'), ProviderStatus.PAID_API_REQUIRED);
});

test('fallback chooses Codex when Antigravity is unavailable', () => {
  const statuses = [
    { provider: 'antigravity', status: ProviderStatus.QUOTA_EXHAUSTED },
    { provider: 'codex', status: ProviderStatus.AVAILABLE },
  ];
  assert.equal(chooseAvailableProvider(['antigravity', 'codex'], statuses), 'codex');
  assert.equal(chooseAvailableProvider(['antigravity'], statuses), null);
});

test('implementation fallback does not replace Antigravity after a fixable tool failure', () => {
  assert.equal(shouldFallbackImplementationProvider(ProviderStatus.FAILED), false);
  assert.equal(shouldFallbackImplementationProvider(ProviderStatus.TEMPORARILY_RATE_LIMITED), false);
  assert.equal(shouldFallbackImplementationProvider(ProviderStatus.QUOTA_EXHAUSTED), true);
});

test('start continues successful issues while one and blocked results stop', () => {
  const ready = { phase: 'READY_FOR_HUMAN_REVIEW' };
  assert.equal(shouldContinueIssueQueue('start', ready, 1, null), true);
  assert.equal(shouldContinueIssueQueue('start', ready, 2, 2), false);
  assert.equal(shouldContinueIssueQueue('one', ready, 1, null), false);
  assert.equal(shouldContinueIssueQueue('start', { phase: 'BLOCKED' }, 1, null), false);
});

test('issue queue selects only open ai-ready issues in numeric order', () => {
  const issues = [
    { number: 9, state: 'OPEN', labels: [{ name: 'ai-ready' }] },
    { number: 2, state: 'OPEN', labels: [{ name: 'ai-ready' }] },
    { number: 1, state: 'OPEN', labels: [{ name: 'bug' }] },
    { number: 3, state: 'CLOSED', labels: [{ name: 'ai-ready' }] },
  ];
  assert.deepEqual(
    selectEligibleIssueQueue(issues, 'ai-ready').map((issue) => issue.number),
    [2, 9],
  );
});

test('state is persisted atomically and reset leaves directory intact', () =>
  withTemporaryDirectory(async (directory) => {
    const statePath = path.join(directory, 'runtime', 'state.json');
    await writeState(statePath, { phase: 'VALIDATION', issue: { number: 12 } });
    const state = await readState(statePath);
    assert.equal(state.phase, 'VALIDATION');
    assert.equal(state.issue.number, 12);
    assert.ok(state.updatedAt);
    await resetState(statePath);
    assert.equal((await readState(statePath)).phase, 'IDLE');
  }));

test('lock rejects concurrent orchestrator and can be acquired after release', () =>
  withTemporaryDirectory(async (directory) => {
    const lockPath = path.join(directory, 'pipeline.lock');
    const release = await acquireLock(lockPath);
    await assert.rejects(() => acquireLock(lockPath), /PIPELINE_LOCKED/);
    await release();
    const secondRelease = await acquireLock(lockPath);
    await secondRelease();
  }));

test('process runner records deterministic failure instead of trusting agent text', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', 'process.stderr.write("boom"); process.exit(7)'],
    cwd: process.cwd(),
    allowFailure: true,
  });
  assert.equal(result.exitCode, 7);
  assert.equal(result.status, 'FAIL');
  assert.match(result.stderr, /boom/);
});

test('process runner launches npm without a Windows shell shim', async () => {
  const result = await runProcess({ command: 'npm', args: ['--version'], cwd: process.cwd() });
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test('validation stops after a deterministic failing command', () =>
  withTemporaryDirectory(async (directory) => {
    const config = {
      limits: { validationTimeoutMs: 10000 },
      validation: {
        commands: [
          { name: 'typecheck', command: process.execPath, args: ['-e', 'process.exit(0)'] },
          { name: 'build', command: process.execPath, args: ['-e', 'process.exit(2)'] },
          { name: 'must-not-run', command: process.execPath, args: ['-e', 'process.exit(0)'] },
        ],
      },
    };
    const report = await runValidation(config, directory, path.join(directory, 'logs'));
    assert.equal(report.status, 'FAIL');
    assert.deepEqual(
      report.results.map((result) => result.name),
      ['typecheck', 'build'],
    );
  }));

test('issue gate detects missing criteria and runtime scope', () => {
  const weak = assessIssueQuality({ title: 'Zmień rzecz', body: 'krótko' });
  assert.equal(weak.status, 'NEEDS_HUMAN_CLARIFICATION');
  const strong = assessIssueQuality({
    title: 'Napraw model Three.js',
    body: 'Cel: model gracza ma się poprawnie wczytać w scenie. Oczekiwane zachowanie: po wyborze postaci canvas pokazuje model, a konsola nie zawiera błędów assetu.',
  });
  assert.equal(strong.status, 'PASS');
  assert.equal(strong.browserVerificationRequired, true);
});

test('branch name cannot inject shell syntax', () => {
  const branch = issueBranch({ git: { branchPrefix: 'ai/' } }, { number: 7, title: 'Model && rm -rf /' });
  assert.equal(branch, 'ai/7-model-rm-rf');
  assert.equal(executableName('npm'), 'npm');
  assert.equal(resolveSpawnCommand('npm', ['run', 'test'], 'win32').command, process.execPath);
});

test('Windows runner resolves the official default agy installation', () =>
  withTemporaryDirectory(async (directory) => {
    const executable = path.join(directory, 'agy', 'bin', 'agy.exe');
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, 'fixture');
    assert.equal(
      resolveSpawnCommand('agy', ['--version'], 'win32', { LOCALAPPDATA: directory }).command,
      executable,
    );
  }));

test('Antigravity adapter reads structured output from stream-json', () => {
  const stdout = [
    JSON.stringify({ event: 'message', message: { content: 'working' } }),
    JSON.stringify({
      event: 'result',
      result: { status: 'SUCCESS', structured_output: { status: 'PASS', summary: 'done' } },
    }),
  ].join('\n');
  assert.deepEqual(parseAntigravityOutput(stdout), { status: 'PASS', summary: 'done' });
  assert.throws(
    () => parseAntigravityOutput(JSON.stringify({ status: 'ERROR', error: 'quota exceeded' })),
    /quota exceeded/,
  );
  assert.throws(
    () =>
      parseAntigravityOutput(
        JSON.stringify({ status: 'SUCCESS', response: '', denied_actions: [{ action: 'command' }] }),
      ),
    /odmówił wymaganych działań: command/,
  );
});

test('implementation prompt confines agent discovery to the issue worktree', () => {
  const prompt = implementationPrompt(
    { number: 29, title: 'Room server', body: 'Cel i kryteria zadania.' },
    { worktree: 'E:/repo/.ai/worktrees/issue-29', feedback: [] },
  );
  assert.match(prompt, /E:\/repo\/\.ai\/worktrees\/issue-29\/AGENTS\.md/);
  assert.match(prompt, /Nie szukaj plików.*poza tym worktree/);
  assert.match(prompt, /nie uruchamiaj żadnych poleceń terminala/);
});

test('implementation correction prompt forbids command tools and orchestrator edits', () => {
  const prompt = implementationPrompt(
    { number: 29, title: 'Room server', body: 'Cel i kryteria zadania.' },
    { worktree: 'E:/repo/.ai/worktrees/issue-29', feedback: ['server/Room.ts: popraw błąd'] },
  );
  assert.match(prompt, /Pod żadnym pozorem nie wywołuj run_command/);
  assert.match(prompt, /Nie czytaj ani nie modyfikuj katalogu \.ai/);
});

test('implementation correction prompt permits only the scoped formatter command when requested', () => {
  const prompt = implementationPrompt(
    { number: 29, title: 'Format', body: 'Issue' },
    {
      worktree: 'C:/repo/worktree',
      feedback: ['Napraw format: npx prettier src/main.ts --write'],
    },
  );

  assert.match(prompt, /wyłącznie komendy `npx prettier src\/main\.ts --write`/);
  assert.match(prompt, /Nie wywołuj żadnej innej komendy/);
});

test('worktree isolation creates an issue branch without switching main', () =>
  withTemporaryDirectory(async (directory) => {
    await runProcess({ command: 'git', args: ['init', '-b', 'main'], cwd: directory });
    await runProcess({
      command: 'git',
      args: ['config', 'user.email', 'pipeline@example.invalid'],
      cwd: directory,
    });
    await runProcess({ command: 'git', args: ['config', 'user.name', 'Pipeline Test'], cwd: directory });
    await writeFile(path.join(directory, 'README.md'), 'fixture\n');
    await runProcess({ command: 'git', args: ['add', 'README.md'], cwd: directory });
    await runProcess({ command: 'git', args: ['commit', '-m', 'fixture'], cwd: directory });
    const config = {
      paths: { root: directory, worktrees: path.join(directory, '.ai', 'worktrees') },
      git: { baseBranch: 'main', branchPrefix: 'ai/' },
    };
    const result = await prepareIssueWorktree(config, { number: 43, title: 'Player interaction' });
    assert.equal(result.branch, 'ai/43-player-interaction');
    assert.equal(
      (
        await runProcess({ command: 'git', args: ['branch', '--show-current'], cwd: directory })
      ).stdout.trim(),
      'main',
    );
    assert.equal(
      (
        await runProcess({ command: 'git', args: ['branch', '--show-current'], cwd: result.worktree })
      ).stdout.trim(),
      result.branch,
    );
  }));

test('browser tool detection and report parsing use local fixtures only', () =>
  withTemporaryDirectory(async (directory) => {
    await writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify({ devDependencies: { playwright: '1.0.0' } }),
    );
    assert.equal(await detectLocalBrowserTool(directory), 'playwright');
    const valid = {
      status: 'PASS',
      url: 'http://127.0.0.1',
      gameLoaded: true,
      webgl: { canvasFound: true, contextCreated: true, rendering: true },
      scenarios: [],
      runtimeErrors: [],
      assetFailures: [],
      screenshots: [],
      recordings: [],
      findings: [],
    };
    assert.equal(validateBrowserReport(valid).status, 'PASS');
    assert.throws(() => validateBrowserReport({ status: 'PASS' }), /BROWSER_REPORT_INVALID/);
    assert.equal(validateCodexReviewReport({ verdict: 'PASS', findings: [] }).verdict, 'PASS');
    assert.throws(() => validateCodexReviewReport({ verdict: 'maybe' }), /CODEX_REVIEW_REPORT_INVALID/);
  }));
