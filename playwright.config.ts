import { defineConfig } from "@playwright/test";

// The spec's test file reads its page from INVOICE_TEST_URL: point it at this repo's server.
process.env.INVOICE_TEST_URL ??= "http://localhost:4173/__test__/invoice";

/*
 * On-screen layout tests for templates (e2e/). Uses the locally installed Google Chrome, so
 * no Playwright browser download is needed. Build first: `npm run test:e2e` does both.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    channel: "chrome",
    headless: true,
  },
  webServer: {
    command: "node e2e/invoice-layout/server.mjs 4173",
    url: "http://localhost:4173/index.html",
    reuseExistingServer: true,
  },
});
