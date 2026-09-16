import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { detectPaidAiEnvironment } from './cost-guard.mjs';
import { ProviderStatus } from './provider-status.mjs';
import { probeAntigravity, reviewWithAntigravity, runAntigravityTask } from './providers/antigravity.mjs';
import { implementWithCodex, probeCodex } from './providers/codex.mjs';
import { assessIssueQuality } from './issue-quality.mjs';
import {
  createPullRequest,
  ensureLifecycleLabels,
  getIssue,
  listEligibleIssues,
  setIssueLifecycle,
} from './github.mjs';
import { commitIssueWorktree, prepareIssueWorktree, worktreeStatus } from './git-worktree.mjs';
import { runValidation } from './validation.mjs';
import { startGameServer } from './game/dev-server.mjs';
import { verifyGameInBrowser } from './game/browser-verifier.mjs';
import { implementationPrompt, reviewPrompt } from './prompts.mjs';
import { readState, writeState } from './state-store.mjs';

const FALLBACK_PROVIDER_FAILURES = new Set([
  ProviderStatus.QUOTA_EXHAUSTED,
  ProviderStatus.AUTH_ERROR,
  ProviderStatus.CONFIG_ERROR,
  ProviderStatus.PAID_API_REQUIRED,
]);

/** Zezwala na fallback dopiero, gdy preferowany provider faktycznie nie może kontynuować. */
export function shouldFallbackImplementationProvider(status) {
  return FALLBACK_PROVIDER_FAILURES.has(status);
}

function issueDirectories(config, issueNumber) {
  return {
    logs: path.join(config.paths.logs, `issue-${issueNumber}`),
    artifacts: path.join(config.paths.artifacts, `issue-${issueNumber}`),
  };
}

async function save(config, state, phase, patch = {}) {
  return writeState(config.paths.state, { ...state, ...patch, phase });
}

async function safeLifecycle(config, issueNumber, label) {
  try {
    await setIssueLifecycle(config, issueNumber, label);
  } catch (error) {
    console.warn(`Nie udało się ustawić etykiety ${label}: ${error.message}`);
  }
}

/** Wybiera pierwszego dostępnego implementera, nigdy nie uruchamiając płatnego API. */
export async function selectImplementationProvider(config) {
  const statuses = [];
  for (const provider of config.providers.implementationPriority) {
    const status = provider === 'antigravity' ? await probeAntigravity(config) : await probeCodex(config);
    statuses.push(status);
    if (status.status === ProviderStatus.AVAILABLE) return { selected: provider, statuses };
  }
  return { selected: null, statuses };
}

/** Wybiera pierwszy status AVAILABLE według konfiguracji; używane też przez testy bez live AI. */
export function chooseAvailableProvider(priority, statuses) {
  for (const provider of priority) {
    if (statuses.find((entry) => entry.provider === provider)?.status === ProviderStatus.AVAILABLE)
      return provider;
  }
  return null;
}

/** Określa, czy tryb start może bezpiecznie przejść do następnego Issue w kolejce. */
export function shouldContinueIssueQueue(command, result, processedCount, configuredLimit) {
  if (command !== 'start' || result?.phase !== 'READY_FOR_HUMAN_REVIEW') return false;
  const limit = Number.isInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : Infinity;
  return processedCount < limit;
}

async function runImplementation({ config, provider, issue, worktree, directories, feedback, attempt }) {
  const outputPath = path.join(directories.logs, `implementation-${attempt}.json`);
  const common = {
    config,
    cwd: worktree,
    prompt: implementationPrompt(issue, { feedback, worktree }),
    outputPath,
    logFile: path.join(directories.logs, `implementation-${attempt}.log`),
  };
  return provider === 'antigravity'
    ? runAntigravityTask({ ...common, capability: 'implementation' })
    : implementWithCodex(common);
}

function validationFeedback(validation) {
  const failed = validation.results.find((result) => result.status === 'FAIL');
  if (!failed) return [];
  return [
    `Walidacja ${failed.name} nie przeszła. stderr: ${failed.stderr.slice(-6000)} stdout: ${failed.stdout.slice(-6000)}`,
  ];
}

