import type { RemixTestConfig } from "remix/test";

export default {
  concurrency: 2,
  glob: {
    browser: "app/assets/radio-room-components.test.ts",
  },
  playwrightConfig: {
    projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  },
  project: "chromium",
} satisfies RemixTestConfig;
