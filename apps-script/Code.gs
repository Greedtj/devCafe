const SHEETS = {
  menu: {
    name: "menu_master",
    headers: ["id", "category", "name", "description", "basePrice", "enabled", "fields", "imageUrl", "createdAt", "updatedAt"],
  },
  options: {
    name: "option_master",
    headers: ["groupId", "value", "label", "price", "sortOrder", "enabled", "createdAt", "updatedAt"],
  },
  orders: {
    name: "orders",
    headers: ["orderId", "createdAt", "userId", "displayName", "total", "status", "paymentStatus", "lineMessageId", "note"],
  },
  items: {
    name: "order_items",
    headers: ["orderId", "lineNo", "productId", "productName", "qty", "unitPrice", "lineTotal", "optionSummary", "note", "rawOptions", "createdAt"],
  },
  customers: {
    name: "customers",
    headers: ["userId", "displayName", "pictureUrl", "firstSeenAt", "lastSeenAt"],
  },
  settings: {
    name: "settings",
    headers: ["key", "value", "updatedAt"],
  },
};

function doGet(e) {
  const action = String(e?.parameter?.action || "bootstrap").toLowerCase();

  if (action === "health") {
    return json_({ ok: true, ts: new Date().toISOString() });
  }

  if (action === "setup") {
    return json_(setupWorkbook_());
  }

  if (action === "bootstrap") {
    return json_(
      bootstrap_({
        userId: e?.parameter?.userId || "",
        displayName: e?.parameter?.displayName || "",
        pictureUrl: e?.parameter?.pictureUrl || "",
      })
    );
  }

  if (action === "orders") {
    return json_({ ok: true, orders: readOrders_(e?.parameter?.userId || "") });
  }

  if (action === "menu") {
    return json_({ ok: true, menu: readMenu_(), options: readOptions_(), settings: readSettings_() });
  }

  return json_({ ok: false, error: "Unknown action" });
}

function doPost(e) {
  const body = JSON.parse(e?.postData?.contents || "{}");
  const action = String(body.action || "").toLowerCase();

  if (action === "createorder") {
    return json_(createOrder_(body.payload || {}));
  }

  if (action === "saveadminstate") {
    return json_(saveAdminState_(body.payload || {}));
  }

  if (action === "resetdemodata") {
    return json_(resetDemoData_());
  }

  return json_({ ok: false, error: "Unknown action" });
}

function bootstrap_(user) {
  setupWorkbook_();

  if (user && user.userId) {
    upsertCustomer_(user);
  }

  return {
    ok: true,
    profile: user,
    menu: readMenu_(),
    options: readOptions_(),
    settings: readSettings_(),
    orders: readOrders_(user?.userId || ""),
  };
}

function createOrder_(payload) {
  setupWorkbook_();

  const customer = payload.customer || {};
  if (!customer.userId) {
    return { ok: false, error: "missing userId" };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    return { ok: false, error: "missing items" };
  }

  const orderId = `OC${Date.now().toString().slice(-8)}`;
  const createdAt = new Date().toISOString();
  const total = Number(payload.total || 0);
  const status = "pending-payment";
  const paymentStatus = "unpaid";
  const note = String(payload.note || "").trim();

  const ordersSheet = sheet_(SHEETS.orders);
  const itemsSheet = sheet_(SHEETS.items);

  ordersSheet.appendRow([
    orderId,
    createdAt,
    customer.userId || "",
    customer.displayName || "",
    total,
    status,
    paymentStatus,
    "",
    note,
  ]);

  items.forEach((item, index) => {
    const quantity = Number(item.qty || 1);
    const unitPrice = Number(item.unitPrice ?? (quantity ? Number(item.price || 0) / quantity : 0));
    const lineTotal = Number(item.price ?? unitPrice * quantity);
    itemsSheet.appendRow([
      orderId,
      index + 1,
      item.productId || "",
      item.productName || item.productId || "",
      quantity,
      unitPrice,
      lineTotal,
      String(item.summary || ""),
      String(item.note || ""),
      JSON.stringify(item.options || {}),
      createdAt,
    ]);
  });

  upsertCustomer_({
    userId: customer.userId,
    displayName: customer.displayName || "",
    pictureUrl: customer.pictureUrl || "",
    firstSeenAt: customer.firstSeenAt || createdAt,
    lastSeenAt: createdAt,
  });

  const order = {
    orderId,
    createdAt,
    customer,
    items,
    total,
    status,
    paymentStatus,
    note,
  };

  const flexMessage = buildFlexMessage_(order);
  const sendResult = sendLineOrderConfirmation_(customer.userId, order);

  return {
    ok: true,
    order,
    flexMessage,
    sendResult,
  };
}

function saveAdminState_(payload) {
  setupWorkbook_();

  const settings = payload.settings || {};
  const menu = Array.isArray(payload.menu) ? payload.menu : [];

  writeTable_(SHEETS.menu, menu.map((item) => [
    item.id || "",
    item.category || "",
    item.name || "",
    item.description || "",
    item.basePrice ?? 0,
    item.enabled !== false,
    Array.isArray(item.fields) ? item.fields.join(",") : item.fields || "",
    item.imageUrl || "",
    item.createdAt || "",
    new Date().toISOString(),
  ]));

  if (Array.isArray(payload.options)) {
    writeTable_(SHEETS.options, payload.options.map((item) => [
      item.groupId || "",
      item.value || "",
      item.label || "",
      item.price ?? 0,
      item.sortOrder ?? 0,
      item.enabled !== false,
      item.createdAt || "",
      new Date().toISOString(),
    ]));
  }

  return { ok: true };
}

