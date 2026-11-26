/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cbuRateUrl, parseCbuRate } from '@/lib/exchangeRate';
import { formatOrderNumber, orderRemaining, toOrderCurrency, yandexMapsUrl } from '@/lib/orders';

test('toOrderCurrency converts with the stamped rate', () => {
  assert.equal(toOrderCurrency(1200000, 'UZS', 'USD', 12000), 100);
  assert.equal(toOrderCurrency(100, 'USD', 'UZS', 12000), 1200000);
  assert.equal(toOrderCurrency(55, 'USD', 'USD', 12000), 55);
});

test('orderRemaining subtracts discount and payments, never negative', () => {
  const order = { agreed_price: 1000, discount: 100, currency: 'USD' as const };
  assert.equal(orderRemaining(order, []), 900);
  assert.equal(
    orderRemaining(order, [
      { amount: 1200000, currency: 'UZS', rate_uzs_per_usd: 12000 },
      { amount: 799.99, currency: 'USD', rate_uzs_per_usd: 12100 },
    ]),
    0.01,
  );
  assert.equal(orderRemaining(order, [{ amount: 950, currency: 'USD', rate_uzs_per_usd: 1 }]), 0);
});

test('formatOrderNumber pads to four digits', () => {
  assert.equal(formatOrderNumber(7), '№0007');
  assert.equal(formatOrderNumber(12345), '№12345');
});

test('yandexMapsUrl prefers link, then coordinates, then address', () => {
  assert.equal(
    yandexMapsUrl({ location_url: 'https://yandex.uz/maps/-/CDabc', latitude: 41.3, longitude: 69.2, address: 'x' }),
    'https://yandex.uz/maps/-/CDabc',
  );
  assert.equal(
    yandexMapsUrl({ location_url: null, latitude: 41.311081, longitude: 69.240562, address: 'x' }),
    'https://yandex.uz/maps/?pt=69.240562,41.311081&z=17&l=map',
  );
  assert.equal(
    yandexMapsUrl({ location_url: null, latitude: null, longitude: null, address: 'Toshkent, Chilonzor 9' }),
    'https://yandex.uz/maps/?text=Toshkent%2C%20Chilonzor%209',
  );
  assert.equal(yandexMapsUrl({ location_url: null, latitude: null, longitude: null, address: null }), null);
});

test('parseCbuRate reads the USD rate', () => {
  assert.equal(parseCbuRate([{ Ccy: 'USD', Rate: '11987.16', Date: '07.11.2026' }]), 11987.16);
  assert.equal(parseCbuRate([]), null);
  assert.equal(parseCbuRate({ error: 1 }), null);
  assert.equal(cbuRateUrl(new Date(2026, 10, 8)), 'https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/2026-11-08/');
});
