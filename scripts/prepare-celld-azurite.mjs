import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";

const account = process.env.AZURE_STORAGE_ACCOUNT_NAME ?? "devstoreaccount1";
const accountKey =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
const bucketUrl = process.env.CELLD_BUCKET ?? "az://radio-celld";
const bucket = bucketUrl.startsWith("az://") ? bucketUrl.slice(5).split("/", 1)[0] : "";

if (!bucket) throw new Error(`CELLD_BUCKET must be an az:// URL, received ${bucketUrl}`);

const endpoint = process.env.AZURITE_BLOB_ENDPOINT ?? `http://127.0.0.1:10000/${account}`;
const environment = {
  ...process.env,
  AZURE_STORAGE_USE_EMULATOR: "true",
  AZURE_STORAGE_ACCOUNT_NAME: account,
  CELLD_ESBUILD: "/app/node_modules/.bin/esbuild",
};

await retry("create the Azurite container", async () => {
  let credential = new StorageSharedKeyCredential(account, accountKey);
  let client = new BlobServiceClient(endpoint, credential).getContainerClient(bucket);
  await client.createIfNotExists();
});

await retry("verify the Azurite backend", () => run(["diagnose", "--bucket", bucketUrl]));
run(["deploy", ".", "--bucket", bucketUrl]);

function run(args) {
  let result = spawnSync("celld", args, {
    cwd: "/app",
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error(`celld ${args.join(" ")} failed`);
}

async function retry(description, operation, attempt = 1) {
  try {
    return await operation();
  } catch (error) {
    if (attempt >= 30) throw new Error(`Failed to ${description}`, { cause: error });
    await delay(1_000);
    return retry(description, operation, attempt + 1);
  }
}
