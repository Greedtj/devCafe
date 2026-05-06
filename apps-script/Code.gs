const SHEET_NAMES = {
  menu: "menu_master",
  options: "option_master",
  orders: "orders",
  items: "order_items",
  customers: "customers",
  settings: "settings",
  admins: "admins",
};

function doGet(e) {
  const action = (e.parameter.action || "bootstrap").toLowerCase();
  if (action === "health") {
    return json_({ ok: true, ts: new Date().toISOString() });
  }
  if (action === "bootstrap") {
    return json_(bootstrap_());
  }
  if (action === "orders") {
    return json_({ ok: true, orders: readOrders_(e.parameter.userId) });
  }
  if (action === "menu") {
    return json_({ ok: true, menu: readMenu_(), options: readOptions_(), settings: readSettings_() });
  }
  return json_({ ok: false, error: "Unknown action" });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents || "{}");
  const action = (body.action || "").toLowerCase();
  if (action === "createorder") {
    return json_(createOrder_(body.payload));
  }
  if (action === "saveadminstate") {
    return json_(saveAdminState_(body.payload));
  }
  return json_({ ok: false, error: "Unknown action" });
}

function bootstrap_() {
  return {
    ok: true,
    menu: readMenu_(),
    options: readOptions_(),
    settings: readSettings_(),
    orders: readOrders_(),
  };
}

function createOrder_(payload) {
  const ordersSheet = ensureSheet_(SHEET_NAMES.orders, [
    "orderId",
    "createdAt",
    "userId",
    "displayName",
    "total",
    "status",
  ]);
  const itemsSheet = ensureSheet_(SHEET_NAMES.items, [
    "orderId",
    "productId",
    "productName",
    "qty",
    "price",
    "summary",
  ]);
  const customersSheet = ensureSheet_(SHEET_NAMES.customers, [
    "userId",
    "displayName",
    "lastSeenAt",
  ]);

  const orderId = `OC${Date.now().toString().slice(-8)}`;
  const createdAt = new Date().toISOString();
  const customer = payload.customer || {};
  const items = (payload.items || []).map((item) => ({
    ...item,
    productName: item.productName || item.productId,
  }));
  const total = Number(payload.total || 0);

  ordersSheet.appendRow([
    orderId,
    createdAt,
    customer.userId || "",
    customer.displayName || "",
    total,
    "pending-payment",
  ]);

  items.forEach((item) => {
    itemsSheet.appendRow([
      orderId,
      item.productId,
      item.productName,
      item.qty,
      item.price,
      item.summary || "",
    ]);
  });

  if (customer.userId) {
    customersSheet.appendRow([customer.userId, customer.displayName || "", createdAt]);
  }

  const order = {
    orderId,
    createdAt,
    customer,
    items,
    total,
    status: "pending-payment",
  };
  const flexMessage = buildFlexMessage_(order);
  return {
    ok: true,
    order,
    flexMessage,
    paymentQrUrl: getSetting_("paymentQrUrl") || "",
    paymentHint: getSetting_("paymentHint") || "Scan QR to pay",
  };
}

function saveAdminState_(payload) {
  const settings = payload.settings || {};
  const menu = Array.isArray(payload.menu) ? payload.menu : [];
  writeTable_(SHEET_NAMES.menu, [
    "id",
    "category",
    "name",
    "description",
    "basePrice",
    "enabled",
    "fields",
  ], menu.map((item) => [
    item.id || "",
    item.category || "",
    item.name || "",
    item.description || "",
    item.basePrice ?? 0,
    item.enabled !== false,
    Array.isArray(item.fields) ? item.fields.join(",") : item.fields || "",
  ]));
  upsertSetting_("paymentQrUrl", settings.paymentQrUrl || "");
  upsertSetting_("paymentHint", settings.paymentHint || "");
  return { ok: true };
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty("SPREADSHEET_ID");
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty("SPREADSHEET_ID", active.getId());
    return active;
  }

  const created = SpreadsheetApp.create("DevCafe Orders");
  props.setProperty("SPREADSHEET_ID", created.getId());
  return created;
}

function readMenu_() {
  const rows = readSheetObjects_(SHEET_NAMES.menu).map((row) => ({
    ...row,
    basePrice: Number(row.basePrice || 0),
    enabled: String(row.enabled) !== "false",
    fields: String(row.fields || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  }));
  if (rows.length) return rows;
  return [
    {
      id: "coffee-americano",
      category: "coffee",
      name: "Americano",
      description: "กาแฟดำหอมละมุน",
      basePrice: 55,
      enabled: true,
      fields: ["sweetness", "milk", "roast", "waterSplit"],
    },
  ];
}

function readOptions_() {
  return readSheetObjects_(SHEET_NAMES.options);
}

function readOrders_(userId) {
  const rows = readSheetObjects_(SHEET_NAMES.orders);
  if (!rows.length) return [];
  const items = readSheetObjects_(SHEET_NAMES.items);
  return rows
    .filter((row) => !userId || row.userId === userId)
    .reverse()
    .map((order) => ({
      ...order,
      items: items.filter((item) => item.orderId === order.orderId),
    }));
}

function readSettings_() {
  const rows = readSheetObjects_(SHEET_NAMES.settings);
  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });
  return {
    paymentQrUrl:
      map.paymentQrUrl ||
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=PAYMENT-QR-DEMO",
    paymentHint: map.paymentHint || "โหมด demo: ตั้งค่า QR จริงได้ในหน้าแอดมิน",
  };
}

function buildFlexMessage_(order) {
  return {
    type: "flex",
    altText: `Order ${order.orderId} total ${order.total}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "Order Confirmed", weight: "bold", size: "xl" },
          { type: "text", text: order.orderId, color: "#8a4f2a" },
        ],
      },
    },
  };
}

function ensureSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0 && headers.length) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function writeTable_(name, headers, rows) {
  const sheet = ensureSheet_(name, headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), headers.length)).clearContent();
  }
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function readSheetObjects_(name) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  return rows
    .filter((row) => row.some((value) => value !== ""))
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
}

function getSetting_(key) {
  const rows = readSheetObjects_(SHEET_NAMES.settings);
  const found = rows.find((row) => row.key === key);
  return found ? found.value : "";
}

function upsertSetting_(key, value) {
  const sheet = ensureSheet_(SHEET_NAMES.settings, ["key", "value"]);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    if (values[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function json_(payload, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
