const { PrismaClient, Prisma } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

loadLocalEnv();

const prisma =
  globalThis.__devCafePrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__devCafePrisma = prisma;
}

async function handleDevCafeApi(req, res) {
  try {
    const request = await parseRequest(req);
    const action = String(request.query.action || request.body.action || "bootstrap").toLowerCase();

    if (request.method === "GET") {
      if (action === "health") {
        await prisma.$queryRaw`SELECT 1 AS ok`;
        return sendJson(res, 200, { ok: true, source: "dev-cafe-db", ts: new Date().toISOString() });
      }

      if (action === "setup") {
        return sendJson(res, 200, { ok: true, source: "dev-cafe-db", message: "Run `npm run db:push` to sync Prisma schema." });
      }

      if (action === "bootstrap") {
        return sendJson(res, 200, await bootstrap(request.query));
      }

      if (action === "menu") {
        return sendJson(res, 200, await readCatalog());
      }

      if (action === "orders") {
        return sendJson(res, 200, { ok: true, orders: await readOrders(request.query.userId || "") });
      }
    }

    if (request.method === "POST") {
      if (action === "createorder") {
        return sendJson(res, 200, await createOrder(request.body.payload || {}));
      }

      if (action === "saveadminstate") {
        return sendJson(res, 200, await saveAdminState(request.body.payload || {}));
      }
    }

    return sendJson(res, 405, { ok: false, error: "Method or action not allowed" });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.message || "Internal server error",
    });
  }
}

async function bootstrap(query) {
  const profile = {
    userId: String(query.userId || ""),
    displayName: String(query.displayName || ""),
    pictureUrl: String(query.pictureUrl || ""),
  };

  if (profile.userId) {
    await upsertCustomer(profile);
  }

  const catalog = await readCatalog();
  return {
    ...catalog,
    profile,
    orders: await readOrders(profile.userId),
  };
}

