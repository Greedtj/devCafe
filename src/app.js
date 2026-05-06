import { categories, getGroupLabel, getGroupPrice, getProductById, optionGroups, products } from "./catalog.js";
import { createOrder, fetchBootstrap } from "./api.js";
import { appConfig as config } from "./config.js";

const state = {
  category: categories[0].id,
  selectedProduct: null,
  cart: loadCart(),
  user: { userId: "demo-user", displayName: "Guest" },
  settings: {
    paymentQrUrl:
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=PAYMENT-QR-DEMO",
    paymentHint: "โหมด demo: ตั้งค่า QR จริงได้ในหน้าแอดมิน",
  },
};

const el = {
  tabs: document.getElementById("category-tabs"),
  grid: document.getElementById("menu-grid"),
  cartList: document.getElementById("cart-list"),
  cartCount: document.getElementById("cart-count"),
  cartTotal: document.getElementById("cart-total"),
  checkoutBtn: document.getElementById("checkout-btn"),
  userChip: document.getElementById("user-chip"),
  dialog: document.getElementById("product-dialog"),
  dialogTitle: document.getElementById("dialog-title"),
  dialogDesc: document.getElementById("dialog-desc"),
  optionFields: document.getElementById("option-fields"),
  note: document.getElementById("note"),
  qty: document.getElementById("qty"),
  addToCartBtn: document.getElementById("add-to-cart-btn"),
  checkoutDialog: document.getElementById("checkout-dialog"),
  checkoutSummary: document.getElementById("checkout-summary"),
  submitOrderBtn: document.getElementById("submit-order"),
  responsePanel: document.getElementById("response-panel"),
  flexPreview: document.getElementById("flex-preview"),
  paymentQr: document.getElementById("payment-qr"),
  paymentText: document.getElementById("payment-text"),
  closeCheckout: document.getElementById("close-checkout"),
  backToCart: document.getElementById("back-to-cart"),
};

await bootstrap();
render();
bindEvents();

async function bootstrap() {
  try {
    const lineUser = await tryInitLiff();
    if (lineUser) state.user = lineUser;
    const data = await fetchBootstrap(config, state.user);
    state.settings = data.settings ?? state.settings;
    if (data.profile?.displayName) state.user = data.profile;
    if (data.menu?.length) {
      // Local demo uses built-in catalog, but backend can override later.
    }
  } catch (error) {
    console.warn("Bootstrap failed, running offline demo.", error);
  }
}

async function tryInitLiff() {
  const liff = window.liff;
  if (!liff || !config.liffId) return null;
  await liff.init({ liffId: config.liffId, withLoginOnExternalBrowser: true });
  if (!liff.isLoggedIn()) liff.login();
  const profile = await liff.getProfile();
  return profile;
}

function bindEvents() {
  el.tabs.addEventListener("click", onCategoryClick);
  el.grid.addEventListener("click", onMenuClick);
  el.cartList.addEventListener("click", onCartClick);
  el.checkoutBtn.addEventListener("click", openCheckout);
  el.submitOrderBtn.addEventListener("click", submitOrder);
  el.closeCheckout.addEventListener("click", () => el.checkoutDialog.close());
  el.backToCart.addEventListener("click", () => el.checkoutDialog.close());
  el.optionFields.addEventListener("change", updatePreviewPrice);
}

function onCategoryClick(event) {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  render();
}

function onMenuClick(event) {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = getProductById(button.dataset.add);
  state.selectedProduct = product;
  el.dialogTitle.textContent = product.name;
  el.dialogDesc.textContent = product.description;
  renderOptionFields(product);
  el.note.value = "";
  el.qty.value = "1";
  el.dialog.showModal();
}

function onCartClick(event) {
  const removeBtn = event.target.closest("[data-remove]");
  const decBtn = event.target.closest("[data-dec]");
  const incBtn = event.target.closest("[data-inc]");
  if (removeBtn) {
    state.cart.splice(Number(removeBtn.dataset.remove), 1);
    persistCart();
    render();
  }
  if (decBtn) {
    const index = Number(decBtn.dataset.dec);
    state.cart[index].qty = Math.max(1, state.cart[index].qty - 1);
    persistCart();
    render();
  }
  if (incBtn) {
    const index = Number(incBtn.dataset.inc);
    state.cart[index].qty += 1;
    persistCart();
    render();
  }
}

function render() {
  renderTabs();
  renderMenu();
  renderCart();
  el.userChip.textContent = state.user?.displayName ? `@${state.user.displayName}` : "Guest mode";
}

function renderTabs() {
  el.tabs.innerHTML = categories
    .map(
      (item) => `
        <button class="chip ${item.id === state.category ? "active" : ""}" data-category="${item.id}">
          ${item.name}
        </button>
      `,
    )
    .join("");
}

