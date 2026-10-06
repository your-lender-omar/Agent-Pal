// Stops AgentPal: any `next dev` / `next start` for this project, plus whatever is holding the port
// (e.g. a frozen copy). Asks nicely first, then forces it. Linux / Codespaces.
import fs from "node:fs";
import net from "node:net";

const here = process.cwd();
const port = Number(process.env.PORT) || 3000;
const skip = new Set([process.pid, process.ppid]);
const pids = () => (fs.existsSync("/proc") ? fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d)).map(Number) : []);

/** Socket inodes listening on `port`, from /proc/net/tcp{,6}. */
function listeningInodes() {
  const inodes = new Set();
  for (const file of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n").slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 10) continue;
      const localPort = parseInt(cols[1].split(":").pop(), 16);
      if (localPort === port && cols[3] === "0A") inodes.add(cols[9]); // 0A = LISTEN
    }
  }
  return inodes;
}

function targets() {
  const inodes = listeningInodes();
  const found = new Set();
  for (const pid of pids()) {
    if (skip.has(pid)) continue;
    try {
      const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
      if (cwd.startsWith(here) && (/next(\.js)? (dev|start)/.test(cmd) || cmd.startsWith("next-server"))) found.add(pid);
      else if (inodes.size) {
        for (const fd of fs.readdirSync(`/proc/${pid}/fd`)) {
          const link = fs.readlinkSync(`/proc/${pid}/fd/${fd}`);
          const m = link.match(/^socket:\[(\d+)\]$/);
          if (m && inodes.has(m[1])) {
            found.add(pid);
            break;
          }
        }
      }
    } catch {
      // Process gone, or not readable by us.
    }
  }
  return [...found];
}

const portFree = () =>
  new Promise((resolve) => {
    const srv = net.createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const first = targets();
for (const pid of first) try { process.kill(pid, "SIGTERM"); } catch {}
for (let i = 0; i < 20 && !(await portFree()); i++) await sleep(250);
// Anything still alive (frozen) gets force-stopped.
for (const pid of targets()) try { process.kill(pid, "SIGKILL"); } catch {}
for (let i = 0; i < 20 && !(await portFree()); i++) await sleep(250);

if (!(await portFree())) {
  console.error(`Port ${port} is still busy. Close the Codespace tab, reopen it, and try again.`);
  process.exit(1);
}
console.log(first.length ? "Stopped the running app." : "The app wasn't running.");
