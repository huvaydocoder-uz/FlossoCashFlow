import type { CurrencyCode } from '@/types/database';

// To'lovni buyurtma valyutasiga o'giradi (to'lovga muhrlangan kurs: 1 $ = rate so'm).
export function toOrderCurrency(amount: number, currency: CurrencyCode, orderCurrency: CurrencyCode, rate: number): number {
  if (currency === orderCurrency) {
    return amount;
  }
  return orderCurrency === 'USD' ? amount / rate : amount * rate;
}

type PaymentLike = { amount: number; currency: CurrencyCode; rate_uzs_per_usd: number };
type OrderMoney = { agreed_price: number; discount: number; currency: CurrencyCode };

// Qoldiq = kelishuv narxi − chegirma − to'lovlar (tiyinlarda, 0 dan kam emas) — bazadagi hisob bilan bir xil.
export function orderRemaining(order: OrderMoney, payments: ReadonlyArray<PaymentLike>): number {
  const paid = payments.reduce(
    (sum, item) => sum + toOrderCurrency(item.amount, item.currency, order.currency, item.rate_uzs_per_usd),
    0,
  );
  const due = Math.round((order.agreed_price - order.discount) * 100);
  return Math.max(due - Math.round(paid * 100), 0) / 100;
}

export function formatOrderNumber(value: number): string {
  return `№${String(value).padStart(4, '0')}`;
}

type Location = {
  location_url: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
};

// Yandex Xarita: havola bo'lsa — o'zi, koordinata bo'lsa — nuqta, aks holda manzil bo'yicha qidiruv.
export function yandexMapsUrl(location: Location): string | null {
  if (location.location_url !== null && location.location_url.length > 0) {
    return location.location_url;
  }
  if (location.latitude !== null && location.longitude !== null) {
    return `https://yandex.uz/maps/?pt=${location.longitude},${location.latitude}&z=17&l=map`;
  }
  const address = location.address?.trim() ?? '';
  return address.length > 0 ? `https://yandex.uz/maps/?text=${encodeURIComponent(address)}` : null;
}
