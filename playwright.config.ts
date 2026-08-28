import { defineConfig, devices } from "@playwright/test";

const appOrigin = "http://127.0.0.1:4178";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: appOrigin,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4178",
    url: `${appOrigin}/Pinch/`,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "chrome-live",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
      },
    },
    {
      name: "firefox-app",
      testMatch: /app\.spec\.ts/,
      use: devices["Desktop Firefox"],
    },
    {
      name: "webkit-app",
      testMatch: /app\.spec\.ts/,
      use: devices["Desktop Safari"],
    },
  ],
});
