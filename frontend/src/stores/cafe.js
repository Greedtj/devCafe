import { defineStore } from "pinia";
import { computed, reactive, ref } from "vue";
import { categories, optionGroups as fallbackOptionGroups } from "../services/catalog";
import {
  buildFlexMessage,
  fetchMenuApi,
  fetchOrdersApi,
  saveAdminState,
  submitOrder,
  defaultSettings,
} from "../services/api";

const CART_KEY = "devcafe_cart_v2";
const USER_KEY = "devcafe_user_v2";

export const useCafeStore = defineStore("cafe", () => {
  const category = ref(categories[0].id);
  const cart = ref(loadCart());
  const selectedProduct = ref(null);
  const draft = reactive({
    options: {},
    note: "",
    qty: 1,
  });
  const user = ref(loadUser());
  const settings = ref(defaultSettings());
  const menu = ref([]);
  const options = ref([]);
  const orders = ref([]);
  const responsePreview = ref(null);
  const optionGroupMap = computed(() => buildOptionGroupMap(options.value));

  const cartTotal = computed(() => cart.value.reduce((sum, item) => sum + item.price, 0));

  async function bootstrap(lineUser) {
    if (lineUser) user.value = lineUser;
    try {
      const data = await fetchMenuApi();
      if (Array.isArray(data.menu)) menu.value = normalizeMenu(data.menu);
      if (Array.isArray(data.options)) options.value = normalizeOptions(data.options);
      if (data.settings) settings.value = data.settings;
      if (data.profile?.displayName) user.value = data.profile;

      void loadOrders(user.value?.userId || "");
    } catch (error) {
      console.warn("bootstrap failed", error);
    }
  }

  function selectCategory(value) {
    category.value = value;
  }

  function setUserProfile(profile) {
    if (!profile) return;
    user.value = {
      userId: profile.userId || "",
      displayName: profile.displayName || "Guest",
      pictureUrl: profile.pictureUrl || "",
      statusMessage: profile.statusMessage || "",
    };
    persistUser(user.value);
  }

  function openProduct(productId) {
    selectedProduct.value = menu.value.find((item) => item.id === productId) || null;
    draft.options = {};
    draft.note = "";
    draft.qty = 1;
    if (selectedProduct.value) {
      selectedProduct.value.fields.forEach((field) => {
        draft.options[field] = getDefaultOptionValue(field);
      });
    }
  }

  function addDraftToCart() {
    if (!selectedProduct.value) return;
    const unitPrice = calculateUnitPrice(selectedProduct.value, draft.options);
    const price = unitPrice * draft.qty;
    cart.value.push({
      productId: selectedProduct.value.id,
      productName: selectedProduct.value.name,
      qty: draft.qty,
      unitPrice,
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
    item.price = Number(item.unitPrice || 0) * item.qty;
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
    if (!result?.ok) {
      throw new Error(result?.error || "checkout failed");
    }
    responsePreview.value = result.flexMessage || buildFlexMessage(result.order || payload);
    if (result.order) orders.value.unshift(result.order);
    cart.value = [];
    persistCart(cart.value);
    return result;
  }

  async function loadOrders(userId = "") {
    try {
      const data = await fetchOrdersApi(userId);
      if (Array.isArray(data.orders)) orders.value = data.orders;
      return data;
    } catch (error) {
      console.warn("loadOrders failed", error);
      return { ok: false, error: error.message };
    }
  }

  async function saveAdmin(payload) {
    const result = await saveAdminState(payload);
    if (payload.menu) menu.value = normalizeMenu(payload.menu);
    if (payload.options) options.value = normalizeOptions(payload.options);
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
    options,
    orders,
    responsePreview,
    cartTotal,
    bootstrap,
    selectCategory,
    setUserProfile,
    openProduct,
    addDraftToCart,
    updateCartQty,
    removeCartItem,
    checkout,
    loadOrders,
    saveAdmin,
    getOptionGroupOptions,
    getOptionLabel,
  };
});

function calculateUnitPrice(product, options) {
  if (!product) return 0;
  let total = product.basePrice;
  Object.entries(options || {}).forEach(([groupId, value]) => {
    total += getOptionPrice(groupId, value);
  });
  return total;
}

function buildItemSummary(options, note) {
  const parts = [];
  Object.entries(options || {}).forEach(([groupId, value]) => {
    const label = getOptionLabel(groupId, value);
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

function buildOptionGroupMap(optionRows) {
  return (optionRows || []).reduce((acc, item) => {
    if (!item?.groupId) return acc;
    const groupId = String(item.groupId).trim();
    if (!groupId) return acc;
    if (!acc[groupId]) acc[groupId] = [];
    acc[groupId].push({
      ...item,
      value: String(item.value || "").trim(),
      label: String(item.label || "").trim(),
      price: Number(item.price || 0),
      sortOrder: Number(item.sortOrder || 0),
      enabled: item.enabled !== false && item.enabled !== "false",
    });
    acc[groupId].sort((a, b) => a.sortOrder - b.sortOrder);
    return acc;
  }, {});
}

function normalizeOptions(optionRows) {
  return (optionRows || []).map((item) => ({
    ...item,
    groupId: String(item.groupId || "").trim(),
    value: String(item.value || "").trim(),
    label: String(item.label || "").trim(),
    price: Number(item.price || 0),
    sortOrder: Number(item.sortOrder || 0),
    enabled: item.enabled !== false && item.enabled !== "false",
  }));
}

function getOptionGroupOptions(groupId) {
  const items = optionGroupMap.value[groupId] || fallbackOptionGroups[groupId] || [];
  return items.filter((item) => item.enabled !== false);
}

function getOptionLabel(groupId, value) {
  return getOptionGroupOptions(groupId).find((item) => item.value === value)?.label ?? value;
}

function getOptionPrice(groupId, value) {
  return getOptionGroupOptions(groupId).find((item) => item.value === value)?.price ?? 0;
}

function getDefaultOptionValue(groupId) {
  return getOptionGroupOptions(groupId).find((item) => item.enabled !== false)?.value || "";
}

function loadCart() {
  const raw = localStorage.getItem(CART_KEY);
  return raw ? JSON.parse(raw) : [];
}

function loadUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw
    ? JSON.parse(raw)
    : {
        userId: "",
        displayName: "Guest",
        pictureUrl: "",
        statusMessage: "",
      };
}

function persistCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function persistUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