function renderMenu() {
  const list = products.filter((item) => item.category === state.category);
  el.grid.innerHTML = list
    .map(
      (item) => `
        <article class="menu-card">
          <div>
            <p class="menu-price">฿${item.basePrice}</p>
            <h3>${item.name}</h3>
            <p class="menu-meta">${item.description}</p>
          </div>
          <div class="menu-actions">
            <small class="menu-meta">${item.fields.length ? `${item.fields.length} option groups` : "quick add"}</small>
            <button class="primary-btn" data-add="${item.id}">เลือก</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderOptionFields(product) {
  const html = product.fields
    .map((field) => {
      const options = optionGroups[field] || [];
      const labelMap = {
        sweetness: "ระดับความหวาน",
        milk: "ชนิดนม",
        roast: "ระดับการคั่ว",
        matcha: "ชนิดมัทฉะ",
        teaType: "ชนิดชา",
        waterSplit: "แยกน้ำ",
      };
      const optionsHtml = options
        .map(
          (option) =>
            `<option value="${option.value}" data-price="${option.price}">${option.label} ${option.price ? `(+฿${option.price})` : ""}</option>`,
        )
        .join("");
      return `
        <label class="field">
          <span>${labelMap[field] ?? field}</span>
          <select data-field="${field}">${optionsHtml}</select>
        </label>
      `;
    })
    .join("");
  el.optionFields.innerHTML = html;
  updatePreviewPrice();
}

function updatePreviewPrice() {
  if (!state.selectedProduct) return;
  const form = collectProductForm();
  const price = calculateLineTotal(state.selectedProduct, form.options, form.qty);
  el.addToCartBtn.textContent = `ใส่ตะกร้า ฿${price}`;
}

function collectProductForm() {
  const options = {};
  [...el.optionFields.querySelectorAll("[data-field]")].forEach((field) => {
    options[field.dataset.field] = field.value;
  });
  return {
    options,
    note: el.note.value.trim(),
    qty: Math.max(1, Number(el.qty.value || 1)),
  };
}

function calculateLineTotal(product, options, qty) {
  let total = product.basePrice;
  Object.entries(options).forEach(([groupId, value]) => {
    total += getGroupPrice(groupId, value);
  });
  return total * qty;
}

el.addToCartBtn?.addEventListener("click", (event) => {
  event.preventDefault();
  const product = state.selectedProduct;
  if (!product) return;
  const form = collectProductForm();
  const total = calculateLineTotal(product, form.options, form.qty);
  const summary = buildItemSummary(product, form.options, form.note);
  state.cart.push({
    productId: product.id,
    productName: product.name,
    qty: form.qty,
    options: form.options,
    note: form.note,
    summary,
    price: total,
  });
  persistCart();
  el.dialog.close();
  render();
});

function buildItemSummary(product, options, note) {
  const parts = [];
  Object.entries(options).forEach(([groupId, value]) => {
    const label = getGroupLabel(groupId, value);
    if (label) parts.push(label);
  });
  if (note) parts.push(note);
  return parts.join(" · ") || product.description;
}

function renderCart() {
  if (!state.cart.length) {
    el.cartList.classList.add("empty-state");
    el.cartList.innerHTML = `<p>ยังไม่มีสินค้าในตะกร้า</p>`;
    el.checkoutBtn.disabled = true;
    el.cartCount.textContent = "0 รายการ";
    el.cartTotal.textContent = "฿0";
    return;
  }

  el.cartList.classList.remove("empty-state");
  el.cartList.innerHTML = state.cart
    .map(
      (item, index) => `
        <article class="cart-item">
          <div class="cart-item-head">
            <div>
              <h3>${item.productName}</h3>
              <p class="item-meta">${item.summary}</p>
            </div>
            <strong>฿${item.price}</strong>
          </div>
          <div class="qty-row">
            <button data-dec="${index}">-</button>
            <span>${item.qty} แก้ว</span>
            <button data-inc="${index}">+</button>
            <button class="secondary-btn" data-remove="${index}">ลบ</button>
          </div>
        </article>
      `,
    )
    .join("");
  el.checkoutBtn.disabled = false;
  el.cartCount.textContent = `${state.cart.length} รายการ`;
  el.cartTotal.textContent = `฿${getCartTotal()}`;
}

function getCartTotal() {
  return state.cart.reduce((sum, item) => sum + item.price, 0);
}

function openCheckout() {
  el.checkoutSummary.innerHTML = state.cart
    .map(
      (item) => `
        <div class="summary-item">
          <h4>${item.productName}</h4>
          <p class="item-meta">${item.qty} x ฿${Math.round(item.price / item.qty)}</p>
          <p class="item-meta">${item.summary}</p>
        </div>
      `,
    )
    .join("");
  el.checkoutDialog.showModal();
}

async function submitOrder() {
  const payload = {
    customer: state.user,
    items: state.cart,
    total: getCartTotal(),
  };

  el.submitOrderBtn.disabled = true;
  el.submitOrderBtn.textContent = "กำลังส่ง...";

  try {
    const result = await createOrder(config, payload);
    const response = result.flexMessage ?? result.message ?? result;
    el.responsePanel.hidden = false;
    el.flexPreview.textContent = JSON.stringify(response, null, 2);
    el.paymentQr.src =
      result.paymentQrUrl ||
      "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=PAYMENT-QR-DEMO";
    el.paymentText.textContent = result.paymentHint || "สแกนจ่ายตาม QR ที่ร้านกำหนด";
    state.cart = [];
    persistCart();
    render();
    el.checkoutDialog.close();
  } catch (error) {
    alert(`ส่งออเดอร์ไม่สำเร็จ: ${error.message}`);
  } finally {
    el.submitOrderBtn.disabled = false;
    el.submitOrderBtn.textContent = "ยืนยันส่งออเดอร์";
  }
}

function loadCart() {
  const raw = localStorage.getItem("devcafe_cart_v1");
  return raw ? JSON.parse(raw) : [];
}

function persistCart() {
  localStorage.setItem("devcafe_cart_v1", JSON.stringify(state.cart));
}
