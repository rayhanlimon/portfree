# portfree

Zero-dependency answer to **"port already in use?"** — list listening ports, check one, find a free one, or kill its holder.

Ever seen `EADDRINUSE: address already in use :::3000` and then played guessing games with `lsof | grep | kill`? `portfree` does it in one command, on Linux and macOS, with no dependencies.

## What it does

- `list` — all listening TCP ports with owning process names + pids (via `ss`, `lsof` or `netstat`)
- `check <port>` — exit 0 if bindable, 1 if busy (and names the holder)
- `free [--from N]` — first actually-bindable port (verified with a real bind, not just a table lookup)
- `kill <port> [--signal SIGTERM]` — kill the holding process (safe default signal)
- `--json` output for scripts

## Install

Requires Node 18+. No dependencies.

```sh
npm install -g portfree
# or from source:
git clone https://github.com/rayhanlimon/portfree && cd portfree
node bin/portfree.js --help
```

## Usage

```sh
# who is on 3000?
portfree check 3000
# portfree: 3000 is BUSY
#   holder: node (pid 123)

# grab a free port for your dev server
PORT=$(portfree free --from 3000) && npm run dev -- --port $PORT

# kill whatever holds 3000 (SIGTERM by default)
portfree kill 3000

# scripting
portfree list --json | jq .
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | ok / free / killed |
| 1 | busy / kill failed |
| 2 | usage error |

## Security notes

- Read-only commands (`list`, `check`, `free`) never modify anything.
- `kill` targets only the pid(s) reported holding that port, defaults to SIGTERM; double-check before `--signal SIGKILL`.
- No network access, no telemetry.

## Limitations

- Linux/macOS first: uses `ss`, `lsof` or `netstat`. Windows works best-effort via `netstat`.
- Shows TCP listeners only (no UDP).
- `free` verifies by binding `0.0.0.0` — a port free there can still be blocked by firewall rules.

## Roadmap

- [ ] UDP listener support
- [ ] `--watch` live refresh mode
- [ ] Windows-native (non-netstat) holder lookup

## Development

```sh
npm test   # node --test test/*.test.js (11 tests, zero deps)
```

## License

MIT — see [LICENSE](LICENSE).
