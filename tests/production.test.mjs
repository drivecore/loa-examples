import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import { createAnonymousClient, getAsset } from "@landofassets/sdk";
import { createLoaResolver, loadLoaResolver } from "@landofassets/runtime";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { serveJson, root } from "../scripts/json.mjs";

test("published SDK resolves the pinned public production asset; bytes pass SHA-256 and GLTFLoader", async () => {
  const lock = JSON.parse(await readFile(new URL("../assets-lock.json", import.meta.url)));
  const entry = lock.importers["."].assets.robot;
  assert.equal(entry.kind, "loa");
  assert.equal(entry.host, "https://api.landofassets.com");
  assert.equal(entry.version, "1.0.0");
  const client = createAnonymousClient({ host: entry.host });
  const metadata = await getAsset(client, {
    params: { orgName: "BenHouston3D", projectName: "three", assetName: "robotexpressive@1.0.0" },
  });
  assert.equal(metadata.visibility, "PUBLIC");
  assert.equal(metadata.fileOid, Buffer.from(entry.hash.slice(7), "base64").toString("hex"));
  const assets = createLoaResolver({ resolution: { robot: entry.remoteUrl } });
  const response = await fetch(assets.urlModifier("loa:robot"), {
    headers: { Origin: "http://127.0.0.1:4173" },
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  const bytes = await response.arrayBuffer();
  assert.equal(
    `sha256-${createHash("sha256").update(new Uint8Array(bytes)).digest("base64")}`,
    entry.hash,
  );
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  let meshes = 0;
  gltf.scene.traverse((object) => {
    if (object.isMesh) meshes++;
  });
  assert.ok(meshes > 0);
  assert.ok(gltf.animations.some((clip) => clip.name === "Idle"));
  console.log(
    `Production GLB: ${bytes.byteLength} bytes, ${meshes} meshes, ${gltf.animations.length} animation clips`,
  );
});

test("unbundled HTTP server serves generated resolution, runtime and Three.js modules", async (t) => {
  const server = await serveJson({ port: 0 });
  t.after(() => new Promise((done) => server.close(done)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const assets = await loadLoaResolver(`${base}/asset-resolution.json`);
  assert.match(assets.url("robot"), /^https:\/\/(?:api|content)\.landofassets\.com\//);
  for (const path of [
    "/",
    "/main.js",
    "/shared/scene.js",
    "/vendor/loa/index.js",
    "/vendor/three/three.module.js",
    "/vendor/three/three.core.js",
    "/vendor/three/addons/loaders/GLTFLoader.js",
  ]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 0);
  }
  for (const path of ["/package.json", "/.env", "/node_modules/@landofassets/cli/package.json"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});

test("published CLI generates a local JSON map whose served bytes match the lockfile", async (t) => {
  const mapFile = new URL("../examples/json/asset-resolution.json", import.meta.url);
  const original = await readFile(mapFile);
  t.after(() => writeFile(mapFile, original));
  execFileSync(
    process.execPath,
    ["scripts/loa.mjs", "resolve", "--mode", "local", "--output", mapFile.pathname],
    { cwd: root },
  );
  const server = await serveJson({ port: 0 });
  t.after(() => new Promise((done) => server.close(done)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const assets = await loadLoaResolver(`${base}/asset-resolution.json`);
  assert.match(assets.url("robot"), /^\/asset_cache\//);
  const response = await fetch(new URL(assets.urlModifier("loa:robot"), base));
  assert.equal(response.status, 200);
  const lock = JSON.parse(await readFile(new URL("../assets-lock.json", import.meta.url)));
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.equal(
    `sha256-${createHash("sha256").update(bytes).digest("base64")}`,
    lock.importers["."].assets.robot.hash,
  );
});
