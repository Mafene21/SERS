import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

export default defineConfig({
  testDir: "./tests",
  testMatch: process.env.SERS_INTEGRATION_ACCOUNTS
    ? "phase-two.spec.ts"
    : "dashboard.spec.ts",
  fullyParallel: !process.env.SERS_INTEGRATION_ACCOUNTS,
  workers: process.env.SERS_INTEGRATION_ACCOUNTS ? 1 : 2,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/google-chrome")
          ? "/usr/bin/google-chrome"
          : undefined),
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    env: {
      SERS_DEMO_MODE: process.env.SERS_INTEGRATION_ACCOUNTS ? "false" : "true",
    },
    timeout: 120_000,
  },
});
