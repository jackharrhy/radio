import * as fs from "node:fs/promises";
import * as path from "node:path";

import { build } from "esbuild";

const root = process.cwd();
const clientDirectory = path.join(root, "dist", "client");

await fs.rm(clientDirectory, { recursive: true, force: true });
await fs.cp(path.join(root, "public"), clientDirectory, { recursive: true });
await fs.mkdir(path.join(clientDirectory, "assets"), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: {
    entry: "app/assets/entry.ts",
    "radio-room": "app/assets/radio-room.tsx",
  },
  outdir: "dist/client/assets",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  splitting: true,
  sourcemap: true,
  minify: process.env.NODE_ENV === "production",
  jsx: "automatic",
  jsxImportSource: "remix/ui",
});
