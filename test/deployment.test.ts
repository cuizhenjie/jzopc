import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync, symlinkSync, readlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const repo = resolve(import.meta.dirname, '..');
function write(path: string, content: string) { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, content); }

test('standalone assembly excludes environment files at every copied source and preserves relative links', () => {
  const root = mkdtempSync(join(tmpdir(), 'jizhi-assembly-'));
  try {
    cpSync(join(repo, 'scripts/prepare-deploy.mjs'), join(root, 'scripts/prepare-deploy.mjs'), { recursive: true });
    const stand = join(root, '.next-check/standalone');
    for (const [file, content] of Object.entries({
      'server.js': '// fixture', 'src/app/api/og/fonts/NotoSansSC-Regular.otf': 'font', '.env': 'SECRET',
      'nested/.env.local': 'SECRET', 'node_modules/pkg/index.js': '// package',
    })) write(join(stand, file), content);
    symlinkSync('./pkg', join(stand, 'node_modules/pkg-alias'));
    write(join(root, '.next-check/static/app.js'), '// static');
    write(join(root, '.next-check/static/.env.production'), 'SECRET');
    write(join(root, 'public/logo.svg'), '<svg/>');
    write(join(root, 'public/nested/.env'), 'SECRET');
    const result = spawnSync(process.execPath, [join(root, 'scripts/prepare-deploy.mjs')], { env: { ...process.env, NEXT_DIST_DIR: '.next-check' }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const path of ['.env', 'nested/.env.local', '.next-check/static/.env.production', 'public/nested/.env']) assert.equal(existsSync(join(root, 'deploy', path)), false);
    assert.equal(readlinkSync(join(root, 'deploy/node_modules/pkg-alias')), './pkg');
    assert.ok(existsSync(join(root, 'deploy/.next-check/static/app.js')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('release fixtures: reject traversal, architecture mismatch and duplicate IDs; restore prior release on HTTP failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'jizhi-release-'));
  const app = join(root, 'app');
  const bin = join(root, 'bin');
  mkdirSync(bin);
  const scripts: Record<string, string> = {
    uname: 'echo Linux', flock: 'exit 0', systemctl: 'exit 0', sleep: 'exit 0',
    curl: 'case "$(readlink "$MOCK_APP/current")" in */bad) printf 500;; *) case "$*" in */api/leads) printf 405;; *) printf 200;; esac;; esac',
  };
  for (const [name, body] of Object.entries(scripts)) writeFileSync(join(bin, name), '#!/bin/sh\n' + body + '\n', { mode: 0o755 });
  function archive(id: string, arch: string = process.arch, traversal = false, links = 'normal') {
    const path = join(root, id + '.tar.gz');
    const made = spawnSync('python3', ['-c', `import io,json,tarfile,sys
p,release,arch,traversal,links=sys.argv[1:]
with tarfile.open(p,'w:gz') as t:
 for name,value in {'server.js':'// fixture','.next/static/app.js':'// static','public/logo.svg':'svg','RELEASE-METADATA.json':json.dumps({'platform':'linux','arch':arch,'releaseId':release})}.items():
  data=value.encode(); i=tarfile.TarInfo(name); i.size=len(data); t.addfile(i,io.BytesIO(data))
 for name,target in ({'pivot':'.','escape-link':'pivot/../previous/server.js'} if links=='escape' else {'cycle-a':'cycle-b','cycle-b':'cycle-a'} if links=='cycle' else {'server-alias.js':'server.js'}).items():
  i=tarfile.TarInfo(name); i.type=tarfile.SYMTYPE; i.linkname=target; t.addfile(i)
 if traversal=='yes':
  data=b'escape'; i=tarfile.TarInfo('../escaped'); i.size=len(data); t.addfile(i,io.BytesIO(data))
`, path, id, arch, traversal ? 'yes' : 'no', links], { encoding: 'utf8' });
    assert.equal(made.status, 0, made.stderr);
    writeFileSync(path + '.sha256', `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${id}.tar.gz\n`);
    return path;
  }
  function run(path: string, id: string) {
    return spawnSync('bash', [join(repo, 'scripts/deploy-release.sh'), path, id, app], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, SUDO: '', APP_USER: 'jizhi_fixture_no_user', MOCK_APP: app, HEALTH_ATTEMPTS: '1', HEALTH_INTERVAL: '0' } });
  }
  try {
    const good = archive('good');
    assert.notEqual(run(good, '../outside').status, 0);
    assert.notEqual(run(archive('wrong', 'unsupported'), 'wrong').status, 0);
    assert.notEqual(run(archive('escape', process.arch, true), 'escape').status, 0);
    assert.equal(existsSync(join(root, 'escaped')), false);
    for (const mode of ['escape', 'cycle']) {
      const id = `links-${mode}`;
      const rejected = run(archive(id, process.arch, false, mode), id);
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, /链接/);
      assert.equal(existsSync(join(app, 'releases', id)), false);
    }
    const mismatch = archive('checksum-wrong-file');
    writeFileSync(mismatch + '.sha256', readFileSync(good + '.sha256'));
    const wrongFile = run(mismatch, 'checksum-wrong-file');
    assert.notEqual(wrongFile.status, 0);
    assert.match(wrongFile.stderr, /文件名必须匹配/);
    const duplicate = archive('checksum-duplicate');
    const record = readFileSync(duplicate + '.sha256', 'utf8');
    writeFileSync(duplicate + '.sha256', record + record);
    assert.notEqual(run(duplicate, 'checksum-duplicate').status, 0);
    const corrupt = archive('checksum-corrupt');
    writeFileSync(corrupt + '.sha256', `${'0'.repeat(64)}  checksum-corrupt.tar.gz\n`);
    assert.notEqual(run(corrupt, 'checksum-corrupt').status, 0);
    const first = run(good, 'good');
    assert.equal(first.status, 0, first.stderr + first.stdout);
    const previous = readlinkSync(join(app, 'current'));
    assert.notEqual(run(good, 'good').status, 0);
    assert.equal(readlinkSync(join(app, 'current')), previous);
    const bad = run(archive('bad'), 'bad');
    assert.notEqual(bad.status, 0);
    assert.equal(readlinkSync(join(app, 'current')), previous);
    assert.match(bad.stdout + bad.stderr, /回滚/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
