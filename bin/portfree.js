#!/usr/bin/env node
/** portfree CLI — zero dependencies. list / check / free-a-port / kill holder. */
import { execFile } from 'node:child_process';
import net from 'node:net';
import { listListening, findFreePort } from '../src/ports.js';

const VERSION = '0.1.0';

function help() {
  console.log([
    'portfree ' + VERSION + ' — answer "port already in use?" in one command',
    '',
    'Usage:',
    '  portfree list [--json]                 list listening ports + owning processes',
    '  portfree check <port>                  exit 0 if free, 1 if busy (prints holder)',
    '  portfree free [--from 3000]            print the first free port >= --from',
    '  portfree kill <port> [--signal SIGTERM]  kill the process holding <port>',
    '',
    'Options: --json (list), --from N (free), --signal S (kill).',
    'Exit codes: 0 ok/free/killed, 1 busy or kill failed, 2 usage error.',
  ].join('\n'));
}

function fail(msg) { console.error('portfree: ' + msg); process.exit(2); }

function canBind(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '0.0.0.0', () => s.close(() => resolve(true)));
  });
}

function killPid(pid, signal) {
  return new Promise((resolve) => {
    execFile('kill', ['-' + signal.replace(/^SIG/, ''), String(pid)], (err) => resolve(!err));
  });
}

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '--help' || cmd === '-h') { help(); process.exit(0); }
if (cmd === '--version' || cmd === '-v') { console.log(VERSION); process.exit(0); }

if (cmd === 'list') {
  const json = rest.includes('--json');
  const rows = await listListening().catch(e => fail(e.message));
  if (json) console.log(JSON.stringify(rows, null, 2));
  else if (!rows.length) console.log('portfree: nothing listening.');
  else for (const r of rows) {
    const who = r.procs.map(p => p.pid ? `${p.name} (pid ${p.pid})` : p.name).join(', ') || 'unknown';
    console.log(`${String(r.port).padStart(5)}  ${who}`);
  }
} else if (cmd === 'check') {
  const port = Number(rest[0]);
  if (!port) fail('check needs a port number');
  const free = await canBind(port);
  if (free) { console.log(`portfree: ${port} is FREE`); }
  else {
    console.log(`portfree: ${port} is BUSY`);
    try {
      const rows = await listListening();
      const hit = rows.find(r => r.port === port);
      if (hit) console.log(`  holder: ${hit.procs.map(p => p.pid ? `${p.name} (pid ${p.pid})` : p.name).join(', ')}`);
    } catch {}
    process.exit(1);
  }
} else if (cmd === 'free') {
  let from = 3000;
  const i = rest.indexOf('--from');
  if (i !== -1) from = Number(rest[i + 1]) || fail('--from needs a number');
  let rows = [];
  try { rows = await listListening(); } catch {}
  const busy = new Set(rows.map(r => r.port));
  for (let p = from; p <= 65535; p++) {
    if (busy.has(p)) continue;
    if (await canBind(p)) { console.log(p); break; }
  }
} else if (cmd === 'kill') {
  const port = Number(rest[0]);
  if (!port) fail('kill needs a port number');
  let signal = 'SIGTERM';
  const i = rest.indexOf('--signal');
  if (i !== -1) signal = String(rest[i + 1] || 'SIGTERM').toUpperCase().replace(/^(?!SIG)/, 'SIG');
  const rows = await listListening().catch(e => fail(e.message));
  const hit = rows.find(r => r.port === port);
  const pids = (hit ? hit.procs : []).map(p => p.pid).filter(Boolean);
  if (!pids.length) fail(`no known pid holds port ${port}`);
  let ok = true;
  for (const pid of pids) {
    const done = await killPid(pid, signal);
    console.log(done ? `portfree: killed pid ${pid} (${signal})` : `portfree: failed to kill pid ${pid}`);
    ok = ok && done;
  }
  process.exit(ok ? 0 : 1);
} else fail(`Unknown command: ${cmd}`);
