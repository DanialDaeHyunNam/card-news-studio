// electron-builder always drops node_modules from extraResources, so the Next
// standalone server's traced node_modules is copied in here. afterPack runs
// BEFORE code signing, so these files are signed/notarized with the rest.
const { cpSync, existsSync } = require("node:fs");
const { join } = require("node:path");

exports.default = async function afterPack(ctx) {
  const src = join(ctx.packager.projectDir, ".next", "standalone", "node_modules");
  if (!existsSync(src)) throw new Error("afterPack: .next/standalone/node_modules missing — run scripts/build-desktop.mjs first");
  const resources =
    ctx.electronPlatformName === "darwin"
      ? join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : join(ctx.appOutDir, "resources");
  cpSync(src, join(resources, "server", "node_modules"), { recursive: true, dereference: true });
};
