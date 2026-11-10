// Veri modeli ve hesaplamalar (TDEE, makro, gün toplamları).
import * as store from './store.js';
import { dayPath, todayStr, uid, r1 } from './util.js';
import { BUILTIN_FOODS } from './foods-data.js';

export const PROFILE_PATH = 'data/profile.json';
export const BODY_PATH = 'data/body.json';
export const FOODS_PATH = 'data/foods.json';

export const ACTIVITY = [
  { id: 1.2, name: 'Hareketsiz', desc: 'Masa başı, egzersiz yok' },
  { id: 1.375, name: 'Az aktif', desc: 'Haftada 1–3 gün hafif egzersiz' },
  { id: 1.55, name: 'Orta aktif', desc: 'Haftada 3–5 gün egzersiz' },
  { id: 1.725, name: 'Çok aktif', desc: 'Haftada 6–7 gün yoğun egzersiz' },
  { id: 1.9, name: 'Aşırı aktif', desc: 'Ağır fiziksel iş + antrenman' },
];

export const DEFAULT_TARGETS = { kcal: 2000, p: 120, c: 220, f: 70, water: 2500 };

export function defaultProfile() {
  return {
    sex: 'male', birthYear: 1995, heightCm: 175, weightKg: 75,
    activity: 1.375, goal: 'maintain', rateKg: 0.5,
    proteinPerKg: 1.8, fatPct: 28,
    targets: { ...DEFAULT_TARGETS },
  };
}

export function getProfile() {
  const p = store.get(PROFILE_PATH);
  return p ? { ...defaultProfile(), ...p, targets: { ...DEFAULT_TARGETS, ...(p.targets || {}) } } : defaultProfile();
}
export const saveProfile = p => store.set(PROFILE_PATH, p);
export const currentTargets = () => ({ ...getProfile().targets });

// ---------- Enerji hesapları ----------
export function bmr({ sex, weightKg, heightCm, birthYear }) {
  const age = new Date().getFullYear() - birthYear;
  // Mifflin-St Jeor
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function suggest(profile) {
  const b = bmr(profile);
  const tdee = b * profile.activity;
  const sign = profile.goal === 'cut' ? -1 : profile.goal === 'bulk' ? 1 : 0;
  const delta = sign * (profile.rateKg * 7700) / 7;
  let kcal = Math.round((tdee + delta) / 10) * 10;
  const floor = profile.sex === 'male' ? 1500 : 1200;
  const belowFloor = kcal < floor;
  kcal = Math.max(kcal, floor);
  const p = Math.round(profile.proteinPerKg * profile.weightKg);
  const f = Math.round((kcal * profile.fatPct / 100) / 9);
  const c = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
  const water = Math.round(profile.weightKg * 35 / 50) * 50;
  return { bmr: Math.round(b), tdee: Math.round(tdee), delta: Math.round(delta), belowFloor, targets: { kcal, p, c, f, water } };
}

// ---------- Besinler ----------
export function customFoods() {
  return (store.get(FOODS_PATH)?.items || []).filter(f => !f.deleted);
}
export function allFoods() {
  const custom = customFoods().map(f => ({ ...f, custom: true }));
  return [...custom, ...BUILTIN_FOODS];
}
export function findFood(id) {
  return allFoods().find(f => f.id === id) || null;
}
export async function saveCustomFood(food) {
  const doc = store.get(FOODS_PATH) || { items: [] };
  const now = Date.now();
  const idx = doc.items.findIndex(f => f.id === food.id);
  const item = { ...food, updatedAt: now };
  if (idx >= 0) doc.items[idx] = item; else doc.items.push({ ...item, createdAt: now });
  await store.set(FOODS_PATH, doc);
}
export async function deleteCustomFood(id) {
  const doc = store.get(FOODS_PATH) || { items: [] };
  const f = doc.items.find(x => x.id === id);
  if (f) { f.deleted = true; f.updatedAt = Date.now(); await store.set(FOODS_PATH, doc); }
}

// 100 g başına değerlerden miktar için makro
export function macrosFor(per100, grams) {
  const k = grams / 100;
  return { kcal: r1(per100.kcal * k), p: r1(per100.p * k), c: r1(per100.c * k), f: r1(per100.f * k) };
}

// ---------- Günler ----------
export function getDay(date) {
  return store.get(dayPath(date));
}

export function newDay(date) {
  return {
    date,
    entries: [],
    water: { ml: 0, updatedAt: 0 },
    note: { text: '', updatedAt: 0 },
    targets: currentTargets(),
  };
}

export const editDay = date => getDay(date) || newDay(date);
export const saveDay = day => store.set(dayPath(day.date), day);

export const activeEntries = day => (day?.entries || []).filter(e => !e.deleted)
  .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

export function makeEntry(fields) {
  const now = Date.now();
  return { id: uid(), createdAt: now, updatedAt: now, ...fields };
}

export function sumEntries(entries) {
  const s = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const e of entries) { s.kcal += e.kcal || 0; s.p += e.p || 0; s.c += e.c || 0; s.f += e.f || 0; }
  return s;
}

export function dayTotals(day) {
  const list = activeEntries(day);
  const eaten = sumEntries(list.filter(e => e.status === 'eaten'));
  const planned = sumEntries(list.filter(e => e.status === 'planned'));
  return { eaten, planned, all: sumEntries(list), count: list.length, eatenCount: list.filter(e => e.status === 'eaten').length };
}

export function allDayDates() {
  return store.paths('data/days/').map(p => p.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1]).filter(Boolean);
}

// ---------- Vücut ----------
export function bodyEntries() {
  return (store.get(BODY_PATH)?.entries || []).filter(e => !e.deleted).sort((a, b) => a.date.localeCompare(b.date));
}
export function latestWeight() {
  const list = bodyEntries().filter(e => e.weight);
  return list.length ? list[list.length - 1].weight : null;
}
export async function saveBodyEntry(entry) {
  const doc = store.get(BODY_PATH) || { entries: [] };
  const now = Date.now();
  const idx = doc.entries.findIndex(e => e.id === entry.id);
  if (idx >= 0) doc.entries[idx] = { ...entry, updatedAt: now };
  else doc.entries.push({ ...entry, createdAt: now, updatedAt: now });
  await store.set(BODY_PATH, doc);
}
export async function deleteBodyEntry(id) {
  const doc = store.get(BODY_PATH) || { entries: [] };
  const e = doc.entries.find(x => x.id === id);
  if (e) { e.deleted = true; e.updatedAt = Date.now(); await store.set(BODY_PATH, doc); }
}

// Son kullanılan besinler (son 45 gün)
export function recentFoods(limit = 30) {
  const seen = new Map();
  const dates = allDayDates().filter(d => d <= todayStr()).sort().reverse().slice(0, 45);
  for (const d of dates) {
    for (const e of activeEntries(getDay(d)).reverse()) {
      const key = e.foodId || 'q:' + e.name;
      if (!seen.has(key)) seen.set(key, e);
      if (seen.size >= limit) return [...seen.values()];
    }
  }
  return [...seen.values()];
}

// Hedef değişince bugün ve sonrası için açılmış günlerin hedefini de güncelle (geçmişe dokunma).
export async function applyTargetsFromToday() {
  const t = currentTargets();
  const today = todayStr();
  for (const d of allDayDates().filter(d => d >= today)) {
    const day = getDay(d);
    if (day) { day.targets = { ...t }; await saveDay(day); }
  }
}
