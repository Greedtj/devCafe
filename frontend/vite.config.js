import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [vue(), devCafeApiMiddleware()],
    root: ".",
    server: {
      port: 5173,
      host: "0.0.0.0",
    },
    build: {
      rollupOptions: {
        input: {
          main: "index.html",
          admin: "admin.html",
        },
      },
    },
  };
});

function devCafeApiMiddleware() {
  return {
    name: "dev-cafe-api-middleware",
    configureServer(server) {
      const { handleDevCafeApi } = require("../api/_dev-cafe-handler.cjs");
      server.middlewares.use("/api/dev-cafe", handleDevCafeApi);
    },
  };
}
