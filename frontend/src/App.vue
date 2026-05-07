<script setup>
import { computed, onMounted, ref } from "vue";
import liff from "@line/liff";
import { useCafeStore } from "./stores/cafe";

const store = useCafeStore();
const checkoutOpen = ref(false);
const productOpen = ref(false);
const paymentQrFallback = import.meta.env.VITE_PAYMENT_QR_URL || "";

const categories = computed(() => {
  const items = new Map();
  store.menu.forEach((item) => items.set(item.category, true));
  return Array.from(items.keys()).map((id) => ({
    id,
    name: id === "coffee" ? "กาแฟ" : id === "tea" ? "ชา" : "อื่นๆ",
  }));
});

onMounted(async () => {
  const profile = await tryInitLiff();
  if (profile) {
    store.setUserProfile(profile);
  }
  await store.bootstrap(profile || store.user);
});

function tryOpenProduct(productId) {
  store.openProduct(productId);
  productOpen.value = true;
}

async function confirmCheckout() {
  await store.checkout();
  checkoutOpen.value = false;
}

async function tryInitLiff() {
  const liffId = import.meta.env.VITE_LIFF_ID?.trim();
  if (!liffId) return null;
  try {
    await liff.init({ liffId, withLoginOnExternalBrowser: true });
    if (!liff.isLoggedIn()) liff.login();
    const profile = await liff.getProfile();
    return profile;
  } catch (error) {
    console.warn("LIFF init failed", error);
    return null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">DevCafe</p>
        <h1 class="mt-2 text-4xl font-black tracking-tight text-stone-900 sm:text-5xl">
          สั่งเครื่องดื่มผ่าน LINE ได้ในหน้าเดียว
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
          เลือกเมนู ปรับตัวเลือก ใส่ตะกร้า และส่งออเดอร์พร้อม Flex Message ได้จากมือถือ
        </p>
      </div>
      <a
        href="/admin.html"
        class="inline-flex h-12 items-center justify-center rounded-full border border-stone-200 bg-white/80 px-4 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
      >
        ไปหน้าแอดมิน
      </a>
    </header>

    <main class="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
      <section class="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-soft backdrop-blur">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">หมวดหมู่</p>
            <h2 class="mt-1 text-2xl font-bold">เลือกเมนู</h2>
          </div>
          <span class="rounded-full bg-brand-100 px-3 py-2 text-sm font-bold text-brand-500">
            {{ store.user.displayName || 'Guest' }}
          </span>
        </div>

        <div class="mb-4 flex flex-wrap gap-2">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="rounded-full border px-4 py-2 text-sm font-semibold transition"
            :class="store.category === cat.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white/80 text-stone-700'"
            @click="store.selectCategory(cat.id)"
          >
            {{ cat.name }}
          </button>
        </div>

        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="item in store.menu.filter((menuItem) => menuItem.category === store.category && menuItem.enabled !== false)"
            :key="item.id"
            class="flex flex-col rounded-[1.5rem] border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-soft"
          >
            <div>
              <p class="text-lg font-black text-brand-500">฿{{ item.basePrice }}</p>
              <h3 class="mt-1 text-lg font-bold">{{ item.name }}</h3>
              <p class="mt-2 text-sm leading-6 text-stone-600">{{ item.description }}</p>
            </div>
            <div class="mt-4 flex items-center justify-between gap-3">
              <small class="text-xs text-stone-500">{{ item.fields.length ? `${item.fields.length} option groups` : 'quick add' }}</small>
              <button
                class="rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                @click="tryOpenProduct(item.id)"
              >
                เลือก
              </button>
            </div>
          </article>
        </div>
      </section>

      <aside class="sticky top-4 h-fit rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-soft backdrop-blur">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">ตะกร้า</p>
            <h2 class="mt-1 text-2xl font-bold">รายการสั่งซื้อ</h2>
          </div>
          <span class="rounded-full bg-brand-100 px-3 py-2 text-sm font-bold text-brand-500">{{ store.cart.length }} รายการ</span>
        </div>

        <div
          v-if="!store.cart.length"
          class="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500"
        >
          ยังไม่มีสินค้าในตะกร้า
        </div>

        <div v-else class="space-y-3">
          <article
            v-for="(item, index) in store.cart"
            :key="`${item.productId}-${index}`"
            class="rounded-2xl border border-stone-200 bg-white p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-bold">{{ item.productName }}</h3>
                <p class="mt-1 text-sm leading-6 text-stone-500">{{ item.summary }}</p>
              </div>
              <strong class="text-brand-500">฿{{ item.price }}</strong>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <button
                class="h-8 w-8 rounded-full border border-stone-200 bg-white"
                @click="store.updateCartQty(index, -1)"
              >
                -
              </button>
              <span class="min-w-16 text-center text-sm">{{ item.qty }} แก้ว</span>
              <button
                class="h-8 w-8 rounded-full border border-stone-200 bg-white"
                @click="store.updateCartQty(index, 1)"
              >
                +
              </button>
              <button
                class="ml-auto rounded-full border border-stone-200 bg-white px-3 py-1 text-sm"
                @click="store.removeCartItem(index)"
              >
                ลบ
              </button>
            </div>
          </article>
        </div>

        <div class="mt-4 border-t border-stone-200 pt-4">
          <div class="flex items-center justify-between text-lg">
            <span class="font-medium">รวมทั้งหมด</span>
            <strong>฿{{ store.cartTotal }}</strong>
          </div>
          <button
            class="mt-4 w-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-4 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!store.cart.length"
            @click="checkoutOpen = true"
          >
            ยืนยันการสั่ง
          </button>
          <p class="mt-3 text-sm leading-6 text-stone-500">
            หลังยืนยัน ระบบจะสร้างเลขออเดอร์และตอบกลับด้วย Flex Message พร้อม QR จ่ายเงิน
          </p>
        </div>
      </aside>
    </main>

    <dialog
      v-if="store.selectedProduct"
      :open="productOpen"
      class="fixed inset-0 z-50 w-full max-w-3xl rounded-[1.75rem] border border-stone-200 bg-white p-0 shadow-soft backdrop:bg-stone-900/50"
    >
      <form method="dialog" class="p-5">
        <div class="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">ปรับแต่งเมนู</p>
            <h3 class="mt-1 text-2xl font-bold">{{ store.selectedProduct.name }}</h3>
            <p class="mt-1 text-sm text-stone-500">{{ store.selectedProduct.description }}</p>
          </div>
          <button class="h-10 w-10 rounded-full border border-stone-200" value="cancel" @click="productOpen = false">
            ×
          </button>
        </div>

        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          <label v-for="field in store.selectedProduct.fields" :key="field" class="grid gap-2">
            <span class="text-sm font-semibold text-stone-700">
              {{
                {
                  sweetness: 'ระดับความหวาน',
                  milk: 'ชนิดนม',
                  roast: 'ระดับการคั่ว',
                  matcha: 'ชนิดมัทฉะ',
                  waterSplit: 'แยกน้ำ'
                }[field] || field
              }}
            </span>
            <select
              v-model="store.draft.options[field]"
              class="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            >
              <option
                v-for="option in {
                  sweetness: [
                    { value: '0%', label: 'หวาน 0%' },
                    { value: '25%', label: 'หวาน 25%' },
                    { value: '50%', label: 'หวาน 50%' },
                    { value: '75%', label: 'หวาน 75%' },
                    { value: '100%', label: 'หวาน 100%' }
                  ],
                  milk: [
                    { value: 'none', label: 'ไม่ใส่นม' },
                    { value: 'fresh', label: 'นมสด (+10)' },
                    { value: 'oat', label: 'นมโอ๊ต (+20)' },
                    { value: 'soy', label: 'นมถั่วเหลือง (+15)' }
                  ],
                  roast: [
                    { value: 'light', label: 'คั่วอ่อน' },
                    { value: 'medium', label: 'คั่วกลาง' },
                    { value: 'dark', label: 'คั่วเข้ม' }
                  ],
                  matcha: [
                    { value: 'ceremonial', label: 'Ceremonial (+25)' },
                    { value: 'classic', label: 'Classic' },
                    { value: 'culinary', label: 'Culinary (-5)' }
                  ],
                  waterSplit: [
                    { value: 'no', label: 'ไม่แยกน้ำ' },
                    { value: 'yes', label: 'แยกน้ำ (+5)' }
                  ]
                }[field] || []"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <label class="grid gap-2 sm:col-span-2">
            <span class="text-sm font-semibold text-stone-700">รายละเอียดเพิ่มเติม</span>
            <textarea
              v-model="store.draft.note"
              rows="3"
              class="rounded-2xl border border-stone-200 bg-white px-4 py-3"
              placeholder="เช่น หวานน้อย แยกน้ำแข็ง"
            ></textarea>
          </label>

          <label class="grid gap-2 max-w-40">
            <span class="text-sm font-semibold text-stone-700">จำนวนแก้ว</span>
            <input
              v-model.number="store.draft.qty"
              type="number"
              min="1"
              class="rounded-2xl border border-stone-200 bg-white px-4 py-3"
            />
          </label>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <button class="rounded-full border border-stone-200 px-4 py-3 font-semibold" value="cancel" @click="productOpen = false">
            ยกเลิก
          </button>
          <button
            class="rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-3 font-bold text-white"
            @click.prevent="store.addDraftToCart(); productOpen = false"
          >
            ใส่ตะกร้า
          </button>
        </div>
      </form>
    </dialog>

    <dialog
      :open="checkoutOpen"
      class="fixed inset-0 z-50 w-full max-w-4xl rounded-[1.75rem] border border-stone-200 bg-white p-0 shadow-soft backdrop:bg-stone-900/50"
    >
      <div class="p-5">
        <div class="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">ยืนยันออเดอร์</p>
            <h3 class="mt-1 text-2xl font-bold">สรุปรายการก่อนส่ง</h3>
          </div>
          <button class="h-10 w-10 rounded-full border border-stone-200" @click="checkoutOpen = false">×</button>
        </div>

        <div class="mt-5 grid gap-3">
          <article
            v-for="item in store.cart"
            :key="`${item.productId}-${item.productName}`"
            class="rounded-2xl border border-stone-200 bg-stone-50 p-4"
          >
            <h4 class="font-bold">{{ item.productName }}</h4>
            <p class="mt-1 text-sm text-stone-500">{{ item.qty }} x ฿{{ Math.round(item.price / item.qty) }}</p>
            <p class="mt-1 text-sm leading-6 text-stone-600">{{ item.summary }}</p>
          </article>
        </div>

        <div class="mt-5 flex items-center justify-between gap-3 border-t border-stone-200 pt-4">
          <button class="rounded-full border border-stone-200 px-4 py-3 font-semibold" @click="checkoutOpen = false">
            กลับ
          </button>
          <button class="rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-5 py-3 font-bold text-white" @click.prevent="confirmCheckout">
            ยืนยันส่งออเดอร์
          </button>
        </div>
      </div>
    </dialog>

    <section v-if="store.responsePreview" class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
      <div class="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-soft">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">ผลลัพธ์</p>
        <h2 class="mt-1 text-2xl font-bold">LINE response preview</h2>
        <pre class="mt-4 overflow-auto rounded-[1.25rem] bg-stone-950 p-4 text-sm text-brand-100">{{ JSON.stringify(store.responsePreview, null, 2) }}</pre>
      </div>
      <div class="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-soft">
        <h3 class="text-xl font-bold">QR จ่ายเงิน</h3>
        <img
          class="mt-4 aspect-square w-full rounded-[1.25rem] border border-stone-200 bg-white object-contain p-3"
          :src="store.settings.paymentQrUrl || paymentQrFallback"
          alt="QR payment"
        />
        <p class="mt-3 text-sm leading-6 text-stone-600">{{ store.settings.paymentHint }}</p>
      </div>
    </section>
  </div>
</template>
