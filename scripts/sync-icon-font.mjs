import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const source = resolve(
  rootDir,
  "node_modules/@material-symbols/font-400/material-symbols-rounded.woff2",
);
const destination = resolve(rootDir, "public/fonts/material-symbols-rounded.woff2");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