function setupWorkbook_() {
  const created = [];
  Object.values(SHEETS).forEach((schema) => {
    const sheet = ensureSheet_(schema.name, schema.headers);
    created.push({ name: schema.name, rows: sheet.getLastRow(), columns: sheet.getLastColumn() });
  });
  return { ok: true, sheets: created };
}

function resetDemoData_() {
  setupWorkbook_();

  Object.values(SHEETS).forEach((schema) => {
    const sheet = sheet_(schema);
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), schema.headers.length)).clearContent();
    }
  });

  return { ok: true, reset: true };
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
  return readSheetObjects_(SHEETS.menu).map((row) => ({
    ...row,
    basePrice: Number(row.basePrice || 0),
    enabled: String(row.enabled) !== "false",
    fields: String(row.fields || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  }));
}

function readOptions_() {
  return readSheetObjects_(SHEETS.options).map((row) => ({
    ...row,
    price: Number(row.price || 0),
    sortOrder: Number(row.sortOrder || 0),
    enabled: String(row.enabled) !== "false",
  }));
}

function readOrders_(userId) {
  const rows = readSheetObjects_(SHEETS.orders);
  if (!rows.length) return [];

  const items = readSheetObjects_(SHEETS.items);
  return rows
    .filter((row) => !userId || row.userId === userId)
    .reverse()
    .map((order) => ({
      ...order,
      total: Number(order.total || 0),
      items: items
        .filter((item) => item.orderId === order.orderId)
        .map((item) => ({
          ...item,
          qty: Number(item.qty || 1),
          unitPrice: Number(item.unitPrice || 0),
          lineTotal: Number(item.lineTotal || 0),
        })),
    }));
}

function readSettings_() {
  const rows = readSheetObjects_(SHEETS.settings);
  const map = {};
  rows.forEach((row) => {
    map[row.key] = row.value;
  });

  return map;
}

function buildFlexMessage_(order) {
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
      item.summary
        ? { type: "text", text: item.summary, size: "xs", color: "#666666", wrap: true }
        : null,
      item.note
        ? { type: "text", text: `หมายเหตุ: ${item.note}`, size: "xs", color: "#8a4f2a", wrap: true }
        : null,
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
        ].filter(Boolean),
      },
    },
  };
}

function ensureSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const currentHeaders = sheet.getLastRow() > 0 ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0] : [];
  const hasHeaders = currentHeaders.length && currentHeaders.some((value) => value !== "");

  if (!hasHeaders && headers.length) {
    sheet.clear();
    sheet.appendRow(headers);
  } else if (sheet.getLastColumn() < headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}

function writeTable_(schema, rows) {
  const sheet = ensureSheet_(schema.name, schema.headers);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), schema.headers.length)).clearContent();
  }
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, schema.headers.length).setValues(rows);
}

function readSheetObjects_(schema) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(schema.name);
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

function sheet_(schema) {
  return ensureSheet_(schema.name, schema.headers);
}

function upsertSetting_(key, value) {
  const sheet = ensureSheet_(SHEETS.settings.name, SHEETS.settings.headers);
  const values = sheet.getDataRange().getValues();

  for (let i = 1; i < values.length; i += 1) {
    if (values[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      sheet.getRange(i + 1, 3).setValue(new Date().toISOString());
      return;
    }
  }

  sheet.appendRow([key, value, new Date().toISOString()]);
}

function upsertCustomer_(customer) {
  const sheet = ensureSheet_(SHEETS.customers.name, SHEETS.customers.headers);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);

  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i][0] === customer.userId) {
      sheet.getRange(i + 2, 2).setValue(customer.displayName || "");
      sheet.getRange(i + 2, 3).setValue(customer.pictureUrl || "");
      if (!rows[i][3]) {
        sheet.getRange(i + 2, 4).setValue(customer.firstSeenAt || new Date().toISOString());
      }
      sheet.getRange(i + 2, 5).setValue(customer.lastSeenAt || new Date().toISOString());
      return;
    }
  }

  sheet.appendRow([
    customer.userId || "",
    customer.displayName || "",
    customer.pictureUrl || "",
    customer.firstSeenAt || new Date().toISOString(),
    customer.lastSeenAt || new Date().toISOString(),
  ]);
}

function sendLineOrderConfirmation_(userId, order) {
  const accessToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  if (!accessToken) {
    return { ok: false, skipped: true, reason: "missing LINE_CHANNEL_ACCESS_TOKEN" };
  }

  const messages = [buildFlexMessage_(order)];

  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    payload: JSON.stringify({
      to: userId,
      messages,
    }),
    muteHttpExceptions: true,
  });

  return {
    ok: response.getResponseCode() >= 200 && response.getResponseCode() < 300,
    statusCode: response.getResponseCode(),
    body: response.getContentText(),
  };
}

function json_(payload) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
