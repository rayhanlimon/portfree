import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSsLines, parseLsofLines, mergeEntries, findFreePort } from '../src/ports.js';

test('parse ss output with pid', () => {
  const ss = 'State Recv-Q Send-Q Local Address:Port Peer\n' +
    'LISTEN 0 128 0.0.0.0:3000 0.0.0.0:* users:("node",pid=123,fd=1)\n' +
    'LISTEN 0 128 [::]:8080 [::]:* users:("nginx",pid=45,fd=2)\n';
  const out = parseSsLines(ss);
  assert.equal(out.length, 2);
  assert.equal(out[0].port, 3000);
  assert.equal(out[0].procs[0].name, 'node');
  assert.equal(out[0].procs[0].pid, 123);
  assert.equal(out[1].port, 8080);
});

test('parse ss skips header/garbage', () => {
  assert.deepEqual(parseSsLines('garbage\n\n'), []);
});

test('parse lsof output', () => {
  const lsof = 'COMMAND PID USER FD TYPE DEVICE SIZE NODE NAME\n' +
    'node 123 u 1 IPv4 1 0 TCP *:3000 (LISTEN)\n' +
    'nginx 45 u 2 IPv6 1 0 TCP [::1]:8080 (LISTEN)\n';
  const out = parseLsofLines(lsof);
  assert.equal(out.length, 2);
  assert.equal(out[0].port, 3000);
  assert.equal(out[0].procs[0].pid, 123);
});

test('merge dedupes same port+pid', () => {
  const m = mergeEntries([
    [{ port: 3000, procs: [{ name: 'node', pid: 1 }] }],
    [{ port: 3000, procs: [{ name: 'node', pid: 1 }, { name: 'x', pid: 2 }] }, { port: 80, procs: [] }],
  ]);
  assert.equal(m.length, 2);
  assert.equal(m[0].port, 80);
  assert.equal(m[1].procs.length, 2);
});

test('findFreePort skips busy', () => {
  assert.equal(findFreePort([{ port: 3000 }, { port: 3001 }], { from: 3000 }), 3002);
  assert.equal(findFreePort([], { from: 8080, to: 8080 }), 8080);
  assert.equal(findFreePort([{ port: 9 }], { from: 9, to: 9 }), null);
});
