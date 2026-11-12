import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  use: { launchOptions: { args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] }, baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: { command: "npx tsx scripts/e2e-server.ts", url: "http://localhost:3100", timeout: 120_000, reuseExistingServer: false, stdout: "pipe" },
});
