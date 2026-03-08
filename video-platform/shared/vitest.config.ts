// FILE: /video-platform/shared/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            include: ["stores/**/*.ts", "monitoring/**/*.ts", "database/**/*.ts"],
            exclude: ["**/node_modules/**", "**/tests/**"],
        },
        testTimeout: 10000,
    },
});
