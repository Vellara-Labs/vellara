import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 60_000,
    reporters: ["verbose"],
    include: ["**/*.test.ts", "../../frontend/src/lib/validation.test.ts"],
  },
});