async function readCatalog() {
  const [menuRows, optionRows, settings] = await Promise.all([
    prisma.menuMaster.findMany({
      where: { enabled: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.optionMaster.findMany({
      where: { enabled: true },
      orderBy: [{ groupId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    }),
    readSettings(),
  ]);

  return {
    ok: true,
    source: "dev-cafe-db",
    menu: menuRows.map(mapMenu),
    options: optionRows.map(mapOption),
    settings,
  };
}

async function readOrders(userId = "") {
  const where = userId ? { userId: String(userId) } : {};
  const orders = await prisma.order.findMany({
    where,
    include: {
      items: {
        orderBy: { lineNo: "asc" },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  return orders.map(mapOrder);
}

async function createOrder(payload) {
  const customer = payload.customer || {};
  if (!customer.userId) return { ok: false, error: "missing userId" };

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { ok: false, error: "missing items" };

  const orderId = `OC${Date.now().toString().slice(-8)}`;
  const createdAt = new Date();
  const total = toDecimal(payload.total);
  const status = "pending-payment";
  const paymentStatus = "unpaid";
  const note = String(payload.note || "").trim();

  const order = await prisma.$transaction(async (tx) => {
    await upsertCustomer(customer, tx);

    return tx.order.create({
      data: {
        orderId,
        createdAt,
        userId: String(customer.userId),
        displayName: customer.displayName || "",
        total,
        status,
        paymentStatus,
        note,
        items: {
          create: items.map((item, index) => {
            const qty = Number(item.qty || 1);
            const unitPriceValue = Number(item.unitPrice ?? (qty ? Number(item.price || 0) / qty : 0));
            const lineTotalValue = Number(item.price ?? unitPriceValue * qty);

            return {
              lineNo: index + 1,
              productId: String(item.productId || ""),
              productName: String(item.productName || item.productId || ""),
              qty,
              unitPrice: toDecimal(unitPriceValue),
              lineTotal: toDecimal(lineTotalValue),
              optionSummary: String(item.summary || item.optionSummary || ""),
              note: String(item.note || ""),
              rawOptions: JSON.stringify(item.options || {}),
              createdAt,
            };
          }),
        },
      },
      include: {
        items: {
          orderBy: { lineNo: "asc" },
        },
      },
    });
  });

  const mappedOrder = mapOrder(order);
  const flexMessage = buildFlexMessage(mappedOrder);
  const sendResult = await safeSendLineOrderConfirmation(customer.userId, mappedOrder);
  const lineMessageId = getLineMessageId(sendResult);

  if (lineMessageId) {
    await prisma.order.update({
      where: { orderId },
      data: { lineMessageId },
    });
    mappedOrder.lineMessageId = lineMessageId;
  }

  return {
    ok: true,
    source: "dev-cafe-db",
    order: mappedOrder,
    flexMessage,
    sendResult,
  };
}

async function saveAdminState(payload) {
  const menu = Array.isArray(payload.menu) ? payload.menu : [];
  const options = Array.isArray(payload.options) ? payload.options : [];
  const settings = payload.settings || {};
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.menuMaster.deleteMany({});
    if (menu.length) {
      await tx.menuMaster.createMany({
        data: menu.map((item) => ({
          id: String(item.id || `menu-${Date.now()}`),
          category: String(item.category || "other"),
          name: String(item.name || "Untitled menu"),
          description: String(item.description || ""),
          basePrice: toDecimal(item.basePrice || 0),
          enabled: item.enabled !== false,
          fields: Array.isArray(item.fields) ? item.fields.join(",") : String(item.fields || ""),
          imageUrl: String(item.imageUrl || ""),
          createdAt: item.createdAt ? new Date(item.createdAt) : now,
          updatedAt: now,
        })),
      });
    }

    await tx.optionMaster.deleteMany({});
    if (options.length) {
      await tx.optionMaster.createMany({
        data: options.map((item) => ({
          groupId: String(item.groupId || ""),
          value: String(item.value || ""),
          label: String(item.label || ""),
          price: toDecimal(item.price || 0),
          sortOrder: Number(item.sortOrder || 0),
          enabled: item.enabled !== false,
          createdAt: item.createdAt ? new Date(item.createdAt) : now,
          updatedAt: now,
        })),
      });
    }

    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        tx.setting.upsert({
          where: { key },
          create: { key, value: String(value ?? ""), updatedAt: now },
          update: { value: String(value ?? ""), updatedAt: now },
        })
      )
    );
  });

  return { ok: true, source: "dev-cafe-db" };
}

async function readSettings() {
  const rows = await prisma.setting.findMany();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

async function upsertCustomer(customer, client = prisma) {
  const now = new Date();
  return client.customer.upsert({
    where: { userId: String(customer.userId) },
    create: {
      userId: String(customer.userId),
      displayName: customer.displayName || "",
      pictureUrl: customer.pictureUrl || "",
      firstSeenAt: customer.firstSeenAt ? new Date(customer.firstSeenAt) : now,
      lastSeenAt: now,
    },
    update: {
      displayName: customer.displayName || "",
      pictureUrl: customer.pictureUrl || "",
      lastSeenAt: now,
    },
  });
}

async function safeSendLineOrderConfirmation(userId, order) {
  try {
    return await sendLineOrderConfirmation(userId, order);
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      reason: error.message,
    };
  }
}

async function sendLineOrderConfirmation(userId, order) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    return { ok: false, skipped: true, reason: "missing LINE_CHANNEL_ACCESS_TOKEN" };
  }

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [buildFlexMessage(order)],
    }),
  });

  const body = await response.text();
  return {
    ok: response.ok,
    statusCode: response.status,
    body,
  };
}

