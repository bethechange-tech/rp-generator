import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 120000, // 2 min for container startup
    hookTimeout: 120000,
    include: ["src/**/*.test.ts"],
  },
});
