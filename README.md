# Flosso CashFlow — kirim va chiqim hisobi

[FLOSSO](https://flosso.uz) (penadekor: karniz, nalichnik, igrushka, podokonnik, taroq-kolonna,
termopanel) uchun mobil ilova: kundalik kirim va chiqimlarni
**so'm (UZS)** va **dollar (USD)** da yozib borish, har bir amalga izoh qo'shish va
kategoriyalarni boshqarish.

## Imkoniyatlar

- Ro'yxatdan o'tish va kirish (email + parol, Supabase Auth)
- **Asosiy panel**: so'm va dollar balanslari, jami kirim/chiqim, oxirgi 5 ta amal
- **Amal qo'shish / tahrirlash / o'chirish**: tur, summa, valyuta, kategoriya, sana, izoh
- **Kategoriyalar**: kirim va chiqim uchun alohida, yaratish va o'chirish
  (o'chirilgan kategoriya amallari «Kategoriyasiz» bo'lib saqlanib qoladi)
- **Tarix**: izoh bo'yicha qidiruv; tur, valyuta, davr va kategoriya bo'yicha filtr
- **Biznes va jamoa**: egasi biznes yaratadi, sotuvchilar 6 belgili kod bilan qo'shiladi va
  egasi tasdiqlagach kiradi. Kassa, qarzlar, kategoriyalar va hisobotlar faqat egasiga ko'rinadi;
  sotuvchida faqat Flosso bo'limi va Profil
