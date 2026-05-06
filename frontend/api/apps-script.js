export default async function handler(req, res) {
  const targetUrl = process.env.APPS_SCRIPT_WEBAPP_URL;

  if (!targetUrl) {
    res.status(500).json({ ok: false, error: "APPS_SCRIPT_WEBAPP_URL is not configured" });
    return;
  }

  try {
    if (req.method === "GET") {
      const upstream = new URL(targetUrl);
      if (req.query?.action) upstream.searchParams.set("action", req.query.action);
      if (req.query?.userId) upstream.searchParams.set("userId", req.query.userId);
      const response = await fetch(upstream.toString(), {
        headers: { Accept: "application/json" },
      });
      const text = await response.text();
      res.status(response.status).setHeader("Content-Type", "application/json").send(text);
      return;
    }

    if (req.method === "POST") {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(req.body || {}),
      });
      const text = await response.text();
      res.status(response.status).setHeader("Content-Type", "application/json").send(text);
      return;
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}
