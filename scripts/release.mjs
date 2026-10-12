import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const run = (...args) => execFileSync('git', args, { stdio: 'inherit' });

const fail = (text) => {
  console.error(text);
  process.exit(1);
};

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const message = args.find((arg) => !arg.startsWith('--'));
const dryRun = flags.has('--dry-run');
const level = flags.has('--major') ? 'major' : flags.has('--minor') ? 'minor' : 'patch';

const dirty = git('status', '--porcelain') !== '';

if (dirty && !message) {
  fail('Usage: npm run release -- "type: message" [--minor | --major] [--dry-run]');
}

if (message && !/^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)!?: \S.*$/.test(message)) {
  fail('Commit message must follow Conventional Commits without a scope, for example "feat: add lesson search"');
}

if (!dryRun) run('fetch', '--tags');

const tags = git('tag', '--list', 'v*', '--sort=-v:refname')
  .split('\n')
  .filter((name) => /^v\d+\.\d+\.\d+$/.test(name));

if (!dirty && git('tag', '--list', 'v*', '--points-at', 'HEAD') !== '') fail('HEAD is already released, nothing new to ship');

const base = tags.length > 0 ? tags[0].slice(1) : JSON.parse(readFileSync('package.json', 'utf8')).version;
const [major, minor, patch] = base.split('.').map(Number);

let next = `${major}.${minor}.${patch + 1}`;
if (level === 'minor') next = `${major}.${minor + 1}.0`;
if (level === 'major') next = `${major + 1}.0.0`;
if (tags.length === 0 && level === 'patch') next = base;

const tag = `v${next}`;

console.log(dirty ? `commit: ${message}` : 'commit: nothing to commit, releasing HEAD');
console.log(`tag: ${tag} (${tags.length > 0 ? `from ${tags[0]}, ${level}` : 'first release'})`);

if (dryRun) process.exit(0);

if (dirty) {
  run('add', '-A');
  run('commit', '-m', message);
}
run('push', 'origin', 'HEAD');
run('tag', '-a', tag, '-m', tag);
run('push', 'origin', tag);
