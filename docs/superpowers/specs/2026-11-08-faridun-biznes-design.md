# Faridun CashFlow — biznes rejimi: buyurtmalar, xodimlar, qarzlar, menyu

Sana: 2026-11-08 · Holat: egasi tasdiqlashi kutilmoqda

## 1. Maqsad va nima uchun

Faridun CashFlow hozir bitta odamning shaxsiy kirim-chiqim daftari. Egasi uni
**kompaniya boshqaruv ilovasiga** aylantirmoqchi:

- sotuvchilar o'z telefonidan buyurtma kiritadi, hamma umumiy ro'yxatni ko'radi;
- mijoz to'lovlari, qarz to'lovlari va xodim oyliklari **avtomatik** kompaniya kassasiga
  (kirim/chiqim) tushadi — qo'lda ikki marta yozilmaydi;
- xodim oyligi (belgilangan yoki savdodan foiz) avtomatik hisoblanadi;
- keyinchalik **ombor** va **sotuv** bo'limlari qo'shiladi — tuzilma shunga tayyor bo'lishi kerak.

Muvaffaqiyat: egasi bir ekrandan kassani, qarzlarni, buyurtmalar qoldig'ini va har bir xodimga
bu oy qancha berish kerakligini ko'radi; sotuvchi faqat o'z ishiga kerakli narsani ko'radi.

## 2. Maqsadlar / maqsad emas / muvaffaqiyatsizlik belgilari

**Maqsadlar**
1. Pastki menyu: ikonkalar, kattaroq yozuv va panel; markazda Faridun logotipli bo'lim.
2. Hisobot davrlari: kunlik, haftalik, oylik, 3 oylik, 6 oylik, yillik.
3. Qarzlar: bo'lib to'lash, ko'rinadigan "Qarzimni berdim / Qarzini berdi", tahrirlash,
   telefon (qo'ng'iroq) va soha, qarz olish/berishda naqd/karta/nasiya.
4. Biznes va jamoa: egasi + sotuvchilar, kod orqali qo'shilish, rollar.
5. Buyurtmalar: to'liq kartochka, bo'lib to'lovlar, Markaziy bank kursi, Yandex xarita.
6. Xodimlar va oylik: belgilangan (kunga proporsional) va pog'onali foiz.

**Maqsad emas (hozircha)**
- Ombor va sotuv bo'limlari (keyingi bosqich; faqat joy qoldiriladi).
- Kunlik davomat (oyiga bir marta "ishlagan kuni" kiritiladi).
- Push-xabarlar buyurtmalar uchun, offline rejim, bir foydalanuvchining bir nechta biznesi.
- Buyurtma pozitsiyalariga alohida narx (narx butun buyurtmaga bitta).

**Muvaffaqiyatsizlik belgilari (ishlasa ham — yomon)**
- Sotuvchi kompaniya kassasini, qarzlarni yoki boshqalarning oyligini ko'ra olsa.
- Kurs o'zgarganda o'tgan oylar savdosi/oyligi o'zgarib ketsa.
- Migratsiyadan keyin mavjud amallar, qarzlar yoki balans yo'qolsa/o'zgarsa.
- Bitta to'lov kassaga ikki marta tushsa yoki to'lov o'chirilganda amal qolib ketsa.

## 3. Cheklovlar

- Stack o'zgarmaydi: Expo SDK 58, Expo Router, NativeWind, TanStack Query, Zustand, Supabase
  (Postgres + RLS). Veb-versiya Vercel'da (PWA), native — EAS.
