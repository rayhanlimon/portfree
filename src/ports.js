/** Cross-platform port inspection: parse `ss`/`lsof`/`netstat` output (Linux/macOS).
 * Windows: best-effort via netstat. Pure parsing — easy to unit test. */
import { execFile } from 'node:child_process';

export function parseSsLines(text) {
  // ss -ltnp output: Netid State Recv-Q Send-Q Local:Port Peer ... Process
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^state\s/i.test(trimmed) || /^netid\s/i.test(trimmed)) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length < 5) continue;
    // ss columns: Netid State Recv-Q Send-Q Local:Port Peer... — local is index 4;
    // tolerate fixtures without Netid (LISTEN-first lines) via index 3 fallback
    let local = parts.length >= 6 ? parts[4] : parts[3];
    if (!/:[0-9]+$/.test(local)) {
      const cand = parts.find((p) => /:[0-9]+$/.test(p));
      if (!cand) continue;
      local = cand;
    }
    const port = Number(local.slice(local.lastIndexOf(':') + 1).replace(/[^0-9]/g, ''));
    if (!port) continue;
    const procs = [];
    const re = /"([^"]+)"(?:,pid=(\d+))?/g;
    let pm;
    while ((pm = re.exec(line))) procs.push({ name: pm[1], pid: pm[2] ? Number(pm[2]) : null });
    out.push({ port, procs, raw: line.trim() });
  }
  return out;
}

export function parseLsofLines(text) {
  // lsof -iTCP -sTCP:LISTEN -P -n output
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;
    const [name, pid, , , , , , , addr] = parts;
    const m = /:(\d+)(\s|\(|$)/.exec(addr);
    if (!m) continue;
    out.push({ port: Number(m[1]), procs: [{ name, pid: Number(pid) || null }], raw: line });
  }
  return out;
}

export function mergeEntries(lists) {
  const map = new Map();
  for (const e of lists.flat()) {
    let cur = map.get(e.port);
    if (!cur) { cur = { port: e.port, procs: [] }; map.set(e.port, cur); }
    for (const p of e.procs) {
      if (!cur.procs.some(q => q.pid === p.pid && q.name === p.name)) cur.procs.push(p);
    }
  }
  return [...map.values()].sort((a, b) => a.port - b.port);
}

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve(null);
      resolve(String(stdout));
    });
  });
}

/** List listening ports using the first available tool. */
export async function listListening() {
  const ss = await run('ss', ['-ltnp']);
  if (ss) return mergeEntries([parseSsLines(ss)]);
  const lsof = await run('lsof', ['-iTCP', '-sTCP:LISTEN', '-P', '-n']);
  if (lsof) return mergeEntries([parseLsofLines(lsof)]);
  const netstat = await run('netstat', process.platform === 'win32' ? ['-ano'] : ['-ltnp']);
  if (netstat) return mergeEntries([parseSsLines(netstat)]);
  throw new Error('No inspection tool found (tried ss, lsof, netstat).');
}

export function findFreePort(used, { from = 1024, to = 65535 } = {}) {
  const busy = new Set(used.map(e => e.port));
  for (let p = from; p <= to; p++) if (!busy.has(p)) return p;
  return null;
}
