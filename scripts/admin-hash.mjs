// Prints the values for src/lib/admin-config.ts, the built-in admin login.
// Usage: npm run admin:hash -- you@example.com "your-password"
// Only one-way hashes are printed, so the file is safe to commit, even in a public repo.
import crypto from "node:crypto";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 8) {
  console.error('Usage: npm run admin:hash -- you@example.com "password-at-least-8-chars"');
  process.exit(1);
}
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
console.log(`  emailSha256: "${crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}",`);
console.log(`  passwordHash: "${salt}:${hash}",`);
