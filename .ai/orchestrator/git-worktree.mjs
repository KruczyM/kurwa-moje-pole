import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { runProcess } from './process-runner.mjs';

/** Tworzy bezpieczny fragment nazwy brancha wyłącznie z numeru i tytułu Issue. */
export function issueBranch(config, issue) {
  const slug =
    issue.title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'issue';
  return `${config.git.branchPrefix}${issue.number}-${slug}`;
}

/** Przygotowuje osobny branch i worktree, nigdy nie przełączając ani nie resetując main. */
export async function prepareIssueWorktree(config, issue) {
  await mkdir(config.paths.worktrees, { recursive: true });
  const branch = issueBranch(config, issue);
  const worktree = path.join(config.paths.worktrees, `issue-${issue.number}`);
  const list = await runProcess({
    command: 'git',
    args: ['worktree', 'list', '--porcelain'],
    cwd: config.paths.root,
  });
  if (
    list.stdout.includes(`worktree ${worktree.replaceAll('\\', '/')}`) ||
    list.stdout.includes(`worktree ${worktree}`)
  ) {
    return { branch, worktree, reused: true };
  }
  const branchProbe = await runProcess({
    command: 'git',
    args: ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
    cwd: config.paths.root,
    allowFailure: true,
  });
  const args =
    branchProbe.exitCode === 0
      ? ['worktree', 'add', worktree, branch]
      : ['worktree', 'add', '-b', branch, worktree, config.git.baseBranch];
  await runProcess({ command: 'git', args, cwd: config.paths.root, timeoutMs: 120000 });
  return { branch, worktree, reused: false };
}

/** Zwraca stan zmian worktree bez ich modyfikowania. */
export async function worktreeStatus(worktree) {
  const result = await runProcess({ command: 'git', args: ['status', '--porcelain'], cwd: worktree });
  return result.stdout.trim();
}

/** Odczytuje pełny diff brancha Issue, łącznie z niezapisanymi zmianami, bez udziału agenta AI. */
export async function worktreeDiff(worktree, baseBranch) {
  const result = await runProcess({
    command: 'git',
    args: ['diff', baseBranch],
    cwd: worktree,
    timeoutMs: 120000,
  });
  return result.stdout;
}

/** Zapisuje zweryfikowane zmiany w branchu Issue; nie wykonuje push ani merge. */
export async function commitIssueWorktree(worktree, issue) {
  await runProcess({ command: 'git', args: ['add', '--all'], cwd: worktree });
  const title = issue.title.replace(/[\r\n]+/g, ' ').slice(0, 72);
  await runProcess({
    command: 'git',
    args: ['commit', '-m', `feat: ${title} (#${issue.number})`],
    cwd: worktree,
    timeoutMs: 120000,
  });
}
