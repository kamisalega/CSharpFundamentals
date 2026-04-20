  import { defineConfig } from "vitest/config";
  import react from "@vitejs/plugin-react";
  import { fileURLToPath } from "node:url";

  export default defineConfig({
    plugins: [react()],
    test: {
      environment: "node",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
      coverage: {
        provider: "v8",
        reporter: ["text", "html"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: ["src/**/*.test.{ts,tsx}", "src/app/**/layout.tsx"],
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  });