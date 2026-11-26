# Bosqich 4 — Buyurtmalar va valyuta kursi — Implementation Plan

> **For agentic workers:** superpowers:executing-plans (native). Checkbox steps.

**Goal:** Faridun bo'limida buyurtmalar: to'liq kartochka (spec 6.5), mahsulot qatorlari, qo'shimchalar, test mahsulotlar, bo'lib to'lovlar (naqd/karta, so'm/$) Markaziy bank kursi bilan, har to'lov kassaga kirim; sotuvchi boshqalar buyurtmasining pulini ko'rmaydi.

**Architecture:** Migratsiya: `orders`, `order_items`, `order_payments`; `businesses.order_seq` (biznes bo'yicha raqam, trigger); `transactions.source` + `order_payment`, `transactions.order_id`. Pul ustunlari sotuvchidan `order_list` view orqali yashiriladi (definer view, `current_business_id()` bilan filtr; pul faqat egasi yoki o'z buyurtmasi bo'lsa). To'lov — `add_order_payment` RPC (egasi yoki buyurtma sotuvchisi; kurs muhrlanadi; kassaga kirim "Buyurtma to'lovlari"), o'chirish — `delete_order_payment` (faqat egasi). Kurs: klient CBU'dan oladi (`https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/<YYYY-MM-DD>/`), qo'lda tuzatiladi. Qoldiq va USD qiymat — sof funksiyalar (tiyinlarda).

**Spec:** `docs/superpowers/specs/2026-11-08-faridun-biznes-design.md` (6.5, 7, 8, 9.4).

## Global Constraints
- Maydonlar spec 6.5 bo'yicha. Raqam `№0001` (biznes ichida ketma-ket).
- Qoldiq = kelishuv narxi − chegirma − to'lovlar (buyurtma valyutasiga muhrlangan kurs bilan o'girilgan); 0 dan kam emas. Ortiqcha to'lov — `FO001`.
- Har to'lovda kurs muhrlanadi (`rate_uzs_per_usd`, ikkala valyutada ham); `amount_usd` saqlanadi (5-bosqich foiz hisobi uchun).
- Sotuvchi: buyurtma qo'shadi, o'zinikini tahrirlaydi va to'lov qo'shadi; boshqalarnikida pul maydonlari `null`. To'lov va buyurtmani o'chirish — faqat egasi. Holat: `new | delivered | cancelled`.
- Lokatsiya: vebda `navigator.geolocation` (PWA), native'da faqat Yandex havolasi (expo-location npm muammosi sababli — ruling). Bosilganda Yandex Xarita: havola bo'lsa — o'zi, koordinata bo'lsa — `https://yandex.uz/maps/?pt=<lng>,<lat>&z=17&l=map`, aks holda `?text=<manzil>`.
- Migratsiya `begin…commit`; trigger/definer funksiyalar mijoz yuborgan havola ustunlariga ishonmaydi (3-bosqich C1 saboqi).

## Review Focus
1. Sotuvchi boshqa sotuvchi buyurtmasining narxi/to'lovini o'qiy olmaydi (view ham, jadval ham) → SQL `seller sees others' orders without money`.
2. Ortiqcha to'lov rad etiladi; so'm to'lov dollar buyurtmani kurs bo'yicha yopadi → SQL `cross-currency payment uses stamped rate` + TS `orderProgress`.
3. To'lov o'chirilsa kassa amali ham o'chadi → SQL `deleting order payment removes transaction`.
4. Raqamlar biznes ichida ketma-ket, boshqa biznesga bog'liq emas → SQL `order numbers per business`.
5. Sotuvchi o'z buyurtmasining `seller_id` ini boshqaga o'zgartira olmaydi / boshqa buyurtmani tahrirlay olmaydi → SQL `seller edits only own order`.

### Task 1: Migratsiya + SQL testlar — `supabase/migrations/20261108230000_orders.sql`, `supabase/tests/orders.test.mjs`
### Task 2: Tiplar, `lib/orders.ts` (`orderProgress`, `toOrderCurrency`, `yandexMapsUrl`, `formatOrderNumber`), `lib/exchangeRate.ts` (`fetchUsdRate(date)`), hook'lar `hooks/useOrders.ts` + TS testlar
### Task 3: Ekranlar — `app/(tabs)/faridun.tsx` (Buyurtmalar ro'yxati: qidiruv, holat filtri; egasiga Xodimlar — 5-bosqich), `app/order/new.tsx`, `app/order/[id].tsx` (ko'rish + tahrirlash + holat + to'lovlar), `app/order/pay/[id].tsx`, `components/orders/*`
### Task 4: Yakuniy tekshiruv → tuzatish → jonli migratsiya → push
