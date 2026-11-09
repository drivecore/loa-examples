# Land of Assets · Three.js examples

Two small applications load the same pinned, public model from **[landofassets.com](https://landofassets.com)** using the published LoA packages:

| Example                          | Resolution                                                  | Asset delivery                                                   |
| -------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| [`examples/json`](examples/json) | `loa resolve` → `asset-resolution.json` → `loadLoaResolver` | Production cloud, or pulled files during development             |
| [`examples/vite`](examples/vite) | `loa()` → `virtual:loa` → `createLoaResolver`               | Production cloud, or verified local files emitted into the build |

Both register `assets.urlModifier` on a `THREE.LoadingManager` and load `loa:robot` with `GLTFLoader`. [`shared/scene.js`](shared/scene.js) contains the common scene, animation, orbit controls, loading status, resolved URL, and actual WebGL renderer identity.

## Quick start

Use Node 26 (see `.nvmrc`). No LoA account, API token, global CLI installation, or Three.js checkout is needed to consume the public asset.

```sh
npm ci
npm run assets:resolve -- --mode remote
npm run dev:json
# Open http://127.0.0.1:4173
```

In another terminal, start the Vite example:

```sh
npm run dev:vite
# Open http://127.0.0.1:5173
```

Drag to orbit, scroll to zoom, or pause the robot's idle animation. Both pages should report a loaded model and show the same production URL. Errors appear in the page and browser console. A hardware rendering check requires an identified real GPU; the page rejects SwiftShader, llvmpipe, and lavapipe rather than treating them as a successful hardware check.

## What is committed

[`assets.json`](assets.json) selects `BenHouston3D/three/robotexpressive@1.0.0` as `robot`. [`assets-lock.json`](assets-lock.json) records its production host, exact version, immutable content URL, and SHA-256 integrity. Commit those two files when changing assets. Dependencies are pinned in `package-lock.json`.

`asset-resolution.json` (singular), `asset_cache/`, `node_modules/`, and `dist/` are generated and ignored. The generated map is intentionally separate from the manifest and lockfile.

All `npm run loa` and asset scripts force `LOA_HOST=https://api.landofassets.com`, overriding any preview or personal host in your global CLI configuration. The runtime uses the committed production URLs; it never receives a credential.

## Plain JavaScript and a JSON map

[`examples/json/main.js`](examples/json/main.js) loads the generated map **before** constructing loaders. The HTML import map points at installed browser ES modules; the development server exposes those modules under `/vendor/`. This example uses no Vite or other bundler.

```js
import { loadLoaResolver } from "@landofassets/runtime";

const assets = await loadLoaResolver("./asset-resolution.json");
const manager = new THREE.LoadingManager();
manager.setURLModifier(assets.urlModifier);
new GLTFLoader(manager).load("loa:robot", (gltf) => scene.add(gltf.scene));
```

For local JSON development:

```sh
npm run assets:pull
npm run assets:resolve -- --mode local
npm run dev:json
```

The server exposes the pulled `asset_cache/` files. The default resolve mode is `auto`, which prefers pulled files; pass `--mode remote` explicitly to test cloud loading after pulling.

Build an unbundled static distribution with a remote map:

```sh
npm run build:json
node scripts/json.mjs serve dist/json
```

Deploy the contents of `dist/json/` to an HTTP static host. The build copies Three.js and the runtime unchanged, together with the shared scene and generated map. Opening `index.html` with `file://` does not work because module and fetch requests need HTTP.

## Vite: cloud or self-contained

[`examples/vite/vite.config.js`](examples/vite/vite.config.js) points the LoA plugin at the repository's lockfile. Cloud mode does not require a pull:

```sh
npm run dev:vite
npm run build:vite
# dist/vite-remote/
```

For local development or a build that includes the model:

```sh
npm run assets:pull
npm run dev:vite:local
npm run build:vite:local
# dist/vite-local/ contains the GLB; no production request is needed at runtime.
```

These scripts use Vite's `offline` mode to select `loa({ mode: 'local' })`. Vite reserves the mode name `local` for `.env.local`, so do not pass `vite --mode local`.

The Vite entry point imports `virtual:loa` and constructs a synchronous resolver. Asset binding names and scene code stay the same in cloud and local builds. Both Vite outputs use relative build paths and can be deployed beneath a static-host subdirectory.

## Change the selected model

```sh
npm run loa -- add your-org/your-project/your-model@1.2.3 --as robot
npm run assets:resolve -- --mode remote
```

Use a self-contained GLB with embedded buffers and images. Additional codecs require their corresponding Three.js decoder setup. This scene normalizes the model to three units high and uses an `Idle` clip, falling back to the first animation. Update tests and attribution when replacing the demonstration asset.

To publish your own asset, authenticate first and publish to a project you own:

```sh
npm run loa -- auth login
npm run loa -- publish ./model.glb --to your-org/your-project/your-model --version 1.0.0
```

Publication validates self-contained resources on the server. The examples themselves only consume an existing public immutable asset.

## Verify integrations

```sh
npm run check
npm run assets:resolve -- --mode remote
npm run assets:pull
npm test
npm run build
```

The tests exercise the installed SDK against production metadata, anonymous content downloads and CORS, SHA-256 verification, Three.js GLB parsing and animation discovery, the unbundled HTTP routes, Vite's dev virtual module, local asset serving, and both remote and local build output. The local Vite build must contain a GLB with the locked hash and must not reference the remote content URL.

These checks do **not** prove GPU rendering quality. For that, open both pages in a browser with a real GPU, confirm the reported renderer, inspect the robot and controls, and check the console for errors. This repository is a functional example, not a rendering throughput benchmark.

[CI](.github/workflows/ci.yml) runs on PRs, `main`, manual dispatch, and weekly against production. It uploads all three static builds as an artifact. Network or production outages intentionally fail these integration checks.

## Attribution and license

Example code is [MIT licensed](LICENSE). The model retains its original CC0 1.0 license:

- **RobotExpressive**, by [Tomás Laulhé / Quaternius](https://www.patreon.com/quaternius), with modifications by [Don McCurdy](https://donmccurdy.com/) (facial morph targets, FBX2GLTF conversion, material cleanup).
- [Three.js model and attribution](https://github.com/mrdoob/three.js/tree/f2b6a71bdd088d9da387fcc62802323341099b92/examples/models/gltf/RobotExpressive).
- [Pinned production asset](https://landofassets.com/BenHouston3D/three/assets/robotexpressive@1.0.0).

No model binaries are committed here. The selected production asset matches the RobotExpressive GLB in the Three.js examples.
