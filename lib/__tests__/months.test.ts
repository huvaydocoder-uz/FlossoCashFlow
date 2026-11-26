/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMonth, monthKey, monthStart, shiftMonth } from '@/lib/months';

test('monthStart and monthKey give the first day of the month', () => {
  assert.deepEqual(monthStart(new Date(2026, 10, 17, 15)), new Date(2026, 10, 1));
  assert.equal(monthKey(new Date(2026, 10, 17)), '2026-11-01');
  assert.equal(monthKey(new Date(2026, 0, 31)), '2026-01-01');
});

test('shiftMonth crosses year boundaries', () => {
  assert.deepEqual(shiftMonth(new Date(2026, 0, 1), -1), new Date(2025, 11, 1));
  assert.deepEqual(shiftMonth(new Date(2026, 11, 1), 1), new Date(2027, 0, 1));
});

test('formatMonth names the month in Uzbek with the year', () => {
  assert.equal(formatMonth(new Date(2026, 10, 1)), 'Noyabr 2026');
});
