<script setup>
import { computed, onMounted, ref } from "vue";
import { useCafeStore } from "./stores/cafe";

const store = useCafeStore();
const saving = ref(false);
const activeTab = ref("menu"); // 'menu', 'options', 'orders'
const selectedId = ref(null);
const selectedGroup = ref(null);

onMounted(async () => {
  await store.bootstrap();
});

const groupedOptions = computed(() => {
  return store.options.reduce((acc, opt) => {
    if (!acc[opt.groupId]) acc[opt.groupId] = [];
    acc[opt.groupId].push(opt);
    return acc;
  }, {});
});

const selectedMenuItem = computed(() => {
  return store.menu.find((m) => m.id === selectedId.value);
});

function selectMenu(id) {
  selectedId.value = id;
}

function selectOptionGroup(groupId) {
  selectedGroup.value = groupId;
}

function addMenuItem() {
  const newId = `menu-${Date.now()}`;
  store.menu.push({
    id: newId,
    category: "coffee",
    name: "เมนูใหม่",
    description: "",
    basePrice: 0,
    enabled: true,
    fields: [],
    imageUrl: "",
  });
  selectedId.value = newId;
}

function deleteMenuItem(id) {
  if (!confirm("ยืนยันการลบเมนูนี้?")) return;
  const index = store.menu.findIndex((m) => m.id === id);
  if (index !== -1) {
    store.menu.splice(index, 1);
    if (selectedId.value === id) selectedId.value = null;
  }
}

function addOptionToGroup(groupId) {
  store.options.push({
    groupId: groupId,
    value: "",
    label: "",
    price: 0,
    sortOrder: (groupedOptions.value[groupId]?.length || 0) + 1,
    enabled: true,
  });
}

function createNewGroup() {
  const groupId = prompt("ระบุชื่อกลุ่มใหม่ (เช่น sweetness, milk):");
  if (!groupId) return;
  if (groupedOptions.value[groupId]) {
    alert("มีกลุ่มนี้อยู่แล้ว");
    return;
  }
  store.options.push({
    groupId: groupId,
    value: "value1",
    label: "ตัวเลือก 1",
    price: 0,
    sortOrder: 1,
    enabled: true,
  });
  selectedGroup.value = groupId;
}

function deleteOption(opt) {
  if (!confirm("ลบตัวเลือกนี้?")) return;
  const index = store.options.indexOf(opt);
  if (index !== -1) {
    store.options.splice(index, 1);
  }
}

function validateBeforeSave() {
  // Check Menu IDs
  const menuIds = new Set();
  for (const item of store.menu) {
    if (!item.id?.trim()) return "รายการเมนูต้องมี ID";
    if (menuIds.has(item.id)) return `ID เมนูซ้ำกัน: ${item.id}`;
    menuIds.add(item.id);
  }

  // Check Options
  const seenOptions = new Set();
  for (const opt of store.options) {
    if (!opt.groupId?.trim() || opt.value === undefined || opt.value === null || String(opt.value).trim() === "") {
      return `พบรายการในกลุ่ม ${opt.groupId || 'Unknown'} ที่ยังไม่ได้ระบุค่า (Value)`;
    }
    const key = `${opt.groupId}:${opt.value}`;
    if (seenOptions.has(key)) {
      return `พบค่าซ้ำในกลุ่ม ${opt.groupId}: "${opt.value}" (แต่ละรายการในกลุ่มเดียวกันต้องมี Value ต่างกัน)`;
    }
    seenOptions.add(key);
  }
  return null;
}