function buildFlexMessage(order) {
  const itemBlocks = (order.items || []).slice(0, 10).map((item) => ({
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "xs",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: `${item.qty} x ${item.productName}`, weight: "bold", size: "sm", flex: 5, wrap: true },
          { type: "text", text: `฿${Number(item.price || item.lineTotal || 0)}`, size: "sm", align: "end", flex: 2 },
        ],
      },
      item.summary || item.optionSummary
        ? { type: "text", text: item.summary || item.optionSummary, size: "xs", color: "#666666", wrap: true }
        : null,
      item.note ? { type: "text", text: `หมายเหตุ: ${item.note}`, size: "xs", color: "#8a4f2a", wrap: true } : null,
    ].filter(Boolean),
  }));

  return {
    type: "flex",
    altText: `Order ${order.orderId} total ฿${order.total}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "สรุปคำสั่งซื้อ", weight: "bold", size: "xl", wrap: true },
          { type: "text", text: `เลขออเดอร์ ${order.orderId}`, color: "#8a4f2a", wrap: true },
          { type: "text", text: order.customer?.displayName || "ลูกค้า", size: "sm", color: "#666666" },
          { type: "separator", margin: "md" },
          ...itemBlocks,
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "รวมทั้งหมด", color: "#666666" },
              { type: "text", text: `฿${order.total}`, weight: "bold", align: "end" },
            ],
          },
        ],
      },
    },
  };
}

function mapMenu(row) {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    description: row.description || "",
    basePrice: Number(row.basePrice || 0),
    enabled: row.enabled,
    fields: String(row.fields || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
    imageUrl: row.imageUrl || "",
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || "",
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt || "",
  };
}

function mapOption(row) {
  return {
    groupId: row.groupId,
    value: row.value,
    label: row.label,
    price: Number(row.price || 0),
    sortOrder: Number(row.sortOrder || 0),
    enabled: row.enabled,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || "",
    updatedAt: row.updatedAt?.toISOString?.() || row.updatedAt || "",
  };
}

function mapOrder(row) {
  return {
    orderId: row.orderId,
    createdAt: row.createdAt?.toISOString?.() || row.createdAt || "",
    customer: {
      userId: row.userId,
      displayName: row.displayName || "",
    },
    total: Number(row.total || 0),
    status: row.status,
    paymentStatus: row.paymentStatus,
    lineMessageId: row.lineMessageId || "",
    note: row.note || "",
    items: (row.items || []).map((item) => ({
      id: item.id,
      orderId: item.orderId,
      lineNo: item.lineNo,
      productId: item.productId,
      productName: item.productName,
      qty: Number(item.qty || 1),
      unitPrice: Number(item.unitPrice || 0),
      lineTotal: Number(item.lineTotal || 0),
      price: Number(item.lineTotal || 0),
      optionSummary: item.optionSummary || "",
      summary: item.optionSummary || "",
      note: item.note || "",
      options: parseJson(item.rawOptions, {}),
      createdAt: item.createdAt?.toISOString?.() || item.createdAt || "",
    })),
  };
}

function getLineMessageId(sendResult) {
  if (!sendResult?.body) return "";
  return parseJson(sendResult.body, {})?.sentMessages?.[0]?.id || "";
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function toDecimal(value) {
  return new Prisma.Decimal(Number(value || 0));
}

async function parseRequest(req) {
  const requestUrl = new URL(req.url || "", "http://localhost");
  const query = { ...Object.fromEntries(requestUrl.searchParams.entries()), ...(req.query || {}) };

  return {
    method: String(req.method || "GET").toUpperCase(),
    query,
    body: await parseBody(req),
  };
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return parseJson(req.body, {});

  const raw = await readStream(req);
  return raw ? parseJson(raw, {}) : {};
}

function readStream(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding?.("utf8");
    req.on?.("data", (chunk) => {
      body += chunk;
    });
    req.on?.("end", () => resolve(body));
    req.on?.("error", reject);

    if (!req.on) resolve("");
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader?.("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

module.exports = {
  handleDevCafeApi,
};

function loadLocalEnv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(process.cwd(), "..", ".env"),
    path.join(__dirname, "..", ".env"),
  ];

  candidates.forEach((filePath) => {
    if (!fs.existsSync(filePath)) return;

    const content = fs.readFileSync(filePath, "utf8");
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      if (!key || process.env[key] !== undefined) return;

      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    });
  });
}
