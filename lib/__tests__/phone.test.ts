/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatPhone, normalizePhone, phoneCountry } from '@/lib/phone';
import { validatePhone } from '@/lib/validation';

test('phone parsing accepts any country and strips invisible characters', () => {
  assert.equal(normalizePhone('+992 55 263 6262'), '+992552636262');
  assert.equal(normalizePhone('‪+992 55 263 6262‬'), '+992552636262');
  assert.equal(normalizePhone('+992 55 263 6262'), '+992552636262');
  assert.equal(normalizePhone('90 123 45 67'), '+998901234567');
  assert.equal(normalizePhone('+1 415 555 2671'), '+14155552671');
  assert.equal(normalizePhone('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizePhone('+7 912 345-67-89'), '+79123456789');
  assert.equal(normalizePhone(''), null);
});

test('phone validation rejects impossible numbers', () => {
  assert.equal(validatePhone(''), undefined);
  assert.equal(validatePhone('+992 55 263 6262'), undefined);
  assert.equal(validatePhone('‪+992 55 263 6262‬'), undefined);
  assert.notEqual(validatePhone('+12'), undefined);
  assert.notEqual(validatePhone('abc'), undefined);
});

test('phone country and display format', () => {
  assert.equal(phoneCountry('+992 55'), 'TJ');
  assert.equal(phoneCountry('+998901234567'), 'UZ');
  assert.equal(phoneCountry('+7 912 345 67 89'), 'RU');
  assert.equal(phoneCountry('12'), null);
  assert.equal(formatPhone('+992552636262'), '+992 55 263 6262');
  assert.equal(formatPhone('+998 90 123-45-67'), '+998 90 123 45 67');
});
