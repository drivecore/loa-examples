import { createServer } from "node:http";
import { cp, mkdir, readFile, realpath, rm, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../", import.meta.url));
const vendor = {
  "/vendor/three/addons/": "node_modules/three/examples/jsm/",
  "/vendor/three/": "node_modules/three/build/",
  "/vendor/loa/": "node_modules/@landofassets/runtime/dist/",
};
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
};

/** Static server for the unbundled example. Only explicit public paths are served. */
export async function serveJson({ port = 4173, directory } = {}) {
  const server = createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method ?? "")) {
        response.writeHead(405, { Allow: "GET, HEAD" }).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      let path;
      let allowedRoot;
      if (directory) {
        allowedRoot = resolve(directory);
        path = resolve(allowedRoot, `.${pathname === "/" ? "/index.html" : pathname}`);
      } else {
        const route = Object.keys(vendor).find((prefix) => pathname.startsWith(prefix));
        if (route) {
          allowedRoot = resolve(root, vendor[route]);
          path = resolve(allowedRoot, pathname.slice(route.length));
        } else if (pathname.startsWith("/shared/") || pathname.startsWith("/asset_cache/")) {
          allowedRoot = resolve(root, pathname.startsWith("/shared/") ? "shared" : "asset_cache");
          path = resolve(root, `.${pathname}`);
        } else if (["/", "/index.html", "/main.js", "/asset-resolution.json"].includes(pathname)) {
          allowedRoot = resolve(root, "examples/json");
          path = resolve(allowedRoot, pathname === "/" ? "index.html" : pathname.slice(1));
        } else {
          response.writeHead(404).end();
          return;
        }
      }
      const [actual, boundary] = await Promise.all([realpath(path), realpath(allowedRoot)]);
      if (!actual.startsWith(boundary + sep) || !(await stat(actual)).isFile()) {
        response.writeHead(404).end();
        return;
      }
      const data = await readFile(actual);
      response.writeHead(200, {
        "Content-Type": mime[extname(actual)] ?? "application/octet-stream",
        "Content-Length": data.length,
        "Cache-Control": "no-store",
      });
      response.end(request.method === "HEAD" ? undefined : data);
    } catch (error) {
      response.writeHead(["ENOENT", "ENOTDIR"].includes(error.code) ? 404 : 500).end();
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
  return server;
}

async function build() {
  const target = resolve(root, "dist/json");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(resolve(root, "examples/json"), target, { recursive: true });
  await cp(resolve(root, "shared"), resolve(target, "shared"), { recursive: true });
  // Native ES modules, copied unchanged. No Vite, esbuild, or other bundler.
  for (const file of ["three.module.js", "three.core.js"]) {
    await mkdir(resolve(target, "vendor/three"), { recursive: true });
    await cp(
      resolve(root, "node_modules/three/build", file),
      resolve(target, "vendor/three", file),
    );
  }
  await cp(
    resolve(root, "node_modules/three/examples/jsm"),
    resolve(target, "vendor/three/addons"),
    { recursive: true },
  );
  await mkdir(resolve(target, "vendor/loa"), { recursive: true });
  await cp(
    resolve(root, "node_modules/@landofassets/runtime/dist/index.js"),
    resolve(target, "vendor/loa/index.js"),
  );
  console.log("Unbundled example built in dist/json (remote assets).");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "build") await build();
  else {
    const server = await serveJson({ directory: process.argv[3] });
    console.log(`JSON example: http://127.0.0.1:${server.address().port}`);
  }
}
