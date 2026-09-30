// Builds everything the Electron app packages:
//   1. Next standalone server  → .next/standalone  (+ static assets + public/)
//   2. Electron main + preload → dist-electron/     (bundled with bun, electron external)
// electron-builder.yml then ships dist-electron in app.asar and the standalone
// tree as extraResources/server (it runs in a utilityProcess, outside the asar).
import { execSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const run = (cmd, env = {}) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ...env } });
const root = process.cwd();
const isOfficial = process.env.CARDNEWS_OFFICIAL === "1";

// An official build with no Lemon Squeezy variant ids would skip the product
// check (any seller's key would unlock it) — refuse instead.
if (isOfficial) {
  const lic = readFileSync(join(root, "electron", "license.ts"), "utf8");
  const block = lic.slice(lic.indexOf("LS_VARIANTS"), lic.indexOf("};", lic.indexOf("LS_VARIANTS")));
  if (!/^\s*"\d+":\s*"(byo|plus)"/m.test(block)) {
    console.error("✗ CARDNEWS_OFFICIAL=1 but electron/license.ts LS_VARIANTS is empty. Add the Lemon Squeezy variant ids first.");
    process.exit(1);
  }
}
const standalone = join(root, ".next", "standalone");

rmSync(standalone, { recursive: true, force: true });
run("bun run build", { CARDNEWS_STANDALONE: "1" });

// Standalone output leaves static assets and public/ to the deployer.
cpSync(join(root, ".next", "static"), join(standalone, ".next", "static"), { recursive: true });
cpSync(join(root, "public"), join(standalone, "public"), {
  recursive: true,
  // public/uploads is the dev machine's user content — never ship it.
  filter: (src) => !src.startsWith(join(root, "public", "uploads")),
});
// Traced by the build but never needed at runtime (and personal on a dev machine).
for (const p of ["data", ".env.local", ".env", "public/uploads", ".vercel", ".gstack", ".omniscitus"]) {
  const t = join(standalone, p);
  if (existsSync(t)) rmSync(t, { recursive: true, force: true });
}

rmSync(join(root, "dist-electron"), { recursive: true, force: true });
const official = isOfficial ? "1" : "0";
for (const entry of ["main", "preload"]) {
  run(
    `bun build ./electron/${entry}.ts --target=node --format=cjs --external=electron ` +
      `'--define=process.env.CARDNEWS_OFFICIAL_BUILD="${official}"' --outfile dist-electron/${entry}.cjs`,
  );
}
console.log(`\n✓ desktop build ready (official=${official})`);
