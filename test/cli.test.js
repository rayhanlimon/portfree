import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import net from 'node:net';

function run(bin, args) {
  return new Promise((resolve) => {
    execFile(process.execPath, [bin, ...args], { timeout: 10000 }, (err, stdout, stderr) => {
      resolve({ code: err && err.code != null ? err.code : 0, out: String(stdout), errText: String(stderr) });
    });
  });
}
const BIN = new URL('../bin/portfree.js', import.meta.url).pathname;

test('check reports FREE on unused port', async () => {
  const r = await run(BIN, ['check', '54321']);
  assert.equal(r.code, 0);
  assert.match(r.out, /FREE/);
});

test('check reports BUSY on bound port', async () => {
  const srv = net.createServer();
  await new Promise((res) => srv.listen(54322, '127.0.0.1', res));
  try {
    const r = await run(BIN, ['check', '54322']);
    assert.equal(r.code, 1);
    assert.match(r.out, /BUSY/);
  } finally { srv.close(); }
});

test('free prints a bindable port >= from', async () => {
  const r = await run(BIN, ['free', '--from', '54330']);
  assert.equal(r.code, 0);
  const p = Number(r.out.trim());
  assert.ok(p >= 54330 && p <= 65535);
});

test('list --json is valid JSON array', async () => {
  const r = await run(BIN, ['list', '--json']);
  assert.equal(r.code, 0);
  assert.ok(Array.isArray(JSON.parse(r.out)));
});

test('usage errors exit 2', async () => {
  const r1 = await run(BIN, ['bogus']);
  assert.equal(r1.code, 2);
  const r2 = await run(BIN, ['check']);
  assert.equal(r2.code, 2);
});

test('--help and --version', async () => {
  const h = await run(BIN, ['--help']);
  assert.equal(h.code, 0);
  assert.match(h.out, /portfree/);
  const v = await run(BIN, ['--version']);
  assert.match(v.out.trim(), /^\d+\.\d+\.\d+$/);
});
