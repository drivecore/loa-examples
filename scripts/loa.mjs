import { spawnSync } from "node:child_process";

// Always exercise production, regardless of a developer's global CLI host.
const cli = new URL("../node_modules/@landofassets/cli/dist/bin/loa.js", import.meta.url);
const result = spawnSync(process.execPath, [cli.pathname, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, LOA_HOST: "https://api.landofassets.com" },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
