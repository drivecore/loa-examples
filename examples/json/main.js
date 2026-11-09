import { loadLoaResolver } from "@landofassets/runtime";
import { showError, startScene } from "example-scene";

try {
  // Resolve the complete map before constructing any loaders. No bundler needed.
  const assets = await loadLoaResolver(new URL("./asset-resolution.json", import.meta.url).href);
  await startScene(assets);
} catch (error) {
  showError(error);
}
