import { getGroupLabel } from "./catalog";

const STORAGE_KEY = "devcafe_cart_v2";
const SETTINGS_KEY = "devcafe_settings_v2";
const MENU_KEY = "devcafe_menu_v2";
const ORDERS_KEY = "devcafe_orders_v2";

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || "";
}

export function defaultSettings() {
  return {};
}

export async function bootstrapApi(user) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      source: "local",
      menu: readLocalMenu(),
      orders: readLocalOrders(),
      settings: readLocalSettings(),
      profile: user,
    };
  }

  const url = buildRequestUrl(apiBaseUrl);
  url.searchParams.set("action", "bootstrap");
  if (user?.userId) url.searchParams.set("userId", user.userId);
  if (user?.displayName) url.searchParams.set("displayName", user.displayName);
  if (user?.pictureUrl) url.searchParams.set("pictureUrl", user.pictureUrl);
  const response = await fetch(url.toString(), { credentials: "omit" });
  return response.json();
}

export async function fetchMenuApi() {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      ok: true,
      source: "local",
      menu: readLocalMenu(),
      options: [],
      settings: readLocalSettings(),
    };
  }

  const url = buildRequestUrl(apiBaseUrl);
  url.searchParams.set("action", "menu");
  const response = await fetch(url.toString(), { credentials: "omit" });
  return response.json();
}

export async function fetchOrdersApi(userId = "") {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return {
      ok: true,
      source: "local",
      orders: readLocalOrders(),
    };
  }

  const url = buildRequestUrl(apiBaseUrl);
  url.searchParams.set("action", "orders");
  if (userId) url.searchParams.set("userId", userId);
  const response = await fetch(url.toString(), { credentials: "omit" });
  return response.json();
}

export async function submitOrder(payload) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    const order = createLocalOrder(payload);
    const orders = readLocalOrders();
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
    return {
      ok: true,
      source: "local",
      order,
      flexMessage: buildFlexMessage(order),
    };
  }

  const response = await fetch(apiBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "createOrder", payload }),
  });
  return response.json();
}

export async function saveAdminState(payload) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(payload.settings || defaultSettings()));
    localStorage.setItem(MENU_KEY, JSON.stringify(payload.menu || []));
    return { ok: true, source: "local" };
  }

  const response = await fetch(apiBaseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveAdminState", payload }),
  });
  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Request failed with status ${response.status}`);
  }
  return data;
}

function buildRequestUrl(apiBaseUrl) {
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    return new URL(apiBaseUrl);
  }
  return new URL(apiBaseUrl, window.location.origin);
}

export function createLocalOrder(payload) {
  const orderId = `OC${Date.now().toString().slice(-8)}`;
  const items = (payload.items || []).map((item) => ({
    ...item,
    productName: item.productName || item.productId,
    summary: item.summary || buildItemSummary(item),
  }));

  return {
    orderId,
    createdAt: new Date().toISOString(),
    customer: payload.customer,
    items,
    total: payload.total,
    status: "pending-payment",
    paymentStatus: "unpaid",
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
          { type: "text", text: "DevCafe Order Confirmed", weight: "bold", size: "xl", wrap: true },
          { type: "text", text: `Order No. ${order.orderId}`, color: "#8a4f2a" },
          { type: "separator", margin: "md" },
          ...order.items.slice(0, 4).map((item) => ({
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              { type: "text", text: `${item.qty} x ${item.productName}`, weight: "bold", wrap: true },
              { type: "text", text: item.summary, size: "sm", color: "#666666", wrap: true },
            ],
          })),
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              { type: "text", text: "Total", color: "#666666" },
              { type: "text", text: `฿${order.total}`, weight: "bold", align: "end" },
            ],
          },
        ],
      },
    },
  };
}

function buildItemSummary(item) {
  const parts = [];
  Object.entries(item.options || {}).forEach(([groupId, value]) => {
    const label = getGroupLabel(groupId, value);
    if (label) parts.push(label);
  });
  if (item.note) parts.push(item.note);
  return parts.join(" · ");
}

function readLocalMenu() {
  const raw = localStorage.getItem(MENU_KEY);
  return raw ? JSON.parse(raw) : [];
}

function readLocalOrders() {
  const raw = localStorage.getItem(ORDERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function readLocalSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  return raw ? JSON.parse(raw) : defaultSettings();
}
