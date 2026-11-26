/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { debtProgress } from '@/lib/debts';
import { validatePhone, validateSector } from '@/lib/validation';

const payment = (amount: number) => ({ id: String(amount), amount, payment_method: 'cash' as const, paid_at: '2026-11-08T10:00:00Z' });

test('progress uses exact cents', () => {
  const p = debtProgress({ amount: 84300000, payments: [payment(30000000.1), payment(0.2)] });
  assert.equal(p.paid, 30000000.3);
  assert.equal(p.remaining, 54299999.7);
  assert.ok(Math.abs(p.ratio - 30000000.3 / 84300000) < 1e-12);
});

test('remaining never negative and ratio capped at 1', () => {
  const p = debtProgress({ amount: 100, payments: [payment(100), payment(5)] });
  assert.equal(p.remaining, 0);
  assert.equal(p.ratio, 1);
  assert.deepEqual(debtProgress({ amount: 50, payments: [] }), { paid: 0, remaining: 50, ratio: 0 });
});

test('validatePhone allows empty and phone characters only', () => {
  assert.equal(validatePhone(''), undefined);
  assert.equal(validatePhone('+998 90 123-45-67'), undefined);
  assert.notEqual(validatePhone('90 abc'), undefined);
  assert.notEqual(validatePhone('+998 90 123 45 67 89 00'), undefined);
});

test('validateSector allows empty, limits length', () => {
  assert.equal(validateSector(''), undefined);
  assert.equal(validateSector('Qurilish'), undefined);
  assert.notEqual(validateSector('x'.repeat(51)), undefined);
});

test('phoneHref keeps only + and digits', async () => {
  const { phoneHref } = await import('@/lib/phone');
  assert.equal(phoneHref('+998 (90) 123-45-67'), 'tel:+998901234567');
});

test('progress converts foreign-currency payments by their rate', () => {
  const p = debtProgress({
    amount: 2400000,
    currency: 'UZS',
    payments: [
      { amount: 100, currency: 'USD', rate_uzs_per_usd: 12000 },
      { amount: 600000, currency: 'UZS', rate_uzs_per_usd: null },
    ],
  });
  assert.equal(p.paid, 1800000);
  assert.equal(p.remaining, 600000);
});

test('payInCurrency rounds up so a foreign payment can close the debt', async () => {
  const { payInCurrency } = await import('@/lib/debts');
  assert.equal(payInCurrency(1000000, 'UZS', 'USD', 12700), 78.75);
  assert.equal(payInCurrency(100, 'USD', 'UZS', 12700), 1270000);
  assert.equal(payInCurrency(250, 'USD', 'USD', 12700), 250);
});

test('exceedsRemaining allows less than one cent of overshoot', async () => {
  const { exceedsRemaining } = await import('@/lib/debts');
  assert.equal(exceedsRemaining(78.75, 'USD', 'UZS', 12700, 1000000), false);
  assert.equal(exceedsRemaining(78.76, 'USD', 'UZS', 12700, 1000000), true);
  assert.equal(exceedsRemaining(100.01, 'USD', 'USD', null, 100), true);
  assert.equal(exceedsRemaining(100, 'USD', 'USD', null, 100), false);
});
