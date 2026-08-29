import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

const account = "devstoreaccount1";
const accountKey =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
const configuredBucket = process.env.CELLD_BUCKET ?? "az://radio-celld";
const bucketUrl = configuredBucket.startsWith("az://")
  ? configuredBucket
  : `az://${configuredBucket}`;
const bucket = bucketUrl.slice("az://".length).split("/", 1)[0];
if (!bucket) throw new Error(`Invalid CELLD_BUCKET: ${configuredBucket}`);

const endpoint = process.env.AZURITE_BLOB_ENDPOINT ?? `http://127.0.0.1:10000/${account}`;
const celld = process.env.CELLD_BIN ?? join(homedir(), ".local", "bin", "celld");
const environment = {
  ...process.env,
  AZURE_STORAGE_USE_EMULATOR: "true",
  AZURE_STORAGE_ACCOUNT_NAME: account,
  CELLD_ESBUILD: join(process.cwd(), "node_modules", ".bin", "esbuild"),
};

function run(args, capture = false) {
  let result = spawnSync(celld, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `${celld} ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }
  return result.stdout?.trim() ?? "";
}

if (run(["--version"], true) !== "celld 0.4.0") {
  throw new Error("The deployment image must contain celld 0.4.0");
}

let credential = new StorageSharedKeyCredential(account, accountKey);
let storage = new BlobServiceClient(endpoint, credential);
let container = storage.getContainerClient(bucket);
await retry("create the Azurite container", () => container.createIfNotExists());
await retry("verify Azurite conditional writes", () =>
  run(["diagnose", "--bucket", bucketUrl, "--listen", "127.0.0.1:0"], true),
);

run(["deploy", ".", "--bucket", bucketUrl]);
console.log(`Deployed Radio to ${bucketUrl} through ${endpoint}`);

async function retry(description, operation, attempt = 1) {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= 30) {
      throw new Error(`Failed to ${description}`, { cause: error });
    }
    await delay(1_000);
    return retry(description, operation, attempt + 1);
  }
}
