import { getGroupLabel, getGroupPrice, getProductById, products } from "./catalog.js";

const STORAGE_KEY = "devcafe_local_orders_v1";

export async function fetchBootstrap(config, lineUser) {
  if (!config.apiUrl) {
    return {
      source: "local",
      menu: readLocalMenu(),
      orders: readLocalOrders(),
      profile: lineUser,
      settings: readLocalSettings(),
    };
  }

  const url = new URL(config.apiUrl);
  url.searchParams.set("action", "bootstrap");
  if (lineUser?.userId) url.searchParams.set("userId", lineUser.userId);
  const res = await fetch(url, { credentials: "omit" });
  return res.json();
}

export async function createOrder(config, payload) {
  if (!config.apiUrl) {
    const order = makeLocalOrder(payload);
    const orders = readLocalOrders();
    orders.unshift(order);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    return makeResponse(order, readLocalSettings());
  }

  const res = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "createOrder", payload }),
  });
  return res.json();
}

export async function saveAdminState(config, payload) {
  if (!config.apiUrl) {
    localStorage.setItem("devcafe_local_settings_v1", JSON.stringify(payload.settings || {}));
    localStorage.setItem("devcafe_local_menu_v1", JSON.stringify(payload.menu || products));
    return { ok: true, source: "local" };
  }

  const res = await fetch(config.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveAdminState", payload }),
  });
  return res.json();
}

function readLocalOrders() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function readLocalSettings() {
  const raw = localStorage.getItem("devcafe_local_settings_v1");
  return raw
    ? JSON.parse(raw)
    : {
        paymentQrUrl:
          "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=PAYMENT-QR-DEMO",
      paymentHint: "โหมด demo: ตั้งค่า QR จริงได้ในหน้าแอดมิน",
      };
}

function readLocalMenu() {
  const raw = localStorage.getItem("devcafe_local_menu_v1");
  return raw ? JSON.parse(raw) : products;
}

function makeLocalOrder(payload) {
  const orderId = `OC${Date.now().toString().slice(-8)}`;
  const items = payload.items.map((item) => {
    const product = getProductById(item.productId);
    return {
      ...item,
      productName: product?.name ?? item.productId,
      line: {
        sweetness: getGroupLabel("sweetness", item.options?.sweetness ?? ""),
        milk: getGroupLabel("milk", item.options?.milk ?? ""),
        roast: getGroupLabel("roast", item.options?.roast ?? ""),
        matcha: getGroupLabel("matcha", item.options?.matcha ?? ""),
        waterSplit: getGroupLabel("waterSplit", item.options?.waterSplit ?? ""),
      },
    };
  });

  return {
    orderId,
    createdAt: new Date().toISOString(),
    customer: payload.customer,
    items,
    total: payload.total,
    status: "pending-payment",
  };
}

function makeResponse(order, settings) {
  const flexMessage = buildFlexMessage(order);
  return {
    ok: true,
    source: "local",
    order,
    flexMessage,
    paymentQrUrl: settings.paymentQrUrl,
    paymentHint: settings.paymentHint,
  };
}

export function buildFlexMessage(order) {
  return {
    type: "flex",
    altText: `Order ${order.orderId} total ${order.total}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "DevCafe Order Confirmed",
            weight: "bold",
            size: "xl",
            wrap: true,
          },
          { type: "text", text: `Order No. ${order.orderId}`, color: "#8a4f2a" },
          {
            type: "separator",
            margin: "md",
          },
          ...order.items.slice(0, 4).map((item) => ({
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              {
                type: "text",
                text: `${item.qty} x ${item.productName}`,
                weight: "bold",
                wrap: true,
              },
              {
                type: "text",
                text: item.summary,
                size: "sm",
                color: "#666666",
                wrap: true,
              },
            ],
          })),
          {
            type: "separator",
            margin: "md",
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "Total",
                color: "#666666",
              },
              {
                type: "text",
                text: `฿${order.total}`,
                weight: "bold",
                align: "end",
              },
            ],
          },
        ],
      },
    },
  };
}
