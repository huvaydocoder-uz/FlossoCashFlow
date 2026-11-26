# Bosqich 2 — Biznes, jamoa va rollar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (owner chose native execution). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Moliya (kategoriyalar, amallar, qarzlar) foydalanuvchiga emas, **biznesga** tegishli bo'ladi; egasi va sotuvchilar rollari, kod orqali qo'shilish va egasi tasdiqlashi.

**Architecture:** Yangi migratsiya `businesses` + `business_members` jadvallari, `security definer` yordamchi funksiyalar (`current_business_id`, `is_business_owner`) va RPC'lar (`create_business`, `join_business`, `approve_member`, `remove_member`, `leave_business`). Moliya jadvallariga `business_id` (standart qiymati `current_business_id()` — eski va yangi ilova insert'lari o'zgarmaydi), RLS faqat **active owner**. Mavjud har bir foydalanuvchi o'z biznesining egasiga aylanadi. Ilova: a'zolik holatiga qarab — biznes yaratish/qo'shilish, kutish ekrani yoki ilova; sotuvchida faqat Faridun va Profil tablari; egasida Profil → Jamoa.

**Tech Stack:** Supabase Postgres (RLS, plpgsql), PGlite (lokal SQL testlar), Expo Router 58, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-08-faridun-biznes-design.md` (5-bo'lim 2-qadam, 6.3, 7, 8 "Qo'shilish", "Sotuvchi menyusi", 9.1).

## Global Constraints

- Migratsiya mavjud ma'lumotni yo'qotmaydi; ishga tushirilgandan keyin **eski ilova ham ishlashda davom etadi** (insert'larda `business_id` standart qiymat bilan to'ladi).
- Tartib: egasi avval migratsiyani Supabase SQL Editor'da ishga tushiradi, **keyin** ilova push qilinadi.
- Moliya jadvallari va `balances` faqat biznesning **active owner**iga ko'rinadi/yoziladi; sotuvchiga — hech narsa.
- Bir foydalanuvchi — bitta biznes (`business_members.user_id` unique).
- Qo'shilish kodi: 6 ta belgi `A-Z`/`2-9` (chalkash `0 O 1 I` yo'q), katta-kichik harf farqsiz kiritiladi.
- Matnlar `constants/texts.ts`, ranglar `constants/colors.ts`.
- Tasdiqlash: `npx tsc --noEmit` → 0; `npm test` → hammasi PASS (TS + SQL); `npx expo export -p web` → Exported.

## Review Focus

1. Sotuvchi `transactions/debts/categories/balances` ni o'qiy olmasligi va yozolmasligi → Task 1 testi `seller sees no finance rows and cannot insert`.
2. Kutilayotgan (pending) a'zo hech narsaga kira olmasligi, egasi tasdiqlagach sotuvchi bo'lishi → Task 1 testi `pending member has no access until approved`.
3. Egasi o'zini chiqarib yubora olmasligi/egani boshqa a'zo chiqara olmasligi → Task 1 testi `owner cannot be removed`.
4. Mavjud ma'lumot migratsiyadan keyin o'z biznesida, balans o'zgarmagan → Task 1 testi `existing data migrates to owner business`.
5. Noto'g'ri kod / allaqachon a'zo bo'lgan foydalanuvchi qo'shilishi → aniq xato kodi va o'zbekcha matn → Task 1 testi `join errors` + Task 2 `dbErrors` xaritasi.

---

### Task 1: Migratsiya va SQL testlar (PGlite)

**Files:**
- Create: `supabase/migrations/20261108150000_business_team.sql`
- Create: `supabase/tests/harness.mjs` — PGlite'da Supabase o'rnini bosuvchi: `auth` sxemasi, `auth.users`, `auth.uid()` (`current_setting('request.jwt.claim.sub', true)::uuid`), rollar `anon`/`authenticated`; barcha migratsiyalarni tartib bilan qo'llaydi; `as(db, userId, sql, params)` — `set local role authenticated` + `set local request.jwt.claim.sub` bilan tranzaksiyada bajaradi.
- Create: `supabase/tests/business.test.mjs`
- Modify: `package.json` — `test` skripti SQL testlarni ham ishga tushiradi (`"supabase/tests/*.test.mjs"`).

**Interfaces (Produces):**
- Jadvallar: `businesses(id, name, owner_id, join_code, created_at, updated_at)`, `business_members(business_id, user_id unique, role member_role('owner'|'seller'), status member_status('pending'|'active'), created_at)`.
- `categories|transactions|debts.business_id uuid not null default public.current_business_id()`.
- `balances` view ustunlari: `business_id, currency, total_income, total_expense, balance, payment_method`.
- RPC: `create_business(p_name text) returns public.businesses`; `join_business(p_code text) returns uuid`; `approve_member(p_user_id uuid) returns void`; `remove_member(p_user_id uuid) returns void`; `leave_business() returns void`.
- Xato kodlari (`raise ... using errcode`): `FB001` allaqachon biznesi bor, `FB002` kod topilmadi, `FB003` faqat egasi, `FB004` egani chiqarib bo'lmaydi, `FB005` a'zo topilmadi.
- `users` select: o'zi yoki o'z biznesining egasi (a'zolar ismini ko'rish uchun).

- [ ] **Step 1: Failing testlar** (`business.test.mjs`, `node:test`): `existing data migrates to owner business` (1-2-migratsiya + seed: foydalanuvchi, kategoriya, amal, qarz → yangi migratsiya → har biri bitta biznesga, egasi active owner, balans o'zgarmagan); `owner keeps full finance access` (insert `business_id`siz o'tadi); `create_business makes owner with 6-char code and debt categories`; `join errors` (`FB002` noto'g'ri kod, `FB001` ikkinchi marta); `pending member has no access until approved`; `seller sees no finance rows and cannot insert`; `seller cannot approve or remove`; `owner cannot be removed`; `leave_business removes seller`; `owner sees member names`.
- [ ] **Step 2:** `npm test` → yangi testlar FAIL (migratsiya fayli yo'q).
- [ ] **Step 3:** Migratsiyani yozish. Kategoriya noyobligi va amal→kategoriya FK `user_id` o'rniga `business_id` bo'yicha; `pay_debt/unpay_debt` va `handle_new_user` yangilanadi (yangi foydalanuvchiga kategoriya endi `create_business` da yaratiladi).
- [ ] **Step 4:** `npm test` → hammasi PASS.
- [ ] **Step 5: Commit** `git commit -m "Biznes va jamoa: migratsiya, RLS, RPC va SQL testlar"`

### Task 2: Tiplar, a'zolik hook'lari, holat mantiqi

**Files:** Modify `types/database.ts`, `lib/queryKeys.ts`, `lib/dbErrors.ts`, `constants/texts.ts`. Create `lib/membership.ts`, `lib/__tests__/membership.test.ts`, `hooks/useMembership.ts`.

**Interfaces (Produces):**
```ts
export type MemberRole = 'owner' | 'seller'; export type MemberStatus = 'pending' | 'active';
export type Membership = { role: MemberRole; status: MemberStatus; business: { id: string; name: string; join_code: string } };
export type AccessState = 'loading' | 'error' | 'none' | 'pending' | 'owner' | 'seller';
export function accessState(q: { isPending: boolean; isError: boolean; data: Membership | null | undefined }): AccessState;
export const SELLER_TABS: readonly string[]; // ['faridun', 'profile']
export function isTabVisible(tab: string, state: AccessState): boolean; // owner — hammasi, seller — SELLER_TABS
// hooks/useMembership.ts
useMembership(): UseQueryResult<Membership | null>;  // queryKeys.membership(userId)
useCreateBusiness(), useJoinBusiness(), useLeaveBusiness(), useTeamMembers(), useApproveMember(), useRemoveMember()
```
`getDbErrorMessage`: `FB001..FB005` → `TEXTS.dbErrors.*`.

- [ ] **Step 1:** Failing testlar `membership.test.ts`: `accessState` 6 holat; `isTabVisible('index','seller') === false`, `('faridun','seller') === true`, owner — hammasi true. Ishga tushirish → FAIL.
- [ ] **Step 2:** `lib/membership.ts` + tiplar + hook'lar + matnlar. `npm test`, `tsc` → PASS/0.
- [ ] **Step 3: Commit.**

### Task 3: Ekranlar va himoya (guard)

**Files:** Create `app/welcome.tsx` (biznes yaratish formasi + kod bilan qo'shilish formasi; pending bo'lsa — "So'rov yuborildi: <biznes>", "Yangilash", "So'rovni bekor qilish"; har doim "Chiqish"), `app/team.tsx` (egasi: biznes nomi, qo'shilish kodi, a'zolar — kutilayotganlar "Tasdiqlash"/"Rad etish", faollar "Chiqarish"; sotuvchi: biznes nomi, roli, "Biznesdan chiqish"). Modify `app/_layout.tsx` (guard: `isSignedIn && (owner|seller)` → ilova; `isSignedIn && (none|pending)` → `welcome`; `loading` → LoadingState; `error` → ErrorState+retry), `app/(tabs)/_layout.tsx` (`hidden` sotuvchi uchun), `app/(tabs)/_layout.web.tsx` (`href: null`), `app/(tabs)/index.tsx` (sotuvchi → `<Redirect href="/faridun" />`), `app/(tabs)/profile.tsx` ("Jamoa" qatori, Kategoriyalar faqat egasiga).

- [ ] **Step 1:** Ekranlar va guard. **Step 2:** `tsc` 0, `npm test` PASS, veb-build. **Step 3:** lokal build + soxta sessiya bilan `welcome` ekranini skrinshot (Supabase'siz — a'zolik so'rovi xato beradi, ErrorState ko'rinishi tekshiriladi). **Step 4: Commit.**

### Task 4: Hujjat va ishga tushirish tartibi

**Files:** Modify `README.md` (migratsiyani ishga tushirish, jamoa qo'shish).
- [ ] Egasiga: Supabase → SQL Editor → `20261108150000_business_team.sql` → Run → natijani tekshirish so'rovi (`select name, join_code from businesses`). Shundan keyin `main` ga push.
