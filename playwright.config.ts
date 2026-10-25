import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3000);
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

/**
 * End-to-end tests run against a real server and database. They create their own
 * throwaway accounts and insert one clearly labelled sample contest (see tests/e2e/setup.ts).
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath, args: ["--no-sandbox", "--disable-gpu"] } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_COMMAND ?? "npm run start",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
