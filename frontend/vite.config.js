import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [vue(), appsScriptDevProxy(env)],
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

function appsScriptDevProxy(env) {
  const value = env.APPS_SCRIPT_WEBAPP_URL || "";
  if (!value) return null;

  try {
    const targetUrl = new URL(value);

    return {
      name: "devcafe-apps-script-dev-proxy",
      configureServer(server) {
        server.middlewares.use("/api/apps-script", async (req, res) => {
          try {
            const upstream = new URL(targetUrl.toString());
            const requestUrl = new URL(req.url || "", "http://localhost");
            requestUrl.searchParams.forEach((paramValue, key) => {
              upstream.searchParams.set(key, paramValue);
            });

            const body = req.method === "POST" ? await readJsonRequestBody(req) : undefined;
            const response = await fetch(upstream.toString(), {
              method: req.method,
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body,
              redirect: "follow",
            });
            const text = await response.text();

            res.statusCode = response.status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(text);
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ ok: false, error: error.message }));
          }
        });
      },
    };
  } catch {
    return null;
  }
}

async function readJsonRequestBody(req) {
  const body = await readRequestBody(req);
  return JSON.stringify(body ? JSON.parse(body) : {});
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