async function save() {
  const error = validateBeforeSave();
  if (error) {
    alert(`ไม่สามารถบันทึกได้: ${error}`);
    return;
  }

  saving.value = true;
  try {
    const result = await store.saveAdmin({
      menu: store.menu,
      options: store.options,
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
  <div class="flex h-screen flex-col bg-stone-50 overflow-hidden font-sans">
    <!-- Header -->
    <header class="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm z-20">
      <div class="flex items-center gap-8">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white font-bold">C</div>
          <h1 class="text-lg font-black text-stone-900 tracking-tight">DEV CAFE <span class="text-brand-500">ADMIN</span></h1>
        </div>
        <nav class="flex gap-1 bg-stone-100 p-1 rounded-xl">
          <button
            v-for="tab in ['menu', 'options', 'orders']"
            :key="tab"
            @click="activeTab = tab"
            :class="[
              'rounded-lg px-6 py-1.5 text-sm font-bold transition-all duration-200',
              activeTab === tab ? 'bg-white text-brand-600 shadow-sm' : 'text-stone-500 hover:text-stone-700'
            ]"
          >
            {{ tab === 'menu' ? 'เมนูสินค้า' : tab === 'options' ? 'กลุ่มตัวเลือก' : 'รายการสั่งซื้อ' }}
          </button>
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <a href="/index.html" target="_blank" class="text-sm font-medium text-stone-400 hover:text-stone-600 flex items-center gap-1">
          <span>ดูหน้าเว็บลูกค้า</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <button
          @click="save"
          :disabled="saving"
          class="rounded-xl bg-stone-900 px-6 py-2 text-sm font-bold text-white shadow-lg hover:bg-stone-800 disabled:opacity-50 active:scale-95 transition-all"
        >
          {{ saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง' }}
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-hidden">
      <!-- Menu Tab -->
      <div v-if="activeTab === 'menu'" class="flex h-full">
        <!-- List Pane -->
        <div class="w-80 border-r bg-white flex flex-col shadow-sm z-10">
          <div class="p-4 border-b bg-stone-50/50 flex justify-between items-center">
            <h2 class="font-bold text-stone-900">สินค้า ({{ store.menu.length }})</h2>
            <button @click="addMenuItem" class="bg-brand-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-brand-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto divide-y divide-stone-100">
            <div
              v-for="item in store.menu"
              :key="item.id"
              @click="selectMenu(item.id)"
              :class="[
                'cursor-pointer p-4 transition-all border-l-4',
                selectedId === item.id ? 'bg-brand-50/50 border-brand-500' : 'border-transparent hover:bg-stone-50'
              ]"
            >
              <div class="flex justify-between items-start">
                <div class="font-bold text-stone-800 truncate pr-2">{{ item.name || 'ไม่มีชื่อ' }}</div>
                <div :class="['text-[10px] px-1.5 py-0.5 rounded font-bold uppercase', item.enabled ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-500']">
                  {{ item.enabled ? 'ON' : 'OFF' }}
                </div>
              </div>
              <div class="text-xs text-stone-400 mt-1 flex justify-between items-center">
                <span class="bg-stone-100 px-1.5 py-0.5 rounded">{{ item.category }}</span>
                <span class="font-bold text-stone-600">฿{{ item.basePrice }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Pane -->
        <div class="flex-1 overflow-y-auto bg-stone-50 p-10">
          <div v-if="selectedMenuItem" class="max-w-3xl mx-auto">
            <div class="flex justify-between items-end mb-8">
              <div>
                <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-1">Product Details</div>
                <h2 class="text-3xl font-black text-stone-900">{{ selectedMenuItem.name }}</h2>
              </div>
              <button @click="deleteMenuItem(selectedMenuItem.id)" class="text-red-400 hover:text-red-600 text-sm font-bold flex items-center gap-1 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                ลบสินค้านี้
              </button>
            </div>
            
            <div class="grid grid-cols-6 gap-6">
              <div class="col-span-4 space-y-6">
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
                  <div class="grid grid-cols-2 gap-4">
                    <label class="col-span-2 block">
                      <span class="text-xs font-bold text-stone-400 uppercase ml-1">ชื่อสินค้า</span>
                      <input v-model="selectedMenuItem.name" class="mt-1 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-lg font-bold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" />
                    </label>
                    <label class="block">
                      <span class="text-xs font-bold text-stone-400 uppercase ml-1">Product ID (Unique)</span>
                      <input v-model="selectedMenuItem.id" class="mt-1 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:bg-white transition-all" />
                    </label>
                    <label class="block">
                      <span class="text-xs font-bold text-stone-400 uppercase ml-1">หมวดหมู่</span>
                      <input v-model="selectedMenuItem.category" class="mt-1 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:bg-white transition-all" />
                    </label>
                    <label class="col-span-2 block">
                      <span class="text-xs font-bold text-stone-400 uppercase ml-1">คำอธิบาย</span>
                      <textarea v-model="selectedMenuItem.description" rows="3" class="mt-1 w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:bg-white transition-all"></textarea>
                    </label>
                  </div>
                </div>

                <div class="bg-white p-6 rounded-3xl shadow-sm border border-stone-200">
                  <h3 class="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
                    <div class="w-1.5 h-4 bg-brand-500 rounded-full"></div>
                    ตัวเลือกที่ใช้ (Option Groups)
                  </h3>
                  <label class="block">
                    <input
                      :value="Array.isArray(selectedMenuItem.fields) ? selectedMenuItem.fields.join(', ') : selectedMenuItem.fields || ''"
                      class="w-full rounded-2xl border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:bg-white transition-all"
                      placeholder="เช่น sweetness, milk, roast"
                      @input="selectedMenuItem.fields = $event.target.value.split(',').map(s => s.trim()).filter(Boolean)"
                    />
                    <div class="mt-3 flex flex-wrap gap-2">
                      <span v-for="f in (Array.isArray(selectedMenuItem.fields) ? selectedMenuItem.fields : [])" :key="f" class="bg-brand-50 text-brand-600 px-3 py-1 rounded-full text-xs font-bold border border-brand-100">
                        {{ f }}
                      </span>
                    </div>
                    <p class="mt-4 text-[11px] text-stone-400 bg-stone-50 p-3 rounded-xl border border-dashed">
                      * ใส่ชื่อ Group ID ที่สร้างไว้ในแท็บ "กลุ่มตัวเลือก" เพื่อให้ลูกค้ายกเลือกได้ เช่น ถ้ามีกลุ่ม sweetness ให้ใส่ sweetness ลงในช่องนี้
                    </p>
                  </label>
                </div>
              </div>

              <div class="col-span-2 space-y-6">
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
                  <label class="block">
                    <span class="text-xs font-bold text-stone-400 uppercase ml-1">ราคาเริ่มต้น</span>
                    <div class="relative mt-1">
                      <span class="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-stone-400">฿</span>
                      <input v-model.number="selectedMenuItem.basePrice" type="number" class="w-full rounded-2xl border-stone-200 bg-stone-50 pl-8 pr-4 py-3 text-2xl font-black text-brand-600 focus:bg-white transition-all" />
                    </div>
                  </label>
                  <label class="block">
                    <span class="text-xs font-bold text-stone-400 uppercase ml-1">สถานะการขาย</span>
                    <select v-model="selectedMenuItem.enabled" :class="['mt-1 w-full rounded-2xl border-stone-200 px-4 py-3 text-sm font-bold appearance-none bg-no-repeat bg-[right_1rem_center] transition-all', selectedMenuItem.enabled ? 'bg-green-50 text-green-600' : 'bg-stone-100 text-stone-500']" style="background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')">
                      <option :value="true">เปิดการขายปกติ</option>
                      <option :value="false">ปิดการขายชั่วคราว</option>
                    </select>
                  </label>
                </div>

                <div class="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
                  <span class="text-xs font-bold text-stone-400 uppercase ml-1">รูปภาพสินค้า</span>
                  <div class="aspect-square rounded-2xl bg-stone-100 border-2 border-dashed border-stone-200 flex items-center justify-center overflow-hidden">
                    <img v-if="selectedMenuItem.imageUrl" :src="selectedMenuItem.imageUrl" class="w-full h-full object-cover" />
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input v-model="selectedMenuItem.imageUrl" class="w-full rounded-xl border-stone-200 bg-stone-50 px-3 py-2 text-[10px] focus:bg-white transition-all" placeholder="วางลิงก์รูปภาพที่นี่" />
                </div>
              </div>
            </div>
          </div>
          <div v-else class="flex h-full items-center justify-center">
            <div class="text-center space-y-4">
              <div class="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <p class="text-stone-400 font-medium italic">เลือกสินค้าเพื่อเริ่มต้นแก้ไข หรือกดปุ่ม + เพื่อเพิ่มใหม่</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Options Tab -->
      <div v-if="activeTab === 'options'" class="flex h-full">
        <!-- List Pane -->
        <div class="w-80 border-r bg-white flex flex-col shadow-sm z-10">
          <div class="p-4 border-b bg-stone-50/50 flex justify-between items-center">
            <h2 class="font-bold text-stone-900">กลุ่มตัวเลือก ({{ Object.keys(groupedOptions).length }})</h2>
            <button @click="createNewGroup" class="bg-brand-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md hover:bg-brand-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto divide-y divide-stone-100">
            <div
              v-for="(opts, groupId) in groupedOptions"
              :key="groupId"
              @click="selectOptionGroup(groupId)"
              :class="[
                'cursor-pointer p-4 transition-all border-l-4',
                selectedGroup === groupId ? 'bg-brand-50/50 border-brand-500' : 'border-transparent hover:bg-stone-50'
              ]"
            >
              <div class="font-bold text-stone-800 tracking-tight">{{ groupId }}</div>
              <div class="text-[10px] text-stone-400 mt-1 font-bold uppercase">{{ opts.length }} OPTIONS</div>
            </div>
          </div>
        </div>

        <!-- Edit Pane -->
        <div class="flex-1 overflow-y-auto bg-stone-50 p-10">
          <div v-if="selectedGroup" class="max-w-4xl mx-auto">
            <div class="flex justify-between items-end mb-8">
              <div>
                <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-1">Option Group</div>
                <h2 class="text-3xl font-black text-stone-900">{{ selectedGroup }}</h2>
              </div>
              <button @click="addOptionToGroup(selectedGroup)" class="bg-stone-900 text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-stone-800 transition-all active:scale-95">
                + เพิ่มตัวเลือกในกลุ่ม
              </button>
            </div>

            <div class="bg-white rounded-[2rem] border border-stone-200 shadow-sm overflow-hidden">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-stone-50 text-stone-400 text-[10px] font-black uppercase tracking-widest">
                    <th class="px-6 py-4 border-b">Label (แสดงให้ลูกค้าเห็น)</th>
                    <th class="px-6 py-4 border-b">Value (เก็บลง DB)</th>
                    <th class="px-6 py-4 border-b">ราคาบวก (+)</th>
                    <th class="px-6 py-4 border-b w-24">ลำดับ</th>
                    <th class="px-6 py-4 border-b w-32">สถานะ</th>
                    <th class="px-6 py-4 border-b w-16"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100">
                  <tr v-for="(opt, index) in groupedOptions[selectedGroup]" :key="index" class="hover:bg-stone-50/50 transition-colors">
                    <td class="px-6 py-3">
                      <input v-model="opt.label" class="w-full rounded-xl border-stone-200 bg-transparent px-3 py-2 text-sm font-bold focus:bg-white transition-all" />
                    </td>
                    <td class="px-6 py-3">
                      <input 
                        v-model="opt.value" 
                        :class="[
                          'w-full rounded-xl border bg-transparent px-3 py-2 text-sm font-bold transition-all',
                          !opt.value ? 'border-red-300 bg-red-50 focus:bg-white' : 'border-stone-200 text-stone-500 focus:bg-white'
                        ]" 
                        placeholder="ต้องระบุค่า..."
                      />
                    </td>
                    <td class="px-6 py-3">
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">฿</span>
                        <input v-model.number="opt.price" type="number" class="w-full rounded-xl border-stone-200 bg-transparent pl-7 pr-3 py-2 text-sm font-bold text-brand-600 focus:bg-white transition-all" />
                      </div>
                    </td>
                    <td class="px-6 py-3">
                      <input v-model.number="opt.sortOrder" type="number" class="w-full rounded-xl border-stone-200 bg-transparent px-3 py-2 text-sm text-center focus:bg-white transition-all" />
                    </td>
                    <td class="px-6 py-3">
                      <select v-model="opt.enabled" :class="['w-full rounded-xl border-stone-200 px-3 py-2 text-xs font-bold appearance-none bg-no-repeat bg-[right_0.5rem_center] transition-all', opt.enabled ? 'text-green-600' : 'text-stone-400']" style="background-image: url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%22m6 8 4 4 4-4%22/%3E%3C/svg%3E')">
                        <option :value="true">เปิดใช้</option>
                        <option :value="false">ปิดใช้</option>
                      </select>
                    </td>
                    <td class="px-6 py-3 text-right">
                      <button @click="deleteOption(opt)" class="text-stone-300 hover:text-red-500 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="!groupedOptions[selectedGroup]?.length" class="p-12 text-center text-stone-400 italic">
                ไม่มีตัวเลือกในกลุ่มนี้ กดปุ่ม "เพิ่มตัวเลือก" ด้านบนเพื่อเริ่ม
              </div>
            </div>
            <div class="mt-6 p-4 bg-brand-50 rounded-2xl border border-brand-100 flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-brand-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p class="text-xs font-bold text-brand-700">คำแนะนำ</p>
                <p class="text-[11px] text-brand-600/80 leading-relaxed mt-1">
                  Value (DB) คือค่าที่จะถูกบันทึกลงในฐานข้อมูล ไม่ควรแก้ไขถ้ามีออเดอร์ที่ใช้ค่านี้ไปแล้ว เพราะจะทำให้การแสดงผลประวัติออเดอร์เก่าคลาดเคลื่อนได้
                </p>
              </div>
            </div>
          </div>
          <div v-else class="flex h-full items-center justify-center">
            <div class="text-center space-y-4">
              <div class="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <p class="text-stone-400 font-medium italic">เลือกกลุ่มตัวเลือกจากรายการด้านซ้าย หรือสร้างกลุ่มใหม่</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Orders Tab -->
      <div v-if="activeTab === 'orders'" class="h-full overflow-y-auto p-10 bg-stone-50">
        <div class="max-w-6xl mx-auto">
          <div class="flex justify-between items-end mb-8">
            <div>
              <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-1">Order History</div>
              <h2 class="text-3xl font-black text-stone-900">รายการสั่งซื้อล่าสุด</h2>
            </div>
            <div class="text-sm font-bold text-stone-400">ทั้งหมด {{ store.orders.length }} ออเดอร์</div>
          </div>
          
          <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="order in store.orders"
              :key="order.orderId"
              class="bg-white rounded-[2rem] border border-stone-200 shadow-sm p-6 space-y-4 hover:shadow-md transition-shadow"
            >
              <div class="flex justify-between items-start border-b border-stone-100 pb-4">
                <div>
                  <div class="text-[10px] font-black text-brand-500 uppercase tracking-tighter">#{{ order.orderId.slice(-8).toUpperCase() }}</div>
                  <h3 class="font-black text-stone-900 text-lg leading-tight mt-0.5">{{ order.customer?.displayName || 'Guest' }}</h3>
                </div>
                <div class="text-xl font-black text-stone-900">฿{{ order.total }}</div>
              </div>
              <div class="space-y-3 min-h-[100px]">
                <div v-for="item in order.items" :key="item.productId" class="relative pl-4">
                  <div class="absolute left-0 top-1.5 w-1.5 h-1.5 bg-stone-300 rounded-full"></div>
                  <div class="flex justify-between items-start">
                    <span class="font-bold text-sm text-stone-800">{{ item.qty }}x {{ item.productName }}</span>
                    <span class="text-xs font-bold text-stone-400">฿{{ item.price }}</span>
                  </div>
                  <div class="text-[11px] text-stone-500 mt-1 leading-relaxed">{{ item.optionSummary || item.summary || '-' }}</div>
                </div>
              </div>
              <div class="pt-4 flex justify-between items-center border-t border-stone-50">
                <div class="text-[9px] font-bold text-stone-300 font-mono">{{ order.orderId }}</div>
                <div class="text-[10px] px-2 py-1 bg-stone-100 rounded-lg font-bold text-stone-500 uppercase">Completed</div>
              </div>
            </article>
          </div>
          
          <div v-if="!store.orders.length" class="flex flex-col items-center justify-center py-32 text-stone-300">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p class="font-bold italic">ยังไม่มีรายการสั่งซื้อในระบบ</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

.font-sans {
  font-family: 'Inter', sans-serif;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

/* Hide spin buttons for number inputs */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
}
</style>
