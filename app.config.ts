import { defineConfig } from "@tanstack/start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  tsr: {
    appDirectory: "app",
    routesDirectory: "app/routes",
    generatedRouteTree: "app/routeTree.gen.ts",
  },
  vite: {
    plugins: [
      viteTsConfigPaths({
        projects: ["./tsconfig.json"],
      }),
    ],
  },
  server: {
    preset: "node-server",
  },
});