- Xavfsizlik faqat RLS orqali (klientda faqat publishable kalit). Pul bilan bog'liq ko'p bosqichli
  yozuvlar (to'lov + kassa amali) **bitta Postgres funksiyasida (RPC)** atomik bajariladi —
  hozirgi `pay_debt` kabi.
- Migratsiyalar `supabase/migrations/` da; egasi ularni Supabase SQL Editor'da qo'lda ishga
  tushiradi (README). Migratsiya mavjud ma'lumotni yo'qotmasligi va qayta ishga tushirilganda
  buzilmasligi kerak.
- Bepul tashqi xizmatlar: kurs — `https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/`
  (CORS ochiq, tekshirildi), xarita — Yandex Maps havolasi (API kaliti shart emas).
- Barcha matnlar `constants/texts.ts` da, ranglar `constants/colors.ts` da (Faridun palitrasi).

## 4. Ko'rib chiqilgan yondashuvlar

| | Yondashuv | Afzallik | Kamchilik |
|---|---|---|---|
| **A (tanlandi)** | Butun moliya (kirim-chiqim, qarzlar, kategoriyalar) + buyurtmalar + xodimlar **biznesga** tegishli; rollar: egasi / sotuvchi | Yagona kompaniya kassasi; ombor/sotuv/buxgalter keyin oson qo'shiladi | Ko'proq ish; mavjud ma'lumotni biznesga ko'chirish kerak |
| B | Kassa egasining shaxsiy hisobida, faqat buyurtma/xodimlar umumiy | Tezroq | Kassa bitta odamga bog'liq; ombor/sotuvda baribir A ga o'tish kerak |
| C | Buyurtmalar alohida, kassaga bog'lanmaydi | Eng sodda | Egasi so'ragan avtomatik hisobga zid |

Egasi **A** ni tanladi.

## 5. Bosqichlar (alohida yetkaziladi, shu tartibda)

1. **Menyu va hisobot davrlari** — ma'lumotlar bazasiga tegmaydi.
2. **Biznes, jamoa, rollar** + mavjud ma'lumotni ko'chirish (qolgan hammasi shunga tayanadi).
3. **Qarzlar** yangilanishi.
4. **Buyurtmalar** + kurs.
5. **Xodimlar va oylik.**

Har bir bosqichdan keyin: `tsc`, veb-build, egasi sinab ko'radi, push → Vercel.

## 6. Egasi bilan kelishilgan qarorlar

### 6.1 Pastki menyu
- Har bir yozuv yonida/ustida ma'noli ikonka; yozuvlar va panel balandligi kattalashtiriladi
  (barmoq bilan qulay bosiladigan).
- **Tarix va Qarzlar o'rtasida** nomsiz bo'lim: **aylana ichida Faridun logotipi** (brend qizil
  aylana, oq belgi — `assets/logo.png`/muqova vektoridan). Ichida: **Buyurtmalar** va
  **Xodimlar**; keyin Ombor, Sotuv qo'shiladi.

### 6.2 Hisobot davrlari
Kunlik, haftalik, oylik, 3 oylik, 6 oylik, yillik (hozirgi 30 kun / 3 oy / 1 yil o'rniga).

### 6.3 Biznes va jamoa
- Sotuvchilar o'z telefonidan kiradi, o'z buyurtmalarini qo'shadi, **umumiy** ro'yxatni ko'radi.
- Buyurtmadagi "Sotuvchi" — uni kiritgan foydalanuvchi (avtomatik).
- Xodimlar ro'yxati va boshqalarning oyligini **faqat egasi** ko'radi; sotuvchi faqat
  **o'z** oyligini ko'radi (9-bo'lim). Kassa, qarzlar, kategoriyalar, hisobotlar — faqat egasiga.

### 6.4 Qarzlar
- **Bo'lib to'lash**: har bir to'lov alohida (summa, sana, naqd/karta). Qarzda "to'langan /
  qoldiq" ko'rinadi; qoldiq 0 bo'lsa qarz "To'langan".
- Har bir to'lov **avtomatik** kassaga: kompaniya qarzi to'lansa — chiqim, mijoz qaytarsa — kirim.
  To'lov o'chirilsa, uning kassa amali ham o'chadi.
- Ro'yxatning o'zida tugma: payable → **"Qarzimni berdim"**, receivable → **"Qarzini berdi"**.
  Tahrirlash ko'rinadigan (summa, kim, muddat, izoh, telefon, soha).
- Yangi maydonlar: **telefon** (bosganda qo'ng'iroq — `tel:`), **soha** (erkin matn).
- To'lash/qabul qilish naqd yoki karta, so'm yoki dollarda.
- Qarz qo'shishda **"Pul qanday o'tdi?"**: Naqd / Karta → kassada darhol amal (payable: qarz
  oldik → kirim; receivable: qarz berdik → chiqim); **Pulsiz (nasiya)** → kassa o'zgarmaydi.

### 6.5 Buyurtmalar
Maydonlar (egasining ro'yxati):
- Mijoz ismi; **buyurtma raqami** (biznes bo'yicha avtomatik, `№0001`); telefon (qo'ng'iroq).
- Manzil (matn) va lokatsiya: joriy joylashuvni olish **yoki** Yandex havolasini qo'yish;
  bosganda Yandex Xarita ochiladi.
- Kelishuv narxi, avans, qoldiq (avtomatik), chegirma, buyurtma kuni, yetkazish kuni, sotuvchi.
- **Mahsulotlar**: bir nechta qator; har qatorda tur (**Rezka / Quyma / Mishalka**), nomi,
  miqdori (**dona**).
- **Qo'shimchalar** (har biri bor/yo'q): bepul yetkazib berish, o'rnatish, o'rgatib berish,
  qoliplar.
- **Test mahsulotlar**: penoplast (dona), qum (kg), ximikatlar (kg).

To'lovlar:
- Har bir mijoz to'lovi: **naqd so'm, naqd $, karta so'm, karta $**. Avans — birinchi to'lov(lar);
  keyingilari bo'lib to'lov.
- Har bir to'lov avtomatik kassaga **kirim**.
- So'mdagi to'lovda **Markaziy bank kursi avtomatik** olinadi va to'lovga **muhrlanadi**;
  kerak bo'lsa qo'lda tuzatiladi. Kurs olinmasa (internet yo'q) — qo'lda kiritish majburiy.

### 6.6 Xodimlar va oylik
- Xodim: **ismi, telefoni, lavozimi**; oylik turi: **belgilangan** yoki **foiz**.
- **Belgilangan**: oylik summa + me'yor kunlar (standart 25). Oyiga bir marta "ishlagan kuni"
  kiritiladi; hisob: `oylik ÷ me'yor × ishlagan kun` (7 000 000 ÷ 25 × 20 = 5 600 000).
- **Foiz**: asos — mijoz **amalda to'lagan** pul (USD ga kurs bo'yicha o'girilgan);
  buyurtma qilingan **oyga** yoziladi (keyinroq to'langan qoldiq o'sha oyga qo'shiladi, oylik
  qayta hisoblanadi).
- **Pog'onali oylik plan** (xodim bo'yicha sozlanadi), masalan: 20 000 $ — 2%,
  20 000–35 000 $ — 3%, 35 000–50 000 $ — 4%. Foiz **butun savdoga** qo'llanadi
  (30 000 $ → 3% → 900 $). Ekranda plan bajarilishi va keyingi pog'onagacha qolgani.
- Nazorat (oy bo'yicha, har xodim): **hisoblangan — berilgan (avans + oylik) — qoldiq**.
  Berilgan har bir pul avtomatik kassaga **chiqim**.

## 7. Ma'lumotlar modeli (yo'nalish; aniq SQL — quruvchiga)

- `businesses` (id, name, owner_id, join_code unique) ·
  `business_members` (business_id, user_id unique, role `owner|seller`, status `pending|active`).
  Bir foydalanuvchi — bitta biznes.
- `categories`, `transactions`, `debts` ga `business_id`; `user_id` "kim kiritgan" bo'lib qoladi.
  RLS: moliya jadvallari — faqat **active owner**; `balances` view `business_id` bo'yicha.
- Ko'chirish: har bir mavjud foydalanuvchi uchun bitta biznes (o'zi owner), uning barcha
  yozuvlari shu biznesga.
- `debts` + `phone`, `sector`, `origin_method` (`cash|card|null`=nasiya), `origin_transaction_id`.
  `debt_payments` (debt_id, amount, payment_method, paid_at, transaction_id). Eski `paid_at` +
  `transaction_id` bo'lgan qarzlar bitta to'lovga ko'chiriladi. `pay_debt/unpay_debt` →
  `add_debt_payment/delete_debt_payment` (atomik, kassa amali bilan).
- `orders` (business_id, number, customer_name, phone, address, location_url, lat/lng,
  agreed_price, currency, discount, order_date, delivery_date, seller_id, 4 ta bool qo'shimcha,
  penoplast_count, sand_kg, chemicals_kg) · `order_items` (order_id, product_type
  `rezka|quyma|mishalka`, name, quantity int) · `order_payments` (order_id, amount, currency,
  payment_method, rate_uzs_per_usd, amount_usd, is_advance, paid_at, received_by, transaction_id).
- `employees` (business_id, full_name, phone, position, pay_type `fixed|commission`,
  fixed_salary, salary_currency, norm_days=25, member_user_id — foizli sotuvchining akkaunti) ·
  `commission_tiers` (employee_id, from_usd, to_usd, percent) · `payroll_days` (employee_id,
  month, days_worked) · `salary_payments` (employee_id, month, amount, currency,
  payment_method, kind `advance|salary`, paid_at, transaction_id).
- Avtomatik kassa amallari uchun tizim kategoriyalari (biznes bo'yicha): "Buyurtma to'lovlari"
  (kirim), "Oylik" (chiqim), "Olingan qarzlar" (kirim), "Berilgan qarzlar" (chiqim) + mavjud
  ikki qarz kategoriyasi.

## 8. Quruvchiga qoldirilgan (o'z qarori — belgilangan)

Quyidagilar egasi bilan muhokama qilinmagan; **mening qarorim**, egasi o'qib tuzatishi mumkin:
- **Qo'shilish**: ro'yxatdan o'tgach biznesi yo'q foydalanuvchi "Biznes yaratish" yoki
  "Kod bilan qo'shilish" ni tanlaydi; kod bilan kelgan sotuvchi egasi **tasdiqlaguncha** kira
  olmaydi (Profil → Jamoa: tasdiqlash/chiqarish).
- **Sotuvchi menyusi**: faqat Faridun bo'limi (Buyurtmalar, Mening oyligim) va Profil.
- **Buyurtma huquqlari**: sotuvchi o'z buyurtmasini tahrirlaydi/to'lov qo'shadi; egasi
  hammasini, sotuvchini almashtirishni ham. O'chirish — faqat egasi.
- **Buyurtma holati**: Yangi / Yetkazildi / Bekor qilindi (ro'yxatda filtr; bekor qilinganning
  to'lovlari foizga kirmaydi).
- **Qoldiq** = kelishuv narxi − chegirma − to'lovlar (buyurtma valyutasiga o'girilgan).
  Kelishuv narxi **chegirmadan oldingi** narx deb olinadi.
- **Qarz to'lovi valyutasi** qarz valyutasi bilan bir xil (so'm qarz — so'mda to'lanadi).
- **Belgilangan oylik** valyutasi xodim bo'yicha tanlanadi (standart so'm); foizli oylik — $.
- **Hisobot davrlari** sirpanuvchi: kunlik — bugun (soatlar bo'yicha), haftalik — 7 kun (kunlar),
  oylik — 30 kun (haftalar), 3/6/12 oy — oylar bo'yicha.
- Ikonkalar: iOS — SF Symbols, Android/veb — `@expo/vector-icons` (yoki SDK 58 NativeTabs'ning
  rasm ikonkasi); aniq usul SDK 58 hujjatidan tekshiriladi.
- Kurs keshi: kuniga bir marta; kurs sanasi to'lov sanasi bo'yicha (arxiv endpoint'i).

## 9. Builder tekshiruvidan keyin aniqlangan

**Egasining javoblari**
1. **Mavjud akkauntlar**: egasidan boshqa hech kim ro'yxatdan o'tmagan. Ko'chirish oddiy:
   har bir mavjud foydalanuvchi — o'z biznesining egasi; birlashtirish qadami kerak emas.
2. **Foiz pog'onalari**: 0 dan 20 000 $ gacha — 2% (pastki chegara yo'q, birinchi dollardan).
   Chegaralar: pastki chegara pog'onaga kiradi (aniq 20 000 $ → 3%) — _mening qarorim_.
   50 000 $ dan yuqori — oxirgi pog'ona foizi davom etadi, egasi xohlasa yangi pog'ona qo'shadi
   (`to_usd` ochiq bo'lishi mumkin) — _mening qarorim_.
3. **Sotuvchi o'z oyligini ko'radi**: o'z plan bajarilishi, hisoblangan oyligi, berilgan va
   qoldiq — faqat o'ziniki. Sotuvchi menyusi: Faridun bo'limi (Buyurtmalar + "Mening oyligim")
   va Profil. RLS: `employees.member_user_id = auth.uid()` bo'lgan qatorlar va ularning
   pog'ona/kun/to'lovlari faqat o'qish uchun.
4. **Boshqalarning buyurtmalari**: sotuvchi umumiy ro'yxatni ko'radi, lekin **boshqa
   sotuvchilar buyurtmasining narxi, chegirmasi, to'lovlari va qoldig'ini ko'rmaydi** (mijoz,
   telefon, manzil, mahsulotlar, qo'shimchalar, sanalar, holat, sotuvchi ko'rinadi). O'z
   buyurtmalarini to'liq ko'radi. Amalga oshirish: sotuvchilar uchun pul ustunlarini
   `seller_id = auth.uid()` bo'lmaganda yashiradigan view yoki RPC; `order_payments` RLS —
   egasi yoki buyurtma sotuvchisi.

**Mening qarorlarim (tekshiruvdan)**
- **To'lovni o'chirish/tahrirlash** (buyurtma, qarz, oylik) — faqat egasi. Sotuvchi faqat
  qo'shadi.
- **Avtomatik kassa amallari** (`transactions.source` ≠ qo'lda) Tarixda to'g'ridan-to'g'ri
  tahrirlanmaydi/o'chirilmaydi — manbasi (buyurtma/qarz/oylik) orqali; RLS/trigger bilan himoya.
- **Bekor qilingan buyurtma**: holat "Bekor qilindi"; agar pul qaytarilsa, egasi "Qaytarildi"
  yozuvini qo'shadi → kassada chiqim ("Buyurtma qaytarishlari"); to'lovlar va qaytarishlar
  foizga kirmaydi.
