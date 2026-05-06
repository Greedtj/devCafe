export const categories = [
  { id: "coffee", name: "กาแฟ" },
  { id: "tea", name: "ชา" },
  { id: "other", name: "อื่นๆ" },
];

export const optionGroups = {
  sweetness: [
    { value: "0%", label: "หวาน 0%", price: 0 },
    { value: "25%", label: "หวาน 25%", price: 0 },
    { value: "50%", label: "หวาน 50%", price: 0 },
    { value: "75%", label: "หวาน 75%", price: 0 },
    { value: "100%", label: "หวาน 100%", price: 0 },
  ],
  milk: [
    { value: "none", label: "ไม่ใส่นม", price: 0 },
    { value: "fresh", label: "นมสด", price: 10 },
    { value: "oat", label: "นมโอ๊ต", price: 20 },
    { value: "soy", label: "นมถั่วเหลือง", price: 15 },
  ],
  roast: [
    { value: "light", label: "คั่วอ่อน", price: 0 },
    { value: "medium", label: "คั่วกลาง", price: 0 },
    { value: "dark", label: "คั่วเข้ม", price: 0 },
  ],
  matcha: [
    { value: "ceremonial", label: "Ceremonial", price: 25 },
    { value: "classic", label: "Classic", price: 0 },
    { value: "culinary", label: "Culinary", price: -5 },
  ],
  waterSplit: [
    { value: "no", label: "ไม่แยกน้ำ", price: 0 },
    { value: "yes", label: "แยกน้ำ", price: 5 },
  ],
};

export const products = [
  {
    id: "coffee-americano",
    category: "coffee",
    name: "Americano",
    description: "กาแฟดำหอมละมุน เลือกระดับคั่วได้",
    basePrice: 55,
    fields: ["sweetness", "milk", "roast", "waterSplit"],
  },
  {
    id: "coffee-latte",
    category: "coffee",
    name: "Latte",
    description: "กาแฟนมยอดนิยม ปรับนมและความหวานได้",
    basePrice: 65,
    fields: ["sweetness", "milk", "roast", "waterSplit"],
  },
  {
    id: "tea-matcha",
    category: "tea",
    name: "Matcha",
    description: "มัทฉะคุณภาพดี เลือกชนิดมัทฉะและนม",
    basePrice: 75,
    fields: ["sweetness", "milk", "matcha", "waterSplit"],
  },
  {
    id: "tea-lemon",
    category: "tea",
    name: "Lemon Tea",
    description: "ชามะนาวสดชื่น ปรับหวานและแยกน้ำได้",
    basePrice: 50,
    fields: ["sweetness", "waterSplit"],
  },
  {
    id: "other-cocoa",
    category: "other",
    name: "Cocoa",
    description: "โกโก้เข้มข้น นุ่มละมุน",
    basePrice: 60,
    fields: ["sweetness", "milk", "waterSplit"],
  },
  {
    id: "other-bottle",
    category: "other",
    name: "Water Bottle",
    description: "น้ำดื่มขวดเย็น",
    basePrice: 15,
    fields: [],
  },
];

export function getProductById(id) {
  return products.find((item) => item.id === id);
}

export function getGroupLabel(groupId, value) {
  return optionGroups[groupId]?.find((item) => item.value === value)?.label ?? value;
}

export function getGroupPrice(groupId, value) {
  return optionGroups[groupId]?.find((item) => item.value === value)?.price ?? 0;
}
