import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { categories, getGroupLabel, getGroupPrice, getProductById, optionGroups, products } from "../services/catalog";
import { bootstrapApi, buildFlexMessage, saveAdminState, submitOrder, defaultSettings } from "../services/api";

const CART_KEY = "devcafe_cart_v2";

export const useCafeStore = defineStore("cafe", () => {
  const category = ref(categories[0].id);
  const cart = ref(loadCart());
  const selectedProduct = ref(null);
  const draft = reactive({
    options: {},
    note: "",
    qty: 1,
  });
  const user = ref({
    userId: "demo-user",
    displayName: "Guest",
  });
  const settings = ref(defaultSettings());
  const menu = ref(products);
  const orders = ref([]);
  const responsePreview = ref(null);

  const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + item.price, 0));

  async function bootstrap(lineUser) {
    if (lineUser) user.value = lineUser;
    try {
      const data = await bootstrapApi(user.value);
      if (data.menu?.length) menu.value = normalizeMenu(data.menu);
      if (data.orders?.length) orders.value = data.orders;
      if (data.settings) settings.value = data.settings;
      if (data.profile?.displayName) user.value = data.profile;
    } catch (error) {
      console.warn("bootstrap failed", error);
    }
  }

  function selectCategory(value) {
    category.value = value;
  }

  function openProduct(productId) {
    selectedProduct.value = getProductById(productId);
    draft.options = {};
    draft.note = "";
    draft.qty = 1;
    if (selectedProduct.value) {
      selectedProduct.value.fields.forEach((field) => {
        draft.options[field] = optionGroups[field]?.[0]?.value || "";
      });
    }
  }

  function addDraftToCart() {
    if (!selectedProduct.value) return;
    const price = calculateLineTotal(selectedProduct.value, draft.options, draft.qty);
    cart.value.push({
      productId: selectedProduct.value.id,
      productName: selectedProduct.value.name,
      qty: draft.qty,
      options: { ...draft.options },
      note: draft.note.trim(),
      summary: buildItemSummary(draft.options, draft.note),
      price,
    });
    persistCart(cart.value);
  }

  function updateCartQty(index, delta) {
    const item = cart.value[index];
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    item.price = calculateLineTotal(getProductById(item.productId), item.options, item.qty);
    persistCart(cart.value);
  }

  function removeCartItem(index) {
    cart.value.splice(index, 1);
    persistCart(cart.value);
  }

  async function checkout() {
    const payload = {
      customer: user.value,
      items: cart.value,
      total: cartTotal.value,
    };
    const result = await submitOrder(payload);
    responsePreview.value = result.flexMessage || buildFlexMessage(result.order || payload);
    if (result.order) orders.value.unshift(result.order);
    cart.value = [];
    persistCart(cart.value);
    return result;
  }

  async function saveAdmin(payload) {
    const result = await saveAdminState(payload);
    if (payload.menu) menu.value = normalizeMenu(payload.menu);
    if (payload.settings) settings.value = payload.settings;
    return result;
  }

  return {
    category,
    cart,
    selectedProduct,
    draft,
    user,
    settings,
    menu,
    orders,
    responsePreview,
    cartTotal,
    bootstrap,
    selectCategory,
    openProduct,
    addDraftToCart,
    updateCartQty,
    removeCartItem,
    checkout,
    saveAdmin,
  };
});

function calculateLineTotal(product, options, qty) {
  if (!product) return 0;
  let total = product.basePrice;
  Object.entries(options || {}).forEach(([groupId, value]) => {
    total += getGroupPrice(groupId, value);
  });
  return total * qty;
}

function buildItemSummary(options, note) {
  const parts = [];
  Object.entries(options || {}).forEach(([groupId, value]) => {
    const label = getGroupLabel(groupId, value);
    if (label) parts.push(label);
  });
  if (note) parts.push(note);
  return parts.join(" · ");
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

function loadCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

function persistCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}
