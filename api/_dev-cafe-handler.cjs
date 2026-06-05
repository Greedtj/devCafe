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
  const [categories, menus, optionGroups] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: { not: false } },
      include: { subCategory: { where: { isActive: { not: false } }, orderBy: [{ sortOrder: "asc" }, { subCategoryName: "asc" }] } },
      orderBy: [{ sortOrder: "asc" }, { categoryName: "asc" }],
    }),
    prisma.menu.findMany({
      where: { isActive: { not: false } },
      include: {
        category: true,
        subCategory: true,
        menuOptionGroup: {
          where: { isActive: { not: false } },
          include: { optionGroup: true },
          orderBy: [{ sortOrder: "asc" }, { optionGroupId: "asc" }],
        },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { menuName: "asc" }],
    }),
    prisma.optionGroup.findMany({
      where: { isActive: { not: false } },
      include: {
        optionItem: {
          where: { isActive: { not: false } },
          orderBy: [{ sortOrder: "asc" }, { optionItemName: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { optionGroupName: "asc" }],
    }),
  ]);

  return {
    ok: true,
    source: "dev-cafe-db",
    categories: categories.map(mapCategory),
    menu: menus.map(mapMenu),
    options: optionGroups.flatMap(mapOptionGroupOptions),
    optionGroups: optionGroups.map(mapOptionGroup),
    settings: {},
  };
}

