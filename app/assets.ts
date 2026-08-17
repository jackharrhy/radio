import { createAssetServer } from "remix/assets";

const rootDir = process.cwd();
const nodeEnv = process.env.NODE_ENV ?? "development";
const isDevelopment = nodeEnv === "development";

export const assetServer = createAssetServer({
  basePath: "/assets",
  rootDir,
  fileMap: {
    "app/*path": "app/*path",
    "node_modules/*path": "node_modules/*path",
  },
  allow: ["app/assets/**", "app/data/protocol.ts", "app/ui/desktop/**", "node_modules/**"],
  deny: ["app/data/radio-*.ts", "app/data/audio-store.ts"],
  sourceMaps: isDevelopment ? "external" : undefined,
  minify: !isDevelopment,
  watch: false,
});
