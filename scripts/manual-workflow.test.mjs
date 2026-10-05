import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const scripts = JSON.parse(read('package.json')).scripts;

test('manual workflow exposes validation but no automatic agent entrypoints', () => {
  assert.equal(
    Object.keys(scripts).some((key) => key.startsWith('ai:')),
    false,
  );
  assert.equal(scripts['test:ai'], undefined);
  for (const name of ['ci:code', 'ci:assets', 'build', 'test:tools', 'test:unit']) {
    assert.equal(typeof scripts[name], 'string', name);
  }
  assert.match(scripts['ci:code'], /test:tools/);
  assert.match(scripts['ci:code'], /test:unit/);
  assert.equal(JSON.stringify(scripts).includes('.ai/'), false);
  assert.equal(existsSync(new URL('.ai/orchestrator/cli.mjs', root)), false);
  assert.equal(existsSync(new URL('.ai/pipeline.config.json', root)), false);
});

test('editor tasks reference existing manual commands and retain ordinary CI', () => {
  const tasks = JSON.parse(read('.vscode/tasks.json')).tasks;
  for (const task of tasks) {
    assert.equal(task.type, 'npm');
    assert.equal(typeof scripts[task.script], 'string', task.label);
    assert.equal(task.script.startsWith('ai:'), false);
  }
  const ci = read('.github/workflows/asset-validation.yml');
  for (const command of ['ci:code', 'ci:assets', 'build']) {
    assert.ok(ci.includes('npm run ' + command));
  }
  assert.ok(read('.gitignore').includes('.ai/worktrees/'));
});
