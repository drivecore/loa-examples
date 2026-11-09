import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { build, createServer } from "vite";
import { root } from "../scripts/json.mjs";

const configFile = resolve(root, "examples/vite/vite.config.js");
const readLock = async () => JSON.parse(await readFile(resolve(root, "assets-lock.json"), "utf8"));

for (const mode of ["remote", "local"]) {
  test(`Vite ${mode}: dev virtual module and built output resolve the real pinned asset`, async (t) => {
    const { robot } = (await readLock()).importers["."].assets;
    const viteMode = mode === "local" ? "offline" : "development";
    const server = await createServer({
      configFile,
      mode: viteMode,
      server: { host: "127.0.0.1", port: 0, strictPort: false },
    });
    t.after(() => server.close());
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    const moduleResponse = await fetch(`${base}/@id/__x00__virtual:loa`);
    assert.equal(moduleResponse.status, 200);
    const code = await moduleResponse.text();
    const match = code.match(/export default JSON\.parse\((".*")\);/);
    assert.ok(match, code);
    const resolution = JSON.parse(JSON.parse(match[1]));
    if (mode === "remote") assert.equal(resolution.robot, robot.remoteUrl);
    else {
      const response = await fetch(new URL(resolution.robot, base));
      assert.equal(response.status, 200);
      const hash = createHash("sha256")
        .update(new Uint8Array(await response.arrayBuffer()))
        .digest("base64");
      assert.equal(`sha256-${hash}`, robot.hash);
      assert.match(response.headers.get("content-type"), /gltf-binary/);
    }
    const transformed = await server.transformRequest("/main.js");
    assert.match(transformed.code, /virtual:loa/);
    assert.match(transformed.code, /startScene/);
    const output = await build({ configFile, mode: viteMode, logLevel: "warn" });
    const outputs = (Array.isArray(output) ? output : [output]).flatMap((item) => item.output);
    const scripts = outputs
      .filter((item) => item.type === "chunk")
      .map((item) => item.code)
      .join("\n");
    if (mode === "remote") assert.ok(scripts.includes(robot.remoteUrl));
    else {
      assert.ok(!scripts.includes(robot.remoteUrl));
      const model = outputs.find((item) => item.type === "asset" && item.fileName.endsWith(".glb"));
      assert.ok(model, "local build must emit GLB");
      assert.equal(
        `sha256-${createHash("sha256").update(model.source).digest("base64")}`,
        robot.hash,
      );
    }
  });
}
