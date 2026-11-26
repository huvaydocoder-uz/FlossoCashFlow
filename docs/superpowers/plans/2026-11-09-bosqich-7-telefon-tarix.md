# Bosqich 7 — Xalqaro telefon raqamlari va xodim almashganda tarix saqlanishi

**Goal:** (1) Telefon maydonlari (qarz, buyurtma, xodim) dunyoning istalgan raqamini qabul qiladi, davlatni avtomatik aniqlaydi va bayroqni ko'rsatadi; ko'rinmas belgilar (iPhone nusxa) tozalanadi; bazada E.164 (`+992552636262`) saqlanadi. (2) Xodim yoki sotuvchi almashganda tarix saqlanadi: oylik berilgan xodim "o'chirilganda" arxivlanadi (yashiriladi, to'lovlar va kassa qoladi); jamoadan chiqarilgan yoki akkaunti o'chirilgan foydalanuvchining kassa amallari, kategoriyalari, qarzlari, buyurtmalari va sotuvchi ismi saqlanadi.

**Rulings:**
- `libphonenumber-js` (sof JS, bog'liqliksiz) — operatorlarni tekshirmaymiz, `isPossible` (uzunlik/kod) yetarli; "+" siz kiritilsa — O'zbekiston (+998) deb olinadi.
- Bayroq — flagcdn.com rasmi (Windows'da bayroq emoji ko'rinmaydi), yuklanmasa — davlat kodi matni.
- `transactions/categories/debts.user_id` FK: `on delete cascade` → `set null` (akkaunt o'chsa kassa yo'qolmaydi). `orders.seller_name` — ism muhri.
- Oylik berilgan xodimni o'chirish → `deleted_at` + arxiv (FE001 o'rniga); `payroll()` o'chirilganlarni faqat shu oyda to'lovi bo'lsa ko'rsatadi.

## Review Focus
1. `+992 55 263 6262`, `‪+992…‬` (bidi), `90 123 45 67` (→ +998), `+1 415 555 2671`, `+44 20 7946 0958` qabul; `+12`, `abc` rad → TS `phone parsing`.
2. Akkaunt o'chirilganda kassa amallari/kategoriya/qarz/buyurtma/to'lov qoladi, buyurtmada sotuvchi ismi qoladi → SQL `deleting an account keeps history`.
3. Oylik berilgan xodim o'chirilsa — arxivlanadi, to'lovlar va kassa qoladi, oylik ro'yxatida o'tgan oyda ko'rinadi → SQL `deleting a paid employee archives it`.
