# Bosqich 5 — Xodimlar va oylik — Implementation Plan

> **For agentic workers:** superpowers:executing-plans (native). Checkbox steps.

**Goal:** Faridun → Xodimlar: xodim kartasi (ism, telefon, lavozim), belgilangan oylik (kunga proporsional) yoki pog'onali foiz (amaldagi to'lovlardan, buyurtma oyiga), oy bo'yicha hisoblangan / berilgan / qoldiq; berilgan pul kassaga chiqim; sotuvchi o'z oyligini ko'radi.

**Architecture:** Migratsiya `20261109120000_payroll.sql`: `employees`, `commission_tiers`, `payroll_days`, `salary_payments`; `transactions.source` + `salary_payment`. Hisob bitta joyda — `payroll(p_month date)` (security definer, egasiga butun biznes, sotuvchiga faqat o'zi bog'langan xodim). To'lov — `add_salary_payment` / `delete_salary_payment` RPC (faqat egasi; kurs muhrlanadi; kassaga "Oylik" chiqimi). Xodim, pog'ona, kunlar — RLS bilan to'g'ridan-to'g'ri (yozish faqat egasi).

**Spec:** `docs/superpowers/specs/2026-11-08-faridun-biznes-design.md` (6.6, 7, 9.2, 9.3).

## Global Constraints
- Belgilangan: `oylik ÷ me'yor × ishlagan kun` (me'yor standart 25), valyuta xodim bo'yicha (standart so'm). Ishlagan kun 0–31.
- Foiz: savdo = shu oyda **buyurtma qilingan** (o'z) buyurtmalarga amalda to'langan pul (`order_payments.amount_usd`), bekor qilinganlar kirmaydi. Pog'ona — **butun savdoga**; pastki chegara pog'onaga kiradi; oxirgi pog'ona davom etadi; birinchi pog'ona 0 $ dan. Natija $ da.
- To'lov: so'm yoki $, naqd/karta, avans yoki oylik; boshqa valyutada — kurs 5 000–50 000 (FO003), oylik valyutasiga o'giriladi. Har to'lov kassaga chiqim, o'chirilsa — amali ham.
- Qoldiq = hisoblangan − berilgan (0 dan kam emas; ortiqcha berilgan bo'lsa "ortiqcha" ko'rsatiladi — to'lovni bloklamaymiz: avans hisobdan oldin beriladi).
- Oylik berilgan xodimni o'chirib bo'lmaydi (FE001) — arxivlanadi (`active = false`).
- Sotuvchi: faqat o'z `member_user_id` bog'langan xodim kartasi va oyligi (o'qish). Boshqalarnikini ko'rmaydi.
- Migratsiya `begin…commit`; definer funksiyalar mijoz yuborgan havolalarga ishonmaydi.

## Review Focus
1. Sotuvchi boshqa xodimning oyligini/pog'onasini/to'lovini ko'rmaydi → SQL `seller sees only own payroll`.
2. Pog'ona chegaralari (19 999.99 → 2%, 20 000 → 3%, 60 000 → 4%) → SQL `commission tiers by whole volume`.
3. Bekor qilingan buyurtma va boshqa oy buyurtmalari savdoga kirmaydi; kechroq to'langan qoldiq buyurtma oyiga yoziladi → SQL `sales counted by order month`.
4. Belgilangan oylik proporsiyasi va boshqa valyutadagi to'lov → SQL `fixed salary prorated, foreign payment converted`.
5. To'lov o'chirilsa kassa amali ham o'chadi; oylik berilgan xodim o'chmaydi → SQL `salary payment lifecycle`.

### Task 1: Migratsiya + SQL testlar — `supabase/migrations/20261109120000_payroll.sql`, `supabase/tests/payroll.test.mjs`
### Task 2: Tiplar, hook'lar (`hooks/usePayroll.ts`), oy yordamchilari (`lib/months.ts` + test)
### Task 3: Ekranlar — Faridun → Xodimlar (oy tanlash, ro'yxat: hisoblangan/berilgan/qoldiq), `app/employee/new.tsx`, `app/employee/[id].tsx` (karta, plan bajarilishi, ishlagan kun, to'lovlar), `app/employee/edit/[id].tsx`, `app/employee/pay/[id].tsx`; sotuvchiga "Mening oyligim"
### Task 4: Yakuniy tekshiruv → tuzatish → jonli migratsiya → push
