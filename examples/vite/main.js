import { createLoaResolver } from "@landofassets/runtime";
import resolution from "virtual:loa";
import { showError, startScene } from "../../shared/scene.js";
import "../../shared/style.css";

try {
  const assets = createLoaResolver({ resolution });
  await startScene(assets);
} catch (error) {
  showError(error);
}
