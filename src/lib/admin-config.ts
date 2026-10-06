/**
 * Built-in admin login. Logging in with this email and password creates (or promotes) the admin account.
 * Only one-way hashes are stored, so this file is safe to commit, even in a public repo.
 * To change it: npm run admin:hash -- you@example.com "new-password", paste the output below, commit.
 * Set to null to turn it off. ADMIN_EMAIL / ADMIN_PASSWORD in .env.local still work alongside it.
 */
export const BUILT_IN_ADMIN: { emailSha256: string; passwordHash: string } | null = {
  emailSha256: "6c1f3de6acc05e9e88da22e51ced24f1a197292a06d2aa1dbb21ba8c184a767d",
  passwordHash: "fd0dd6265790a944def901b31b6e707a:4e43547f94e4f8e78251dbb1e7a550a35b03f601f5dea0b6b710fea79bb3ec2d8e81320d064eb6af001e13b94bfe712f5dadb16d5d0f44ba55a621a11d18a3ff",
};
