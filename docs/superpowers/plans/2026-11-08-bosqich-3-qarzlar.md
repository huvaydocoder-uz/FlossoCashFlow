# Bosqich 3 — Qarzlar: bo'lib to'lash, telefon, soha, naqd/karta/nasiya — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (owner chose native execution). Checkbox steps.

**Goal:** Qarzlarni bo'lib to'lash (har to'lov kassaga avtomatik), ro'yxatda "Qarzimni berdim / Qarzini berdi", telefon (qo'ng'iroq) va soha, qarz olish/berishda naqd/karta/nasiya.

**Architecture:** Migratsiya `debt_payments` jadvali, `debts` ga `phone`, `sector`, `origin_method`, `origin_transaction_id`; `transactions` ga `source` (`manual|debt_origin|debt_payment`) va `debt_id`. Kassa amallarini faqat `security definer` funksiyalar yaratadi/o'zgartiradi (ichida egasi tekshiruvi): `add_debt_payment`, `delete_debt_payment` RPC'lari va `debts` dagi trigger (qarz qo'shilganda/tahrirlanganda/o'chirilganda boshlang'ich amalni sinxronlaydi). RLS: `source <> 'manual'` amallarni to'g'ridan-to'g'ri tahrirlab/o'chirib bo'lmaydi. Ilova: qoldiq/progress sof funksiyada, to'lov modal ekrani, ro'yxat tugmalari, Tarixda avtomatik amal — faqat ko'rish + "Qarzni ochish".

**Tech Stack:** Supabase Postgres (plpgsql, RLS), PGlite testlar, Expo Router 58, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-08-faridun-biznes-design.md` (6.4, 7, 8 "Qarz to'lovi valyutasi", 9 "Mening qarorlarim").

## Global Constraints

- Har bir to'lov kassaga avtomatik: payable → **chiqim** ("Kompaniya berishi kerak bo'lgan qarzlar"), receivable → **kirim** ("Kompaniyadan mijozlar qarzlari"). To'lov o'chirilsa — amali ham o'chadi.
- Qarz qo'shishda "Pul qanday o'tdi?": **Naqd / Karta** → darhol amal (payable: qarz oldik → **kirim** "Olingan qarzlar"; receivable: qarz berdik → **chiqim** "Berilgan qarzlar"); **Nasiya** → kassa o'zgarmaydi. Mavjud qarzlar — nasiya.
- To'lov qarz valyutasida; qoldiqdan ortiq to'lov — xato `FD001`. Qarz summasini to'langandan kam qilish — `FD002`. To'lovi bor qarz valyutasini o'zgartirish — `FD003`.
- Qoldiq 0 bo'lsa `debts.paid_at` = oxirgi to'lov sanasi, aks holda `null` (eslatmalar va filtrlar shunga tayanadi).
- Qarz o'chirilsa — unga bog'liq barcha kassa amallari (boshlang'ich + to'lovlar) ham o'chadi (_ruling: spec 2 "to'lov o'chirilganda amal qolib ketsa" — muvaffaqiyatsizlik_).
- Avtomatik amallar (`source <> 'manual'`) Tarixda to'g'ridan-to'g'ri o'zgartirilmaydi/o'chirilmaydi (spec 8/9).
- Faqat biznes egasi; sotuvchiga hech narsa (2-bosqich RLS).
- Eski ilova migratsiyadan keyin ishlashda davom etadi: `pay_debt` = qoldiqni to'lash, `unpay_debt` = barcha to'lovlarni o'chirish.
- Migratsiya `begin; … commit;` ichida. Tasdiqlash: `tsc` 0, `npm test` PASS, veb-build.

## Review Focus

1. Qoldiqdan ortiq to'lov rad etiladi, aniq qoldiq to'lansa qarz "To'langan" → SQL `overpay rejected, exact remainder closes debt`.
2. To'lovni o'chirish kassa amalini ham o'chiradi va qarzni qayta ochadi → SQL `deleting payment removes its transaction and reopens debt`.
3. Nasiyadan naqdga (yoki aksincha) tahrirlash boshlang'ich amalni yaratadi/o'chiradi; summa o'zgarsa amal ham o'zgaradi → SQL `origin transaction follows debt edits`.
4. Sotuvchi to'lov qo'sha olmaydi; egasi avtomatik amalni to'g'ridan-to'g'ri o'chira olmaydi → SQL `auto transactions are locked`.
5. So'mdagi qarzda kasr/katta summalar (84 300 000) aniq hisoblanadi → TS `progress uses exact cents`.

---

### Task 1: Migratsiya + SQL testlar
**Files:** Create `supabase/migrations/20261108200000_debt_payments.sql`, `supabase/tests/debts.test.mjs`.
**Produces:** `debt_payments(id, business_id, debt_id, user_id, amount, payment_method, paid_at, transaction_id, created_at)`; `debts.phone text null (≤20, ^[+0-9 ()-]*$)`, `debts.sector text null (≤50)`, `debts.origin_method payment_method null`, `debts.origin_transaction_id uuid null`; `transactions.source text not null default 'manual'`, `transactions.debt_id uuid null`; RPC `add_debt_payment(p_debt_id uuid, p_amount numeric, p_payment_method payment_method, p_paid_at timestamptz default now()) returns uuid`, `delete_debt_payment(p_payment_id uuid) returns void`; errors `FD001..FD003`.
- [ ] Failing testlar (Review Focus 1–4 + `nasiya debt leaves cash untouched`, `cash payable debt adds income`, `deleting debt removes its transactions`, `old pay_debt pays remainder`, `seller cannot add payment`), RED → migratsiya → GREEN → commit.

### Task 2: Tiplar, hisob mantiqi, hook'lar
**Files:** Modify `types/database.ts`, `types/models.ts` (`DebtPayload` + `phone`, `sector`, `origin_method`), `lib/debts.ts`, `hooks/useDebts.ts`, `lib/dbErrors.ts`, `constants/texts.ts`, `lib/validation.ts`. Test `lib/__tests__/debts.test.ts`.
**Produces:** `type DebtWithPayments = Debt & { payments: DebtPayment[] }`; `debtProgress(debt: DebtWithPayments): { paid: number; remaining: number; ratio: number }` (tiyinlarda hisob: `Math.round(x*100)`); `useDebts(): UseQueryResult<DebtWithPayments[]>`; `useAddDebtPayment()`, `useDeleteDebtPayment()`; `validatePhone(value): string | undefined`.
- [ ] Failing TS testlar (`progress uses exact cents`, `remaining never negative`, `validatePhone`), RED → kod → GREEN → commit.

### Task 3: Ekranlar
**Files:** Modify `components/debts/DebtForm.tsx` (telefon, soha, "Pul qanday o'tdi?" — Naqd/Karta/Nasiya, yangi qarzda standart Nasiya), `components/debts/DebtRow.tsx` (to'langan/qoldiq, progress chizig'i, tugma "Qarzimni berdim"/"Qarzini berdi", telefon tugmasi `tel:`), `app/debt/[id].tsx` (to'lovlar ro'yxati — o'chirish; "To'lov qo'shish"; eski "To'landi/bekor" o'rniga), `app/(tabs)/debts.tsx` (jami — qoldiq bo'yicha), `app/transaction/[id].tsx` (avtomatik amal — ko'rish + "Qarzni ochish"). Create `app/debt/pay/[id].tsx` (modal: summa — standart qoldiq, naqd/karta, sana, saqlash), `app/_layout.tsx` (yangi ekran, egasi guard).
- [ ] Ekranlar → `tsc`/test/build → mock server bilan skrinshot → commit.

### Task 4: Ishga tushirish
- [ ] Yakuniy tekshiruv (opus) → tuzatishlar → Supabase'da migratsiya (token, tranzaksiya) → oldin/keyin balans solishtirish → push → deploy tekshiruvi.
