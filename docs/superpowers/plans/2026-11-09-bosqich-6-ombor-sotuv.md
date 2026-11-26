# Bosqich 6 — Ombor va Sotuv hisoboti — Implementation Plan

> **For agentic workers:** superpowers:executing-plans (native). Checkbox steps.

**Goal:** Faridun → **Ombor**: mahsulotlar (Rezka/Quyma/Mishalka) va materiallar (penoplast, qum, ximikat, qoliplar…) katalogi, qoldiq, kirim/chiqim; buyurtma "Yetkazildi" bo'lganda mahsulot va test materiallari avtomatik chiqim, qayta ochilsa/bekor qilinsa — qaytariladi. Faridun → **Sotuv**: oylar va sotuvchilar kesimida savdo, to'langan, qarzdorlik, eng ko'p sotilgan mahsulotlar (faqat egasi).

**Egasi bilan kelishilgan (2026-11-09):** ombor buyurtmalar bilan bog'lanadi, yetkazilganda avtomatik ayiriladi.

**Mening qarorlarim (ruling):**
- Buyurtma qatori katalogdagi mahsulotga bog'lanadi (`order_items.stock_item_id`); erkin nom qoladi, lekin ombordan ayirilmaydi.
- Uchta doimiy material: Penoplast (dona), Qum (kg), Ximikat (kg) — `system_key` bilan; test mahsulotlar shularga yoziladi.
- Qoldiq manfiy bo'lishi mumkin (yetkazish ishlab chiqarishdan oldin yozilishi mumkin) — qizil ko'rinadi; `min_qty` dan past — ogohlantirish.
- Katalog nomlari jamoaga ko'rinadi (sotuvchi buyurtmada tanlaydi), qoldiq va harakatlar — faqat egasiga.
- Sotuv hisobotida to'langan summa $ da (to'lovga muhrlangan kurs), kelishuv narxi va qoldiq — valyuta bo'yicha alohida.

**Architecture:** Migratsiya `20261109150000_warehouse.sql`: `stock_items`, `stock_movements`, `stock_balances` view (invoker), `order_items.stock_item_id`; definer `sync_order_stock(order_id)` + trigger'lar (orders status/test materiallari, order_items o'zgarishi); `ensure_stock_defaults()`; `sales_report(p_from, p_to)`, `top_products(p_from, p_to)` (faqat egasi).

## Review Focus
1. Yetkazildi → chiqim; qayta ochish/bekor → qaytadi; ikki marta yetkazildi → ikki marta ayirilmaydi → SQL `delivery moves stock once and reverts`.
2. Yetkazilgan buyurtma mahsuloti/miqdori tahrirlansa — harakatlar qayta hisoblanadi → SQL `editing delivered order resyncs stock`.
3. Sotuvchi qoldiq/harakatlarni ko'rmaydi, katalog nomlarini ko'radi; begona biznes katalogiga bog'lab bo'lmaydi → SQL `stock visibility and forging`.
4. Qo'lda harakat buyurtmaga bog'lanib/`order` sababi bilan yozilmaydi → SQL `manual movements cannot impersonate orders`.
5. Hisobot: bekor qilinganlar savdoga kirmaydi; sotuvchi bo'yicha to'g'ri → SQL `sales report aggregates`.

### Task 1: Migratsiya + SQL testlar
### Task 2: Tiplar, hook'lar (`hooks/useStock.ts`, `hooks/useSalesReport.ts`)
### Task 3: Ekranlar — Faridun bo'limlari (chiplar: Buyurtmalar, Xodimlar, Ombor, Sotuv), `app/stock/new.tsx`, `app/stock/[id].tsx`, `app/stock/move/[id].tsx`; buyurtma formasida katalogdan tanlash
### Task 4: Yakuniy tekshiruv → tuzatish → jonli migratsiya → push