- **Ombor** (egasiga):
  - **1-qism — Mahsulotlar**: flosso.uz katalogidagi 56 ta mahsulot kodi (masalan `FKR01-718`),
    narxi (so'm) va o'lchovi (metr / dona) bilan, turlar bo'yicha guruhlangan; nom yoki kod bo'yicha qidiruv
  - **2-qism — Xomashyo** (penadekor ishlab chiqarish): qum (kg), penoplast blok (dona),
    zagustitel K-29 (kg), teksanol (kg), dots (kg)
  - Katalog biznes yaratilganda avtomatik yoziladi (`20261126090100_flosso_catalog.sql`)
- **Profil**: ismni tahrirlash, Jamoa, Kategoriyalar (egasiga), chiqish
- Har bir ekranda yuklanish, xatolik va bo'sh holatlar; pastga tortib yangilash

## Stack

Expo SDK 58 · React Native · TypeScript (strict) · Expo Router · NativeWind ·
Zustand · TanStack Query · Supabase · expo-notifications · EAS Build

## Talablar

- Node.js 20+ va npm
- iPhone/Android'da sinash uchun **Expo Go** ilovasi (App Store / Google Play)
- Supabase loyihasi ([supabase.com](https://supabase.com), bepul tarif yetarli)

## 1. Supabase'ni sozlash (bir marta)

1. Supabase'da yangi loyiha yarating.
2. **SQL Editor** → `supabase/migrations/` dagi fayllarni **nomi tartibida** birma-bir
   joylang → **Run** (har biri bir marta). Jadvallar, `balances` view'i, RLS siyosatlari va
   ruxsatlar yaratiladi. Yangi migratsiya qo'shilganda faqat o'sha faylni ishga tushiring —
   **ilovani deploy qilishdan oldin**.
3. **Authentication → Sign In / Providers → Email** → **Confirm email** ni o'chirib
   qo'yish tavsiya etiladi (aks holda ro'yxatdan o'tgach email tasdiqlash kerak bo'ladi).

## Testlar

```bash
npm test
```

`lib/**/*.test.ts` (sof mantiq) va `supabase/tests/*.test.mjs` (migratsiyalar va RLS —
lokal Postgres, PGlite) ishga tushadi. Node.js 22.6+ kerak.

## 2. `.env` — kerakli o'zgaruvchilar

```bash
copy .env.example .env      # Windows
cp .env.example .env        # macOS / Linux
```

| O'zgaruvchi | Qayerdan olinadi |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → **Connect** yoki Project Settings → API Keys → Project URL |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | O'sha joy → **Publishable key** (`sb_publishable_...`) |

> ⚠️ **Secret / service_role kalitni hech qachon yozmang.** `EXPO_PUBLIC_*` qiymatlar
> ilova ichiga ochiq holda tushadi. Ilova maxfiy kalitni aniqlasa, ishlashdan bosh tortadi.
> Ma'lumotlar xavfsizligini RLS ta'minlaydi: har bir foydalanuvchi faqat o'z yozuvlarini ko'radi.

## 3. Ishga tushirish

```bash
npm install
npx expo start
```

Telefon kompyuter bilan **bitta Wi-Fi**'da bo'lsin. iPhone kamerasi (yoki Android'da
Expo Go) bilan terminaldagi QR kodni skanerlang.

> Windows'da `npx` "выполнение сценариев отключено" xatosini bersa, `npx.cmd expo start` deb yozing.

`.env` o'zgarsa: `npx expo start --clear`.

Tekshiruv: `npx tsc --noEmit` (tiplar), `npx expo-doctor` (bog'liqliklar).

## 4. `.apk` yig'ish (Android) — EAS Build

1. [expo.dev/signup](https://expo.dev/signup) da bepul hisob oching.
2. Kirish va loyihani ulash:
   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```
3. Supabase o'zgaruvchilarini EAS'ga bir marta qo'shing (preview va production uchun):
   ```bash
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL --value "https://....supabase.co" --environment preview --environment production --visibility plaintext
   npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value "sb_publishable_..." --environment preview --environment production --visibility plaintext
   ```
   Tekshirish: `npx eas-cli@latest env:list --environment preview`.
4. Yig'ish:
   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```
5. 10–20 daqiqadan so'ng EAS havola beradi — undan `.apk` ni yuklab, telefonga o'rnating.

> Kompyuterda **git** o'rnatilmagan bo'lsa, buyruqlar oldidan `$env:EAS_NO_VCS=1`
> (PowerShell) yoki `EAS_NO_VCS=1` (bash) qo'ying — yoki git'ni o'rnating.

## 5. iPhone'ga o'rnatish (`.ipa`, TestFlight)

Apple qoidasiga ko'ra iPhone'ga ilova faqat **Apple Developer Program** (yiliga $99)
orqali o'rnatiladi: [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll).

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit
```

EAS Apple ID bilan kirishni so'raydi, sertifikatlarni o'zi yaratadi, ilovani yig'ib
**TestFlight**'ga yuboradi. iPhone'da **TestFlight** ilovasini o'rnating — CashFlow o'sha yerda chiqadi.
(Supabase o'zgaruvchilari `production` muhitida ham bo'lishi kerak — 4-bo'lim, 3-qadam.)

## Papkalar

```
app/                    ekranlar (Expo Router)
  (auth)/               kirish, ro'yxatdan o'tish
  (tabs)/               Asosiy, Tarix, Kategoriyalar, Profil
  transaction/          amal qo'shish (new) va tahrirlash ([id])
components/             qayta ishlatiladigan komponentlar
  ui/                   Button, Input, Card, Chip, SegmentedControl, FormMessage
  states/               Loading / Error / Empty holatlari
hooks/                  ma'lumot hooklari (TanStack Query), forma mantiqi
lib/                    supabase klienti, env, formatlash, sanalar, xatolar
store/                  Zustand: sessiya, tarix filtrlari
types/                  baza va model tiplari
constants/              ranglar, o'lchamlar, matnlar, cheklovlar
supabase/migrations/    SQL migratsiyalar (jadvallar + RLS)
```


## Deploy

Repozitoriy: https://github.com/huvaydocoder-uz/FlossoCashFlow — Vercel'da web versiya
(`vercel.json`: `npx expo export -p web` → `dist`). Vercel loyihasida `EXPO_PUBLIC_SUPABASE_URL` va
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o'zgaruvchilari bo'lishi shart.

> EAS (`.apk` / `.ipa`) uchun bu loyiha yangi: birinchi marta `npx eas-cli@latest init` bilan
> Flosso'ning o'z EAS loyihasini yarating.
