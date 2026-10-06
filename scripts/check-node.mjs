// Runs before `npm run dev` / `npm run build`.
import net from "node:net";

// 1. AgentPal stores data with Node's built-in SQLite, which needs Node 22.13+.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`
  AgentPal needs Node.js 22.13 or newer. This machine has ${process.version}.

  In a GitHub Codespace, run these two lines, then start the app again:
      nvm install 22
      nvm use 22
`);
  process.exit(1);
}

// 2. Before `dev`, make sure the app isn't already running. Otherwise Next.js quietly starts a second
//    copy on another port while the browser keeps showing the old one.
if (process.env.npm_lifecycle_event === "predev") {
  const port = Number(process.env.PORT) || 3000;
  const free = await new Promise((resolve) => {
    const srv = net.createServer().once("error", () => resolve(false)).once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port);
  });
  if (!free) {
    console.error(`
  AgentPal is already running on port ${port}.

  To open it:     click the PORTS tab at the bottom, then the globe icon next to ${port}.
  To restart it:  type  npm run restart  and press Enter (do this after git pull or editing .env.local).
`);
    process.exit(1);
  }
}
