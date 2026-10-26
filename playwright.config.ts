import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_PATH = process.env.E2E_BASE_PATH ?? "/crypto-radar/";
const BASE_URL = `http://127.0.0.1:${PORT}${BASE_PATH}`;
const PROXY = process.env.E2E_PROXY ?? "";

export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 90_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      // A local proxy is required when the machine cannot reach Binance
      // directly. localhost must bypass it so the preview server is reachable.
      ...(PROXY
        ? { proxy: { server: PROXY, bypass: "localhost,127.0.0.1" } }
        : {}),
    },
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"], channel: "chrome" },
    },
  ],
});
