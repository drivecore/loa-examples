import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { loa } from "@landofassets/runtime/vite";

const repository = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => ({
  root: fileURLToPath(new URL("./", import.meta.url)),
  base: "./",
  plugins: [loa({ root: repository, mode: mode === "offline" ? "local" : "remote" })],
  server: { port: 5173, strictPort: true, fs: { allow: [repository] } },
  build: {
    outDir: fileURLToPath(
      new URL(`../../dist/vite-${mode === "offline" ? "local" : "remote"}/`, import.meta.url),
    ),
    emptyOutDir: true,
  },
}));
