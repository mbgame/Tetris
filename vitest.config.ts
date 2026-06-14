import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    // game/core must stay Phaser-free → plain node env for fast, deterministic logic tests
    environment: "node",
    include: ["tests/**/*.{test,spec}.ts", "game/**/*.{test,spec}.ts"],
    globals: true,
    passWithNoTests: true,
  },
});
