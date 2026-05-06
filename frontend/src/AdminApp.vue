<script setup>
import { computed, onMounted, ref } from "vue";
import { useCafeStore } from "./stores/cafe";

const store = useCafeStore();
const saving = ref(false);

const paymentQrUrl = computed({
  get: () => store.settings.paymentQrUrl,
  set: (value) => {
    store.settings.paymentQrUrl = value;
  },
});

const paymentHint = computed({
  get: () => store.settings.paymentHint,
  set: (value) => {
    store.settings.paymentHint = value;
  },
});

onMounted(async () => {
  await store.bootstrap();
});

async function save() {
  saving.value = true;
  try {
    const result = await store.saveAdmin({
      menu: store.menu,
      settings: store.settings,
    });
    alert(result?.ok ? "บันทึกข้อมูลแล้ว" : "บันทึกไม่สำเร็จ");
  } catch (error) {
    alert(`บันทึกไม่สำเร็จ: ${error.message}`);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">Admin</p>
        <h1 class="mt-2 text-4xl font-black tracking-tight text-stone-900 sm:text-5xl">
          จัดการเมนู ราคา และประวัติการสั่งซื้อ
        </h1>
        <p class="mt-3 max-w-3xl text-sm leading-6 text-stone-600 sm:text-base">
          โครงนี้ตั้งใจให้ขยายต่อเป็นระบบใหญ่ได้ โดยยังใช้ Tailwind เป็นหน้าบ้านหลัก
        </p>
      </div>
      <a
        href="/index.html"
        class="inline-flex h-12 items-center justify-center rounded-full border border-stone-200 bg-white/80 px-4 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
      >
        กลับหน้าลูกค้า
      </a>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.7fr)]">
      <section class="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-soft backdrop-blur">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">ตั้งค่าเมนู</p>
            <h2 class="mt-1 text-2xl font-bold">สินค้าและตัวเลือก</h2>
          </div>
          <button
            class="rounded-full bg-gradient-to-r from-brand-500 to-brand-400 px-4 py-2 font-bold text-white"
            :disabled="saving"
            @click="save"
          >
            {{ saving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด' }}
          </button>
        </div>

        <div class="grid gap-4">
          <article class="rounded-[1.5rem] border border-stone-200 bg-white p-4">
            <h3 class="text-lg font-bold">Payment</h3>
            <p class="mt-1 text-sm text-stone-500">ใช้ QR image URL ที่ลูกค้าสแกนได้</p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold">QR URL</span>
                <input v-model="paymentQrUrl" class="rounded-2xl border border-stone-200 px-4 py-3" />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold">ข้อความกำกับ</span>
                <input v-model="paymentHint" class="rounded-2xl border border-stone-200 px-4 py-3" />
              </label>
            </div>
          </article>

          <article
            v-for="(item, index) in store.menu"
            :key="item.id"
            class="rounded-[1.5rem] border border-stone-200 bg-white p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-bold">{{ item.name }}</h3>
                <p class="mt-1 text-sm text-stone-500">{{ item.category }} · {{ item.description }}</p>
              </div>
              <strong class="text-brand-500">฿{{ item.basePrice }}</strong>
            </div>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="grid gap-2">
                <span class="text-sm font-semibold">ราคา</span>
                <input v-model.number="item.basePrice" type="number" class="rounded-2xl border border-stone-200 px-4 py-3" />
              </label>
              <label class="grid gap-2">
                <span class="text-sm font-semibold">สถานะ</span>
                <select v-model="item.enabled" class="rounded-2xl border border-stone-200 px-4 py-3">
                  <option :value="true">เปิด</option>
                  <option :value="false">ปิด</option>
                </select>
              </label>
            </div>
            <div class="mt-3 text-xs text-stone-500">Option groups: {{ item.fields.join(', ') || '-' }}</div>
          </article>
        </div>
      </section>

      <aside class="rounded-[1.75rem] border border-stone-200 bg-white/80 p-5 shadow-soft backdrop-blur">
        <p class="text-xs font-bold uppercase tracking-[0.18em] text-brand-500">ประวัติ</p>
        <h2 class="mt-1 text-2xl font-bold">ออเดอร์ล่าสุด</h2>

        <div
          v-if="!store.orders.length"
          class="mt-4 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-500"
        >
          ยังไม่มีออเดอร์
        </div>

        <div v-else class="mt-4 space-y-3">
          <article
            v-for="order in store.orders.slice(0, 10)"
            :key="order.orderId"
            class="rounded-[1.5rem] border border-stone-200 bg-white p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="font-bold">{{ order.orderId }}</h3>
                <p class="mt-1 text-sm text-stone-500">{{ order.customer?.displayName || 'Unknown customer' }}</p>
              </div>
              <strong class="text-brand-500">฿{{ order.total }}</strong>
            </div>
            <table class="mt-3 w-full text-sm">
              <tbody>
                <tr
                  v-for="item in order.items"
                  :key="`${order.orderId}-${item.productId}`"
                  class="border-t border-stone-100"
                >
                  <td class="py-2 pr-2 align-top">{{ item.qty }} x {{ item.productName }}</td>
                  <td class="py-2 text-stone-500">{{ item.summary }}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </div>
      </aside>
    </div>
  </div>
</template>
