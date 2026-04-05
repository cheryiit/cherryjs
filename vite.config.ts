import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tsconfigPaths({
      root: process.cwd(),
      ignoreConfigErrors: true,
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    // Alchemy plugin added when deploying to Cloudflare:
    // import alchemy from "alchemy/cloudflare/tanstack-start";
    // alchemy(),
  ],
  resolve: {
    dedupe: ["convex/react", "convex"],
  },
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
  clearScreen: false,
});