function browserFeedback(report) {
  return [...(report.findings ?? []), ...(report.runtimeErrors ?? []), ...(report.assetFailures ?? [])];
}

function reviewFeedback(report) {
  return (report.findings ?? []).map(
    (finding) =>
      `${finding.severity}: ${finding.file}${finding.line ? `:${finding.line}` : ''} — ${finding.problem}. Oczekiwane: ${finding.expected}. ${finding.suggestedFix}`,
  );
}

async function writeSummary(directories, summary) {
  await mkdir(directories.logs, { recursive: true });
  await writeFile(
    path.join(directories.logs, 'summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
}

function pullRequestBody(issue, state) {
  const checks = state.validation?.results ?? [];
  return `Closes #${issue.number}\n\n## Implementacja\n\n- Provider: ${state.implementationProvider}\n- Zmienione systemy: ${state.implementationReport?.summary ?? 'patrz diff'}\n\n## Walidacja deterministyczna\n\n${checks.map((item) => `- ${item.status === 'PASS' ? '✓' : '✗'} ${item.name} (${item.durationMs} ms)`).join('\n')}\n\n## Gra / WebGL / gameplay\n\n- Status: ${state.browserReport?.status ?? 'NIE DOTYCZY'}\n- Canvas: ${state.browserReport?.webgl?.canvasFound ?? 'n/d'}\n- WebGL: ${state.browserReport?.webgl?.contextCreated ?? 'n/d'}\n- Render sceny: ${state.browserReport?.webgl?.rendering ?? 'n/d'}\n- Screenshoty: ${(state.browserReport?.screenshots ?? []).join(', ') || 'brak'}\n- Nagrania: ${(state.browserReport?.recordings ?? []).join(', ') || 'brak'}\n\n## Niezależny review\n\n- Codex: ${state.codexReview?.verdict ?? 'brak'}\n- Podsumowanie: ${state.codexReview?.summary ?? 'brak'}\n\n## Koszt i bezpieczeństwo\n\n- AI: SUBSCRIPTION_ONLY\n- Płatne API i kredyty: DISABLED\n- Auto-merge: DISABLED\n\n## Status\n\nREADY FOR HUMAN REVIEW\n`;
}

/** Przeprowadza jedno Issue przez cały pipeline i pozostawia PR do decyzji człowieka. */
export async function processIssue(config, issue, resumedState = null) {
  const quality = assessIssueQuality(issue);
  let state = resumedState ?? { issue, attempts: { fix: 0, browser: 0, review: 0 } };
  state.issue = issue;
  const directories = issueDirectories(config, issue.number);
  await mkdir(directories.logs, { recursive: true });
  await mkdir(directories.artifacts, { recursive: true });

  if (quality.status !== 'PASS') {
    state = await save(config, state, 'NEEDS_HUMAN_CLARIFICATION', { quality });
    await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.needsHuman);
    await writeSummary(directories, state);
    return state;
  }

  await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.inProgress);
  const worktreeInfo =
    state.worktree && state.branch
      ? { worktree: state.worktree, branch: state.branch, reused: true }
      : await prepareIssueWorktree(config, issue);
  state = await save(config, state, 'IMPLEMENTATION', worktreeInfo);

  const providerSelection = await selectImplementationProvider(config);
  if (!providerSelection.selected) {
    state = await save(config, state, 'BLOCKED', {
      providerStatuses: providerSelection.statuses,
      lastError: 'Brak bezpłatnego dostawcy AI.',
    });
    await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.blocked);
    await writeSummary(directories, state);
    return state;
  }
  state.implementationProvider = providerSelection.selected;
  state.providerStatuses = providerSelection.statuses;

  let feedback =
    resumedState?.codexReview?.verdict === 'CHANGES_REQUIRED'
      ? reviewFeedback(resumedState.codexReview)
      : Array.isArray(resumedState?.lastFeedback)
        ? resumedState.lastFeedback
        : [];
  const existingChanges = await worktreeStatus(worktreeInfo.worktree);
  const mayResumeAfterImplementation =
    resumedState && existingChanges && !['IMPLEMENTATION', 'SELECTED'].includes(resumedState.phase);
  if (!mayResumeAfterImplementation) {
    const implementation = await runImplementation({
      config,
      provider: state.implementationProvider,
      issue,
      worktree: worktreeInfo.worktree,
      directories,
      feedback,
      attempt: state.attempts.fix,
    });
    if (implementation.status !== ProviderStatus.AVAILABLE) {
      if (
        state.implementationProvider === 'antigravity' &&
        shouldFallbackImplementationProvider(implementation.status)
      ) {
        const codex = await probeCodex(config);
        state.providerStatuses.push(codex);
        if (codex.status === ProviderStatus.AVAILABLE) {
          state.implementationProvider = 'codex';
          const fallback = await runImplementation({
            config,
            provider: 'codex',
            issue,
            worktree: worktreeInfo.worktree,
            directories,
            feedback,
            attempt: state.attempts.fix,
          });
          if (fallback.status === ProviderStatus.AVAILABLE) state.implementationReport = fallback.report;
          else state.lastError = fallback.reason ?? fallback.status;
        } else state.lastError = 'Wyczerpano lub utracono obie subskrypcje.';
      } else state.lastError = implementation.reason ?? implementation.status;
      if (!state.implementationReport) {
        state = await save(config, state, 'BLOCKED');
        await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.blocked);
        await writeSummary(directories, state);
        return state;
      }
    } else state.implementationReport = implementation.report;
  }

  while (state.attempts.fix <= config.limits.maxFixAttempts) {
    await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.validation);
    state = await save(config, state, 'VALIDATION');
    const validation = await runValidation(config, worktreeInfo.worktree, directories.logs);
    state.validation = validation;
    if (validation.status === 'FAIL') {
      feedback = validationFeedback(validation);
      await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.testsFailed);
    } else {
      let browserReport = {
        status: 'NOT_REQUIRED',
        scenarios: [],
        screenshots: [],
        recordings: [],
        findings: [],
      };
      if (quality.browserVerificationRequired && config.game.browserVerification) {
        await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.browserReview);
        state = await save(config, state, 'GAMEPLAY_VERIFICATION', { validation });
        const server = await startGameServer(config, worktreeInfo.worktree, directories.logs);
        state.gameServer = { pid: server.pid, url: server.url, httpStatus: server.httpStatus };
        try {
          browserReport = await verifyGameInBrowser({
            config,
            issue,
            worktree: worktreeInfo.worktree,
            issueLogDirectory: directories.logs,
            artifactDirectory: directories.artifacts,
            url: server.url,
          });
        } finally {
          await server.stop();
          state.gameServer = { ...state.gameServer, stopped: true };
        }
        state.browserReport = browserReport;
        if (browserReport.status === 'FAIL') {
          state.attempts.browser += 1;
          feedback = browserFeedback(browserReport);
          if (state.attempts.browser > config.limits.maxBrowserFixAttempts) break;
        }
      }

      if (browserReport.status !== 'FAIL') {
        await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.codeReview);
        state = await save(config, state, 'CODE_REVIEW', { validation, browserReport });
        const reviewProviderStatus = await probeAntigravity(config, 'review');
        if (reviewProviderStatus.status !== ProviderStatus.AVAILABLE) {
          state.lastError = `Antigravity review niedostępny: ${reviewProviderStatus.reason}`;
          break;
        }
        const reviewResult = await reviewWithAntigravity({
          config,
          cwd: worktreeInfo.worktree,
          prompt: reviewPrompt({ issue, baseBranch: config.git.baseBranch, validation, browserReport }),
          outputPath: path.join(directories.logs, `antigravity-review-${state.attempts.review + 1}.json`),
          logFile: path.join(directories.logs, `antigravity-review-${state.attempts.review + 1}.log`),
        });
        if (reviewResult.status !== ProviderStatus.AVAILABLE) {
          state.lastError = reviewResult.reason ?? reviewResult.status;
          break;
        }
        state.codexReview = reviewResult.report;
        state.attempts.review += 1;
        if (reviewResult.report.verdict === 'PASS') {
          if (!(await worktreeStatus(worktreeInfo.worktree))) {
            state.lastError = 'Agent nie pozostawił żadnych zmian do zapisania.';
            break;
          }
          await commitIssueWorktree(worktreeInfo.worktree, issue);
          const bodyFile = path.join(directories.logs, 'pull-request.md');
          await writeFile(bodyFile, pullRequestBody(issue, state), 'utf8');
          const pullRequest = config.github.createPullRequest
            ? await createPullRequest(config, {
                branch: worktreeInfo.branch,
                title: issue.title,
                bodyFile,
              })
            : null;
          state = await save(config, state, 'READY_FOR_HUMAN_REVIEW', { pullRequest });
          await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.readyForHumanReview);
          await writeSummary(directories, state);
          return state;
        }
        feedback = reviewFeedback(reviewResult.report);
        await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.reviewFailed);
        if (state.attempts.review >= config.limits.maxReviewAttempts) break;
      }
    }

    state.attempts.fix += 1;
    if (state.attempts.fix > config.limits.maxFixAttempts) break;
    state = await save(config, state, 'FIXING', { lastFeedback: feedback });
    const fix = await runImplementation({
      config,
      provider: state.implementationProvider,
      issue,
      worktree: worktreeInfo.worktree,
      directories,
      feedback,
      attempt: state.attempts.fix,
    });
    if (fix.status !== ProviderStatus.AVAILABLE) {
      state.lastError = fix.reason ?? fix.status;
      break;
    }
    state.implementationReport = fix.report;
  }

  state = await save(config, state, 'BLOCKED', { lastError: state.lastError ?? 'Przekroczono limit prób.' });
  await safeLifecycle(config, issue.number, config.issue.lifecycleLabels.blocked);
  await writeSummary(directories, state);
  return state;
}

