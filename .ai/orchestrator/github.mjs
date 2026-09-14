import { runProcess } from './process-runner.mjs';

async function gh(config, args, options = {}) {
  return runProcess({
    command: 'gh',
    args,
    cwd: config.paths.root,
    timeoutMs: 60000,
    allowFailure: options.allowFailure ?? false,
    input: options.input,
    logFile: options.logFile,
  });
}

/** Pobiera tylko otwarte Issue jawnie oznaczone etykietą ai-ready. */
export async function listEligibleIssues(config) {
  const result = await gh(config, [
    'issue',
    'list',
    '--state',
    'open',
    '--label',
    config.issue.readyLabel,
    '--limit',
    '100',
    '--json',
    'number,title,body,labels,url',
  ]);
  return selectEligibleIssueQueue(JSON.parse(result.stdout), config.issue.readyLabel);
}

/** Filtruje i porządkuje fixture/live Issue według jawnej etykiety gotowości. */
export function selectEligibleIssueQueue(issues, readyLabel) {
  return issues
    .filter((issue) => issue.state !== 'CLOSED')
    .filter((issue) => (issue.labels ?? []).some((label) => (label.name ?? label) === readyLabel))
    .sort((a, b) => a.number - b.number);
}

/** Pobiera jedno Issue podczas wznawiania procesu niezależnie od jego aktualnej etykiety. */
export async function getIssue(config, issueNumber) {
  const result = await gh(config, [
    'issue',
    'view',
    String(issueNumber),
    '--json',
    'number,title,body,labels,url,state',
  ]);
  return JSON.parse(result.stdout);
}

/** Zapewnia istnienie etykiet pipeline; nie zmienia treści Issue. */
export async function ensureLifecycleLabels(config) {
  const colors = ['1d76db', 'fbca04', '5319e7', '0052cc', 'd93f0b', 'b60205', '000000', 'e99695', '0e8a16'];
  const labels = Object.values(config.issue.lifecycleLabels);
  for (const [index, label] of labels.entries()) {
    await gh(config, ['label', 'create', label, '--color', colors[index % colors.length], '--force'], {
      allowFailure: false,
    });
  }
}

/** Ustawia dokładnie jeden stan lifecycle i zachowuje wszystkie pozostałe etykiety użytkownika. */
export async function setIssueLifecycle(config, issueNumber, label) {
  for (const candidate of Object.values(config.issue.lifecycleLabels)) {
    if (candidate !== label)
      await gh(config, ['issue', 'edit', String(issueNumber), '--remove-label', candidate], {
        allowFailure: true,
      });
  }
  await gh(config, [
    'issue',
    'edit',
    String(issueNumber),
    '--remove-label',
    config.issue.readyLabel,
    '--add-label',
    label,
  ]);
}

/** Wypycha wyłącznie branch Issue i tworzy PR bez merge. */
export async function createPullRequest(config, { branch, title, bodyFile }) {
  await runProcess({
    command: 'git',
    args: ['push', '-u', 'origin', branch],
    cwd: config.paths.root,
    timeoutMs: 300000,
  });
  const existing = await gh(config, ['pr', 'list', '--head', branch, '--json', 'number,url'], {
    allowFailure: true,
  });
  const parsed = existing.exitCode === 0 ? JSON.parse(existing.stdout) : [];
  if (parsed.length) {
    await gh(config, ['pr', 'edit', String(parsed[0].number), '--body-file', bodyFile]);
    return parsed[0];
  }
  const created = await gh(config, [
    'pr',
    'create',
    '--head',
    branch,
    '--base',
    config.git.baseBranch,
    '--title',
    title,
    '--body-file',
    bodyFile,
  ]);
  return { url: created.stdout.trim() };
}
