import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [vue()],
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
