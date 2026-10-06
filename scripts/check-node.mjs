// AgentPal stores data with Node's built-in SQLite, which needs Node 22.13+.
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