/** Pokazuje plan bez tworzenia branchy, uruchamiania serwera lub zużywania AI quota. */
export async function dryRun(config) {
  const [issues, antigravity, codex] = await Promise.all([
    listEligibleIssues(config),
    probeAntigravity(config),
    probeCodex(config),
  ]);
  const issue = issues[0] ?? null;
  const quality = issue ? assessIssueQuality(issue) : null;
  return {
    issue: issue ? { number: issue.number, title: issue.title } : null,
    branch: issue ? (await import('./git-worktree.mjs')).issueBranch(config, issue) : null,
    worktree: issue ? path.join(config.paths.worktrees, `issue-${issue.number}`) : null,
    implementationProvider:
      antigravity.status === ProviderStatus.AVAILABLE
        ? 'antigravity'
        : codex.status === ProviderStatus.AVAILABLE
          ? 'codex'
          : null,
    providerStatuses: [antigravity, codex],
    browserVerificationRequired: quality?.browserVerificationRequired ?? false,
    developmentServer: {
      command: config.game.serverCommand,
      args: config.game.serverArgs,
      url: config.game.readyUrl,
    },
    validationCommands: config.validation.commands,
    reviewer: 'fresh subscription-authenticated Codex',
    limits: config.limits,
    costMode: 'SUBSCRIPTION_ONLY',
    paidAiApis: 'DISABLED',
    detectedPaidAiVariables: detectPaidAiEnvironment(),
  };
}

/** Wznawia zapisane Issue albo pobiera pierwsze jawnie oznaczone ai-ready. */
export async function selectIssueForRun(config, continueExisting = false) {
  const state = await readState(config.paths.state);
  if (continueExisting && state.issue?.number && !['IDLE', 'READY_FOR_HUMAN_REVIEW'].includes(state.phase)) {
    return { issue: await getIssue(config, state.issue.number), state };
  }
  const issues = await listEligibleIssues(config);
  return { issue: issues[0] ?? null, state: null };
}

export { readState } from './state-store.mjs';
export { ensureLifecycleLabels };
