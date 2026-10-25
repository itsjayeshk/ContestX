import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const alias = {
  "@": root,
  "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
