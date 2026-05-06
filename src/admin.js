import { optionGroups, products } from "./catalog.js";
import { fetchBootstrap, saveAdminState } from "./api.js";
import { appConfig as config } from "./config.js";

const state = {
  menu: structuredClone(products),
  settings: {
    paymentQrUrl:
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=PAYMENT-QR-DEMO",
    paymentHint: "โหมด demo: ตั้งค่า QR จริงได้ในหน้าแอดมิน",
  },
  orders: [],
};

const el = {
  menu: document.getElementById("admin-menu"),
  orders: document.getElementById("admin-orders"),
  sync: document.getElementById("sync-menu"),
};

await bootstrap();
render();
bindEvents();

async function bootstrap() {
  try {
    const data = await fetchBootstrap(config, null);
    state.menu = data.menu?.length ? normalizeMenu(data.menu) : state.menu;
    state.orders = data.orders ?? state.orders;
    state.settings = data.settings ?? state.settings;
  } catch (error) {
    console.warn("Admin bootstrap failed", error);
  }
}

function bindEvents() {
  el.sync.addEventListener("click", async () => {
    const payload = {
      menu: state.menu,
      settings: state.settings,
    };
    await saveAdminState(config, payload);
    alert("บันทึก settings แล้ว");
  });
}

function render() {
  renderMenu();
  renderOrders();
}

function renderMenu() {
  el.menu.innerHTML = `
    <div class="admin-card">
      <h3>Payment</h3>
      <p class="admin-meta">ใช้ QR image URL ที่ลูกค้าสแกนได้</p>
      <div class="admin-form">
        <label class="field">
          <span>QR URL</span>
          <input id="paymentQrUrl" value="${escapeAttr(state.settings.paymentQrUrl)}" />
        </label>
        <label class="field">
          <span>ข้อความกำกับ</span>
          <input id="paymentHint" value="${escapeAttr(state.settings.paymentHint)}" />
        </label>
      </div>
    </div>

    ${state.menu
      .map(
        (item, index) => `
        <article class="admin-card">
          <div class="section-head">
            <div>
              <h3>${item.name}</h3>
              <p class="admin-meta">${item.category} · ${item.description}</p>
            </div>
            <strong>฿${item.basePrice}</strong>
          </div>
          <div class="admin-grid">
            <label class="field">
              <span>ราคา</span>
              <input type="number" data-baseprice="${index}" value="${item.basePrice}" />
            </label>
            <label class="field">
              <span>สถานะ</span>
              <select data-enabled="${index}">
                <option value="true" ${item.enabled !== false ? "selected" : ""}>เปิด</option>
                <option value="false" ${item.enabled === false ? "selected" : ""}>ปิด</option>
              </select>
            </label>
          </div>
          <small>Option groups: ${(item.fields || []).join(", ") || "-"}</small>
        </article>
      `,
      )
      .join("")}
  `;
  const qr = document.getElementById("paymentQrUrl");
  const hint = document.getElementById("paymentHint");
  qr?.addEventListener("input", () => {
    state.settings.paymentQrUrl = qr.value;
  });
  hint?.addEventListener("input", () => {
    state.settings.paymentHint = hint.value;
  });
  el.menu.querySelectorAll("[data-baseprice]").forEach((input) => {
    input.addEventListener("input", () => {
      state.menu[Number(input.dataset.baseprice)].basePrice = Number(input.value);
    });
  });
  el.menu.querySelectorAll("[data-enabled]").forEach((select) => {
    select.addEventListener("change", () => {
      state.menu[Number(select.dataset.enabled)].enabled = select.value === "true";
    });
  });
}

function normalizeMenu(menu) {
  return menu.map((item) => ({
    ...item,
    basePrice: Number(item.basePrice || 0),
    enabled: item.enabled !== false && item.enabled !== "false",
    fields: Array.isArray(item.fields)
      ? item.fields
      : String(item.fields || "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean),
  }));
}

function renderOrders() {
  if (!state.orders.length) {
    el.orders.innerHTML = `<div class="admin-card"><p class="admin-meta">ยังไม่มีออเดอร์</p></div>`;
    return;
  }

  el.orders.innerHTML = state.orders
    .slice(0, 10)
    .map(
      (order) => `
        <article class="admin-card">
          <div class="section-head">
            <div>
              <h3>${order.orderId}</h3>
              <p class="admin-meta">${order.customer?.displayName ?? "Unknown customer"}</p>
            </div>
            <strong>฿${order.total}</strong>
          </div>
          <table class="table">
            <tbody>
              ${order.items
                .map(
                  (item) => `
                    <tr>
                      <td>${item.qty} x ${item.productName}</td>
                      <td>${item.summary}</td>
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </article>
      `,
    )
    .join("");
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
