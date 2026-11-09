import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const suite = JSON.parse(readFileSync(fileURLToPath(new URL('./review-coverage-cases.json', import.meta.url)), 'utf8'));
const scratchPrefix = fileURLToPath(new URL('./.review-coverage-', import.meta.url));

function git(cwd, ...args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

function safePath(path) {
  assert.match(path, /^(?!\/|[A-Za-z]:)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]+$/);
  return path;
}

function write(root, path, value) {
  const target = join(root, safePath(path));
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value, 'utf8');
}

function build(caseData, root) {
  git(root, 'init', '-q');
  for (const [path, value] of Object.entries(caseData.seed)) write(root, path, value);
  for (const step of caseData.setup) {
    switch (step.op) {
      case 'commit-base':
        git(root, 'add', '--all');
        git(root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'base');
        break;
      case 'delete-index':
        git(root, 'rm', '-q', '--', safePath(step.path));
        break;
      case 'write':
        write(root, step.path, step.text);
        break;
      case 'rename':
        git(root, 'mv', '--', safePath(step.from), safePath(step.to));
        break;
      case 'configure-external-diff': {
        const helper = join(root, '.git', 'eval-diff-helper.cjs');
        writeFileSync(helper, "console.log('EVAL_EXTERNAL_DIFF_RAN');\n", 'utf8');
        const command = `"${process.execPath.replaceAll('\\', '/')}" "${helper.replaceAll('\\', '/')}"`;
        git(root, 'config', '--local', 'diff.external', command);
        break;
      }
      case 'configure-textconv': {
        const helper = join(root, '.git', 'eval-textconv-helper.cjs');
        writeFileSync(helper, "console.log('EVAL_TEXTCONV_RAN ' + process.argv.at(-1));\n", 'utf8');
        const command = `"${process.execPath.replaceAll('\\', '/')}" "${helper.replaceAll('\\', '/')}"`;
        git(root, 'config', '--local', 'diff.eval.textconv', command);
        break;
      }
      default:
        assert.fail(`Unknown setup operation: ${step.op}`);
    }
  }
}

test('review suite is independent and keeps private oracle out of model input', () => {
  assert.equal(suite.version, 1);
  assert.equal(suite.cases.length, 4);
  assert.equal(new Set(suite.cases.map((item) => item.id)).size, 4);
  for (const item of suite.cases) {
    assert.equal(typeof item.input, 'string');
    assert.ok(item.input.length > 30);
    assert.ok(!/canDelete|admin|Boolean\(user\)|bypass/i.test(item.input));
    assert.deepEqual(Object.keys(item.oracle).sort(), ['evidence', 'mustDo', 'mustNot']);
    for (const entries of Object.values(item.oracle)) assert.ok(entries.length > 0);
    assert.equal(item.setup[0].op, 'commit-base');
  }
});

for (const item of suite.cases) {
  test(`${item.id} reconstructs the intended Git worktree`, () => {
    const root = mkdtempSync(scratchPrefix);
    try {
      build(item, root);
      const status = git(root, 'status', '--porcelain=v1', '--untracked-files=all');
      if (item.id === 'review-staged-delete-recreated-path') {
        assert.match(status, /^D  src\/access\.js$/m);
        assert.match(status, /^\?\? src\/access\.js$/m);
        assert.match(git(root, 'show', 'HEAD:src/access.js'), /role === 'admin'/);
        assert.match(readFileSync(join(root, 'src/access.js'), 'utf8'), /Boolean\(user\)/);
      } else if (item.id === 'review-safe-modification-rename-and-untracked-note') {
        assert.match(status, /^ M src\/access\.js$/m);
        assert.match(status, /^R  docs\/access\.md -> docs\/permissions\.md$/m);
        assert.match(status, /^\?\? notes\/review-context\.md$/m);
        assert.match(git(root, 'show', 'HEAD:src/access.js'), /role === 'admin'/);
        assert.match(readFileSync(join(root, 'src/access.js'), 'utf8'), /role === 'admin'/);
      } else if (item.id === 'review-external-diff-raw-patch') {
        assert.match(status, /^ M src\/access\.js$/m);
        assert.equal(git(root, 'diff', '--', 'src/access.js').trim(), 'EVAL_EXTERNAL_DIFF_RAN');
        const raw = git(root, '--no-pager', 'diff', '--no-ext-diff', '--no-textconv', '--', 'src/access.js');
        assert.match(raw, /^-  return user\?\.role === 'admin';$/m);
        assert.match(raw, /^\+  return Boolean\(user\);$/m);
        assert.doesNotMatch(raw, /EVAL_EXTERNAL_DIFF_RAN/);
      } else {
        assert.match(status, /^ M src\/access\.js$/m);
        const converted = git(root, '--no-pager', 'diff', '--no-ext-diff', '--', 'src/access.js');
        assert.match(converted, /^-EVAL_TEXTCONV_RAN .+$/m);
        assert.match(converted, /^\+EVAL_TEXTCONV_RAN .+$/m);
        assert.doesNotMatch(converted, /return user\?\.role|return Boolean\(user\)/);
        const raw = git(root, '--no-pager', 'diff', '--no-ext-diff', '--no-textconv', '--', 'src/access.js');
        assert.match(raw, /^-  return user\?\.role === 'admin';$/m);
        assert.match(raw, /^\+  return Boolean\(user\);$/m);
        assert.doesNotMatch(raw, /EVAL_TEXTCONV_RAN/);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
