import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 120000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3456",
  },
});