async function readOrders(userId = "") {
  const where = userId ? { user: { lineToken: String(userId) } } : {};
  const orders = await prisma.orderHeader.findMany({
    where,
    include: {
      user: true,
      orderItem: {
        include: {
          orderItemOption: {
            orderBy: { orderItemOptionId: "asc" },
          },
        },
        orderBy: { orderItemId: "asc" },
      },
    },
    orderBy: {
      createDate: "desc",
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

  const orderNo = `OC${Date.now().toString().slice(-8)}`;
  const createdAt = new Date();
  const total = toDecimal(payload.total);
  const status = "PENDING";
  const paymentStatus = "UNPAID";
  const note = String(payload.note || "").trim();

  const order = await prisma.$transaction(async (tx) => {
    const dbUser = await upsertCustomer(customer, tx);

    return tx.orderHeader.create({
      data: {
        orderNo,
        orderType: "TAKEAWAY",
        orderStatus: status,
        customerName: customer.displayName || "Guest",
        subtotalAmount: total,
        discountAmount: toDecimal(0),
        totalAmount: total,
        paymentStatus,
        remark: note,
        createDate: createdAt,
        createUser: String(customer.userId),
        userId: dbUser.userId,
        orderItem: {
          create: items.map((item) => {
            const qty = Number(item.qty || 1);
            const unitPriceValue = Number(item.unitPrice ?? (qty ? Number(item.price || 0) / qty : 0));
            const lineTotalValue = Number(item.price ?? unitPriceValue * qty);
            const optionExtraPrice = Math.max(0, unitPriceValue - Number(item.basePrice || 0));
            const optionEntries = Object.entries(item.options || {})
              .map(([groupId, value]) => ({
                groupId: toInt(groupId),
                value: toInt(value),
              }))
              .filter((entry) => entry.groupId && entry.value);

            return {
              menuId: toInt(item.productId),
              menuName: String(item.productName || item.productId || ""),
              basePrice: toDecimal(Number(item.basePrice ?? unitPriceValue - optionExtraPrice)),
              quantity: qty,
              optionExtraPrice: toDecimal(optionExtraPrice),
              unitPrice: toDecimal(unitPriceValue),
              totalPrice: toDecimal(lineTotalValue),
              remark: String(item.note || ""),
              orderItemOption: {
                create: optionEntries.map((entry) => ({
                  optionGroupId: entry.groupId,
                  optionGroupName: String(item.optionLabels?.[entry.groupId]?.groupName || item.optionLabels?.[String(entry.groupId)]?.groupName || ""),
                  optionItemId: entry.value,
                  optionItemName: String(item.optionLabels?.[entry.groupId]?.label || item.optionLabels?.[String(entry.groupId)]?.label || ""),
                  extraPrice: toDecimal(Number(item.optionLabels?.[entry.groupId]?.price || item.optionLabels?.[String(entry.groupId)]?.price || 0)),
                })),
              },
            };
          }),
        },
      },
      include: {
        user: true,
        orderItem: {
          include: { orderItemOption: { orderBy: { orderItemOptionId: "asc" } } },
          orderBy: { orderItemId: "asc" },
        },
      },
    });
  });

  const mappedOrder = mapOrder(order);
  const flexMessage = buildFlexMessage(mappedOrder);
  const sendResult = await safeSendLineOrderConfirmation(customer.userId, mappedOrder);
  const lineMessageId = getLineMessageId(sendResult);

  if (lineMessageId) {
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
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const activeMenuIds = [];
    const optionGroupIdMap = await syncOptionGroups(tx, options, now);

    for (const item of menu) {
      const category = await ensureCategory(tx, item.categoryId || item.category, item.categoryName || item.category || "ทั่วไป", now);
      const subCategoryId = await ensureSubCategory(tx, category.categoryId, item.subCategoryId, item.subCategoryName, now);
      const menuId = toInt(item.menuId || item.id);
      const data = {
        menuName: String(item.name || item.menuName || "เมนูใหม่"),
        categoryId: category.categoryId,
        subCategoryId,
        basePrice: toDecimal(item.basePrice || 0),
        description: String(item.description || ""),
        imageUrl: String(item.imageUrl || ""),
        isActive: item.enabled !== false,
        lastDate: now,
        lastUser: "admin",
      };
      const saved = menuId
        ? await tx.menu.update({ where: { menuId }, data })
        : await tx.menu.create({ data: { ...data, createDate: now, createUser: "admin" } });

      activeMenuIds.push(saved.menuId);
      await tx.menuOptionGroup.deleteMany({ where: { menuId: saved.menuId } });
      const groupIds = (Array.isArray(item.fields) ? item.fields : String(item.fields || "").split(","))
        .map((field) => optionGroupIdMap.get(String(field)) || toInt(field))
        .filter(Boolean);

      for (const [index, optionGroupId] of [...new Set(groupIds)].entries()) {
        await tx.menuOptionGroup.upsert({
          where: { menuId_optionGroupId: { menuId: saved.menuId, optionGroupId } },
          create: {
            menuId: saved.menuId,
            optionGroupId,
            isRequired: false,
            sortOrder: index + 1,
            isActive: true,
          },
          update: {
            sortOrder: index + 1,
            isActive: true,
          },
        });
      }
    }

    if (activeMenuIds.length) {
      await tx.menu.updateMany({
        where: { menuId: { notIn: activeMenuIds } },
        data: { isActive: false, lastDate: now, lastUser: "admin" },
      });
    }
  });

  return { ok: true, source: "dev-cafe-db" };
}

async function upsertCustomer(customer, client = prisma) {
  const now = new Date();
  return client.user.upsert({
    where: { lineToken: String(customer.userId) },
    create: {
      lineToken: String(customer.userId),
      name: customer.displayName || "Guest",
      isActive: true,
      createDate: now,
      createUser: "line",
      lastDate: now,
      lastUser: "line",
    },
    update: {
      name: customer.displayName || "Guest",
      isActive: true,
      lastDate: now,
      lastUser: "line",
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

function mapCategory(row) {
  return {
    id: String(row.categoryId),
    categoryId: row.categoryId,
    name: row.categoryName,
    description: row.description || "",
    sortOrder: Number(row.sortOrder || 0),
    enabled: row.isActive !== false,
    subCategories: (row.subCategory || []).map((item) => ({
      id: String(item.subCategoryId),
      subCategoryId: item.subCategoryId,
      categoryId: item.categoryId,
      name: item.subCategoryName,
      description: item.description || "",
      sortOrder: Number(item.sortOrder || 0),
      enabled: item.isActive !== false,
    })),
  };
}

function mapMenu(row) {
  return {
    id: String(row.menuId),
    menuId: row.menuId,
    category: String(row.categoryId),
    categoryId: row.categoryId,
    categoryName: row.category?.categoryName || "",
    subCategoryId: row.subCategoryId || null,
    subCategoryName: row.subCategory?.subCategoryName || "",
    name: row.menuName,
    description: row.description || "",
    basePrice: Number(row.basePrice || 0),
    enabled: row.isActive !== false,
    fields: (row.menuOptionGroup || []).map((link) => String(link.optionGroupId)),
    optionGroups: (row.menuOptionGroup || []).map((link) => ({
      groupId: String(link.optionGroupId),
      optionGroupId: link.optionGroupId,
      name: link.optionGroup?.optionGroupName || "",
      required: link.isRequired === true,
      sortOrder: Number(link.sortOrder || 0),
    })),
    imageUrl: row.imageUrl || "",
    createdAt: row.createDate?.toISOString?.() || row.createDate || "",
    updatedAt: row.lastDate?.toISOString?.() || row.lastDate || "",
  };
}

function mapOptionGroup(row) {
  return {
    groupId: String(row.optionGroupId),
    optionGroupId: row.optionGroupId,
    name: row.optionGroupName,
    choiceType: row.choiceType || "S",
    isRequired: row.isRequired === true,
    minSelect: Number(row.minSelect || 0),
    maxSelect: Number(row.maxSelect || 1),
    sortOrder: Number(row.sortOrder || 0),
    enabled: row.isActive !== false,
  };
}

function mapOptionGroupOptions(group) {
  return (group.optionItem || []).map((row) => ({
    groupId: String(group.optionGroupId),
    optionGroupId: group.optionGroupId,
    groupName: group.optionGroupName,
    choiceType: group.choiceType || "S",
    value: String(row.optionItemId),
    optionItemId: row.optionItemId,
    label: row.optionItemName,
    price: Number(row.extraPrice || 0),
    sortOrder: Number(row.sortOrder || 0),
    enabled: group.isActive !== false && row.isActive !== false,
    createdAt: row.createDate?.toISOString?.() || row.createDate || "",
    updatedAt: row.lastDate?.toISOString?.() || row.lastDate || "",
  }));
}

function mapOrder(row) {
  return {
    orderId: row.orderNo,
    orderNo: row.orderNo,
    orderDbId: row.orderId,
    createdAt: row.createDate?.toISOString?.() || row.createDate || "",
    customer: {
      userId: row.user?.lineToken || "",
      displayName: row.customerName || row.user?.name || "",
    },
    total: Number(row.totalAmount || 0),
    status: row.orderStatus || "",
    paymentStatus: row.paymentStatus || "",
    lineMessageId: "",
    note: row.remark || "",
    items: (row.orderItem || []).map((item, index) => {
      const optionSummary = (item.orderItemOption || [])
        .map((option) => option.optionItemName)
        .filter(Boolean)
        .join(" · ");

      return {
        id: item.orderItemId,
        orderId: item.orderId,
        lineNo: index + 1,
        productId: String(item.menuId),
        productName: item.menuName,
        qty: Number(item.quantity || 1),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.totalPrice || 0),
        price: Number(item.totalPrice || 0),
        optionSummary,
        summary: optionSummary,
        note: item.remark || "",
        options: (item.orderItemOption || []).reduce((acc, option) => {
          acc[String(option.optionGroupId)] = String(option.optionItemId);
          return acc;
        }, {}),
        createdAt: row.createDate?.toISOString?.() || row.createDate || "",
      };
    }),
  };
}

async function syncOptionGroups(tx, options, now) {
  const grouped = options.reduce((acc, item) => {
    const groupKey = String(item.groupId || item.optionGroupId || item.groupName || "").trim();
    if (!groupKey) return acc;
    if (!acc.has(groupKey)) acc.set(groupKey, []);
    acc.get(groupKey).push(item);
    return acc;
  }, new Map());
  const groupIdMap = new Map();
  const activeGroupIds = [];

  for (const [groupKey, rows] of grouped.entries()) {
    const sample = rows[0] || {};
    const optionGroupId = toInt(sample.optionGroupId || groupKey);
    const groupData = {
      optionGroupName: String(sample.groupName || sample.optionGroupName || groupKey),
      choiceType: String(sample.choiceType || "S").slice(0, 1),
      isRequired: sample.isRequired === true,
      minSelect: Number(sample.minSelect || 0),
      maxSelect: Number(sample.maxSelect || 1),
      sortOrder: Number(sample.groupSortOrder || sample.sortOrder || 0),
      isActive: sample.groupEnabled !== false,
      lastDate: now,
      lastUser: "admin",
    };

    const group = optionGroupId
      ? await tx.optionGroup.update({ where: { optionGroupId }, data: groupData })
      : await tx.optionGroup.create({ data: { ...groupData, createDate: now, createUser: "admin" } });

    activeGroupIds.push(group.optionGroupId);
    groupIdMap.set(groupKey, group.optionGroupId);
    groupIdMap.set(String(group.optionGroupId), group.optionGroupId);

    const activeItemIds = [];
    for (const item of rows) {
      const optionItemId = toInt(item.optionItemId || item.value);
      const itemData = {
        optionGroupId: group.optionGroupId,
        optionItemName: String(item.label || item.optionItemName || "ตัวเลือกใหม่"),
        extraPrice: toDecimal(item.price || item.extraPrice || 0),
        sortOrder: Number(item.sortOrder || 0),
        isActive: item.enabled !== false,
        lastDate: now,
        lastUser: "admin",
      };
      const saved = optionItemId
        ? await tx.optionItem.update({ where: { optionItemId }, data: itemData })
        : await tx.optionItem.create({ data: { ...itemData, createDate: now, createUser: "admin" } });
      activeItemIds.push(saved.optionItemId);
    }

    if (activeItemIds.length) {
      await tx.optionItem.updateMany({
        where: { optionGroupId: group.optionGroupId, optionItemId: { notIn: activeItemIds } },
        data: { isActive: false, lastDate: now, lastUser: "admin" },
      });
    }
  }

  if (activeGroupIds.length) {
    await tx.optionGroup.updateMany({
      where: { optionGroupId: { notIn: activeGroupIds } },
      data: { isActive: false, lastDate: now, lastUser: "admin" },
    });
  }

  return groupIdMap;
}

async function ensureCategory(tx, categoryIdOrName, fallbackName, now) {
  const categoryId = toInt(categoryIdOrName);
  if (categoryId) {
    return tx.category.update({
      where: { categoryId },
      data: { categoryName: String(fallbackName || `หมวด ${categoryId}`), isActive: true, lastDate: now, lastUser: "admin" },
    });
  }

  const categoryName = String(fallbackName || categoryIdOrName || "ทั่วไป").trim() || "ทั่วไป";
  const existing = await tx.category.findFirst({ where: { categoryName } });
  if (existing) {
    return tx.category.update({
      where: { categoryId: existing.categoryId },
      data: { isActive: true, lastDate: now, lastUser: "admin" },
    });
  }

  return tx.category.create({
    data: {
      categoryName,
      sortOrder: 0,
      isActive: true,
      createDate: now,
      createUser: "admin",
      lastDate: now,
      lastUser: "admin",
    },
  });
}

async function ensureSubCategory(tx, categoryId, subCategoryIdOrName, fallbackName, now) {
  const subCategoryId = toInt(subCategoryIdOrName);
  if (subCategoryId) {
    await tx.subCategory.update({
      where: { subCategoryId },
      data: { categoryId, subCategoryName: String(fallbackName || `กลุ่มย่อย ${subCategoryId}`), isActive: true, lastDate: now, lastUser: "admin" },
    });
    return subCategoryId;
  }

  const subCategoryName = String(fallbackName || "").trim();
  if (!subCategoryName) return null;

  const existing = await tx.subCategory.findFirst({ where: { categoryId, subCategoryName } });
  if (existing) return existing.subCategoryId;

  const saved = await tx.subCategory.create({
    data: {
      categoryId,
      subCategoryName,
      sortOrder: 0,
      isActive: true,
      createDate: now,
      createUser: "admin",
      lastDate: now,
      lastUser: "admin",
    },
  });
  return saved.subCategoryId;
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

function toInt(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
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
