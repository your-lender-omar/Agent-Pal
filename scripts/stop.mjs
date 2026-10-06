// Stops any running AgentPal dev/production server for this project (Linux / Codespaces).
import fs from "node:fs";
import net from "node:net";

const here = process.cwd();
const skip = new Set([process.pid, process.ppid]);
let stopped = 0;
for (const pid of fs.existsSync("/proc") ? fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d)).map(Number) : []) {
  if (skip.has(pid)) continue;
  try {
    const cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8").replaceAll("\0", " ");
    const cwd = fs.readlinkSync(`/proc/${pid}/cwd`);
    if (cwd.startsWith(here) && (/next(\.js)? (dev|start)/.test(cmd) || cmd.startsWith("next-server"))) {
      process.kill(pid, "SIGTERM");
      stopped++;
    }
  } catch {
    // Process already gone or not ours.
  }
}

// Wait (up to 10s) for the port to free up so the next start gets port 3000.
const port = Number(process.env.PORT) || 3000;
for (let i = 0; i < 40; i++) {
  const free = await new Promise((resolve) => {
    const srv = net.createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
  if (free) break;
  await new Promise((r) => setTimeout(r, 250));
}
console.log(stopped ? "Stopped the running app." : "The app wasn't running.");
