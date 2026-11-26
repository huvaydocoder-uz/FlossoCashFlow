# Bosqich 1 — Pastki menyu va hisobot davrlari — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pastki menyuga ma'noli ikonkalar va kattaroq yozuvlar, markazda Faridun logotipli bo'lim; hisobotda 6 ta davr (kunlik … yillik).

**Architecture:** Hisobot davrlari mantiqi sof funksiyalarga (`lib/reportPeriods.ts`) ajratiladi va jest bilan sinovdan o'tkaziladi; `ReportCard` va `useStats` shunga ulanadi. Menyu: native — `NativeTabs` (iOS `sf`, Android `md` via `expo-symbols`, logo — `src` rasm), veb — `Tabs` + `@expo/vector-icons`. 6 ta tab iOS'da "More" ga tushib qolmasligi uchun Kategoriyalar Profil ichiga ko'chiriladi (5 tab, logo aynan markazda).

**Tech Stack:** Expo SDK 58, expo-router 58 (NativeTabs), NativeWind, TanStack Query, jest-expo.

**Spec:** `docs/superpowers/specs/2026-11-08-faridun-biznes-design.md` (6.1, 6.2, 8-bo'lim "Hisobot davrlari", "Ikonkalar").

## Global Constraints

- Paketlar faqat `npx expo install <pkg>` bilan (SDK'ga mos versiya). Expo API'dan foydalanishdan oldin `https://docs.expo.dev/versions/v58.0.0/` dagi tegishli sahifani o'qing (AGENTS.md).
- Barcha matnlar `constants/texts.ts` da, ranglar `constants/colors.ts` da (Faridun: primary `#A30A0A`).
- Hisobot davrlari sirpanuvchi; kunlik — bugun, haftalik — 7 kun (kunlar), oylik — haftalar, 3/6/12 oy — oylar (spec 8).
- Tasdiqlash: `npx tsc --noEmit` → 0 xato; `npx jest` → hammasi PASS; `npx expo export -p web` → "Exported: dist".
- Hech qanday ma'lumotlar bazasi o'zgarishi yo'q.

## Review Focus

1. Bucket chegarasida (aynan 08:00 yoki oy 1-kuni 00:00) yozilgan amal — keyingi bucketga tushishi kerak (start inclusive, end exclusive) → Task 1 testi `boundary row goes to later bucket`.
2. Yil almashishi: yillik davrda o'tgan yil oylari "Dekabr 2025" deb yoziladi, joriy yilniki yilsiz → Task 1 testi `year labels add year only for previous year`.
3. Davr boshidan oldingi amal (so'rov chegarasida) hech qaysi bucketga qo'shilmasligi → Task 1 testi `rows before range are ignored`.
4. Davr almashganda eski davr ma'lumoti yangi davr bucketlarida ko'rinib qolmasligi — query key davrni o'z ichiga oladi → Task 2 qadam 3.
5. Kichik ekranda 6 ta davr chipi sig'masligi — gorizontal scroll → Task 2 qadam 3.

---

### Task 1: Test muhiti va hisobot davrlari mantiqi

**Files:**
- Modify: `package.json` (jest-expo, jest, @types/jest; `"test": "jest"`; `"jest": { "preset": "jest-expo" }` — aniq sozlama SDK 58 "Unit testing with Jest" sahifasidan)
- Create: `lib/reportPeriods.ts`
- Create: `lib/__tests__/reportPeriods.test.ts`
- Modify: `constants/texts.ts` (`charts`)

**Interfaces:**
- Produces:
  ```ts
  export type ReportPeriod = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';
  export const REPORT_PERIODS: ReadonlyArray<{ value: ReportPeriod; label: string }>; // shu tartibda
  export const DEFAULT_REPORT_PERIOD: ReportPeriod; // 'month'
  export type ReportBucket = { key: string; label: string; start: Date; end: Date; income: number; expense: number };
  export function createReportBuckets(period: ReportPeriod, now: Date): ReportBucket[]; // xronologik, income/expense = 0
  export function reportRangeStart(period: ReportPeriod, now: Date): Date; // = createReportBuckets(...)[0].start
  export function fillReportBuckets(
    buckets: ReportBucket[],
    rows: ReadonlyArray<{ type: 'income' | 'expense'; amount: number; occurred_at: string }>,
  ): ReportBucket[]; // yangi massiv, start <= t < end
  ```
- Texts (`TEXTS.charts`): `periodDay: 'Kunlik'`, `periodWeek: 'Haftalik'`, `periodMonth: 'Oylik'`, `periodQuarter: '3 oylik'`, `periodHalf: '6 oylik'`, `periodYear: 'Yillik'`, `monthly` → `'Davr kesimida kirim va chiqim'`. `period30/90/365` Task 2 da o'chiriladi (Task 1 da tsc 0 xato qolishi uchun).

Bucket qoidalari (`now` = mahalliy vaqt):
- `day`: 6 ta 4 soatlik blok, bugun 00:00 dan; label `'00:00–04:00'` … `'20:00–24:00'`.
- `week`: 7 ta kun, `startOfDay(now) − 6` dan; label `${TEXTS.calendar.weekdays[(getDay()+6)%7]}, DD.MM`.
- `month`: 5 ta 7 kunlik blok, `startOfDay(now) − 34` dan; label `'DD.MM–DD.MM'` (blok oxirgi kuni).
- `quarter|half|year`: 3/6/12 oy, joriy oy oxirgisi; label `TEXTS.calendar.months[m]`, oy yili `now` yilidan boshqa bo'lsa `' YYYY'` qo'shiladi.
- Oxirgi bucket `end` — keyingi kun/oy/blok boshi (kelajak ham shu bucket ichida qoladi).

- [ ] **Step 1: jest-expo ni o'rnatish**

Run: `npx expo install jest-expo jest @types/jest -- --save-dev`, keyin `package.json` ga `"test": "jest"` va preset.
Expected: `npx jest --listTests` xatosiz (hali test yo'q).

- [ ] **Step 2: Failing testlarni yozish** — `lib/__tests__/reportPeriods.test.ts`, `const NOW = new Date(2026, 10, 8, 15, 30)` (yakshanba):

```ts
test('day: 6 blocks of 4 hours from midnight', () => {
  const b = createReportBuckets('day', NOW);
  expect(b).toHaveLength(6);
  expect(b[0].start).toEqual(new Date(2026, 10, 8, 0, 0));
  expect(b.map((x) => x.label)).toEqual(['00:00–04:00','04:00–08:00','08:00–12:00','12:00–16:00','16:00–20:00','20:00–24:00']);
});
test('week: 7 days ending today, weekday labels', () => {
  const b = createReportBuckets('week', NOW);
  expect(b).toHaveLength(7);
  expect(b[0].label).toBe('Du, 02.11');
  expect(b[6].label).toBe('Ya, 08.11');
});
test('month: 5 weekly blocks starting 34 days ago', () => {
  const b = createReportBuckets('month', NOW);
  expect(b).toHaveLength(5);
  expect(b[0].start).toEqual(new Date(2026, 9, 5));
  expect(b[0].label).toBe('05.10–11.10');
  expect(b[4].label).toBe('02.11–08.11');
});
test('quarter/half: month buckets ending with current month', () => {
  expect(createReportBuckets('quarter', NOW).map((x) => x.label)).toEqual(['Sentabr','Oktabr','Noyabr']);
  expect(createReportBuckets('half', NOW)[0].label).toBe('Iyun');
});
test('year labels add year only for previous year', () => {
  const b = createReportBuckets('year', NOW);
  expect(b).toHaveLength(12);
  expect(b[0].label).toBe('Dekabr 2025');
  expect(b[1].label).toBe('Yanvar');
});
test('reportRangeStart equals first bucket start', () => {
  expect(reportRangeStart('month', NOW)).toEqual(new Date(2026, 9, 5));
});
test('fill sums income and expense per bucket', () => {
  const rows = [
    { type: 'income' as const, amount: 100, occurred_at: new Date(2026, 10, 8, 10).toISOString() },
    { type: 'expense' as const, amount: 40, occurred_at: new Date(2026, 10, 8, 11).toISOString() },
    { type: 'income' as const, amount: 5, occurred_at: new Date(2026, 10, 8, 9).toISOString() },
  ];
  const b = fillReportBuckets(createReportBuckets('day', NOW), rows);
  expect(b[2]).toMatchObject({ income: 105, expense: 40 });
});
test('boundary row goes to later bucket', () => {
  const rows = [{ type: 'income' as const, amount: 1, occurred_at: new Date(2026, 10, 8, 8, 0).toISOString() }];
  const b = fillReportBuckets(createReportBuckets('day', NOW), rows);
  expect(b[1].income).toBe(0);
  expect(b[2].income).toBe(1);
});
test('rows before range are ignored', () => {
  const rows = [{ type: 'expense' as const, amount: 9, occurred_at: new Date(2026, 10, 7, 23, 59).toISOString() }];
  const b = fillReportBuckets(createReportBuckets('day', NOW), rows);
  expect(b.every((x) => x.expense === 0)).toBe(true);
});
```

- [ ] **Step 3: Run** `npx jest lib/__tests__/reportPeriods.test.ts` — Expected: FAIL (module not found).

- [ ] **Step 4: `lib/reportPeriods.ts` ni yozish** (yuqoridagi interfeys va qoidalar; `lib/dates.ts` dagi `startOfDay`, `addDays` dan foydalaning) va `TEXTS.charts` ni yangilash.

- [ ] **Step 5: Run** `npx jest` — Expected: 9 passed. `npx tsc --noEmit` — Expected: 0 xato.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/reportPeriods.ts lib/__tests__ constants/texts.ts
git commit -m "Hisobot davrlari: kunlik, haftalik, oylik, 3/6 oylik, yillik — sof mantiq va testlar"
```

### Task 2: ReportCard va useStats yangi davrlarga

**Files:**
- Modify: `components/charts/ReportCard.tsx` (ichki `Period`, `PERIODS`, `buildBuckets` o'chiriladi)
- Modify: `hooks/useStats.ts`
- Modify: `lib/queryKeys.ts:9`

**Interfaces:**
- Consumes: Task 1 dagi `ReportPeriod`, `REPORT_PERIODS`, `DEFAULT_REPORT_PERIOD`, `createReportBuckets`, `fillReportBuckets`.
- Produces: `useStats(since: Date): UseQueryResult<StatRow[]>`; `queryKeys.stats(sinceIso: string)` → `['transactions','stats',sinceIso]` (prefiks `transactions` qoladi — amal saqlanganda invalidate bo'ladi).

- [ ] **Step 1:** `useStats(since: Date)` — `.gte('occurred_at', since.toISOString())`, key `queryKeys.stats(since.toISOString())`.
- [ ] **Step 2:** `TEXTS.charts.period30/90/365` ni o'chirish. `ReportCard`: `useState<ReportPeriod>(DEFAULT_REPORT_PERIOD)`; `const buckets = useMemo(() => createReportBuckets(period, new Date()), [period])` (davr tanlanganda bir marta; `since = buckets[0].start` — barqaror key); `fillReportBuckets(buckets, rows)`.
- [ ] **Step 3:** Davr chiplari `ScrollView horizontal showsHorizontalScrollIndicator={false}` ichida, `contentContainerClassName="gap-2"` (6 ta chip tor ekranga sig'adi). Query key `since` ga bog'liq → davr almashganda eski ma'lumot aralashmaydi.
- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0 xato; `npx jest` → PASS; `npx expo export -p web` → "Exported: dist".
- [ ] **Step 5: Commit** `git commit -am "Hisobot: 6 ta davr, gorizontal chiplar"`

### Task 3: Ikonka resurslari va kutubxonalar

**Files:**
- Create: `assets/brand/faridun-mark.svg` (muqova vektoridan: viewBox `6 29 680 743`, `fill-rule="evenodd"`; yo'l ma'lumoti — scratchpad `mark-path.txt`, yoki PDF muqova obyekti 1 dagi `/G4 gs` bloki)
- Create: `assets/tab-logo.png`, `assets/tab-logo@2x.png`, `assets/tab-logo@3x.png` — 32/64/96 px: `#A30A0A` to'liq aylana, ichida oq belgi (aylana diametrining ~58%), shaffof fon. Headless Chrome bilan SVG→PNG (`--default-background-color=00000000`).
- Modify: `package.json` — `npx expo install expo-symbols @expo/vector-icons`

- [ ] **Step 1:** SVG va 3 ta PNG ni yaratish; PNG ni Read bilan ko'z bilan tekshirish (aylana tekis, belgi markazda, burchaklar shaffof).
- [ ] **Step 2:** `npx expo install expo-symbols @expo/vector-icons`; `npx expo-doctor` — yangi ogohlantirish yo'q.
- [ ] **Step 3: Commit** `git commit -m "Menyu uchun Faridun logotip ikonkasi va ikonka kutubxonalari"`

### Task 4: Pastki menyu — ikonkalar, kattaroq yozuv, logo bo'limi, Kategoriyalar Profilga

**Files:**
- Modify: `app/(tabs)/_layout.tsx`, `app/(tabs)/_layout.web.tsx`
- Create: `app/(tabs)/faridun.tsx` — vaqtinchalik ekran: sarlavha "Faridun", ikki karta "Buyurtmalar" va "Xodimlar" (`EmptyState`: "Tez orada — 4/5-bosqichda").
- Move: `app/(tabs)/categories.tsx` → `app/categories.tsx` (Stack ekran, `headerShown: true`, title `TEXTS.categories.title`; ichidagi `Screen title` olib tashlanadi — sarlavha headerda).
- Modify: `app/_layout.tsx` — himoyalangan guruhga `<Stack.Screen name="categories" …/>`.
- Modify: `app/(tabs)/profile.tsx` — "Kategoriyalar" qatori (`Pressable`, `router.push('/categories')`, o'ng tomonda `›`).
- Modify: `constants/texts.ts` — `tabs.faridun: 'Faridun'` (faqat accessibilityLabel, ekranda yozuv yo'q), `faridun.*` matnlari, `profile.categories: 'Kategoriyalar'`.
- Modify: `constants/sizes.ts` — `tabBar: { height: 68, labelSize: 13, iconSize: 26, logoSize: 44 }`.

Tab tartibi va ikonkalar (5 ta):

| name | Yozuv | iOS `sf` (default / selected) | Android `md` | Veb `Ionicons` |
|---|---|---|---|---|
| index | Asosiy | house / house.fill | home | home-outline / home |
| history | Tarix | clock.arrow.circlepath | history | time-outline / time |
| faridun | — (yozuvsiz) | `src` logo PNG, `renderingMode="original"` | `src` logo | `Image` logo, `logoSize` |
| debts | Qarzlar | calendar / calendar.badge.clock | event | calendar-outline / calendar |
| profile | Profil | person.crop.circle / person.crop.circle.fill | person | person-circle-outline / person-circle |

- [ ] **Step 1:** Native layout: `NativeTabs` `labelStyle={{ fontSize: SIZES.tabBar.labelSize, fontWeight: '600' }}`, yuqoridagi ikonkalar; logo trigger'da `Label hidden` (SDK 58 hujjatidagi yozuvni yashirish usuli).
- [ ] **Step 2:** Veb layout: `tabBarIconStyle` dagi `display: 'none'` olib tashlanadi; `tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? on : off} size={SIZES.tabBar.iconSize} color={color} />`; `tabBarStyle.height = SIZES.tabBar.height` + pastki safe-area; `tabBarLabelStyle.fontSize = SIZES.tabBar.labelSize`; logo tab `tabBarLabel: () => null`, `tabBarAccessibilityLabel: TEXTS.tabs.faridun`, ikonka — `Image` (`assets/tab-logo.png`, `logoSize`).
- [ ] **Step 3:** Kategoriyalarni ko'chirish va Profil qatori.
- [ ] **Step 4: Verify** `npx tsc --noEmit` → 0; `npx jest` → PASS; `npx expo export -p web` → Exported; dist'ni lokal serverda ochib, headless Chrome bilan `/` (430×900 va 1400×900) skrinshot — 5 ta tab, ikonkalar ko'rinadi, logo markazda, yozuvlar ≥13px. Tablar faqat kirgandan keyin ko'rinadi: test Supabase akkaunti bo'lmasa, tab paneli egasi tomonidan deploy'dan keyin tekshiriladi; buni hisobotda aniq ayting.
- [ ] **Step 5: Commit va push**

```bash
git add -A && git commit -m "Pastki menyu: ikonkalar, kattaroq yozuv, Faridun logotipli bo'lim; Kategoriyalar Profilga"
git push origin main
```
Vercel deploy'ni `manifest`/sahifa yangilanishi bo'yicha kuting.
