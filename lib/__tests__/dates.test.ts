/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatClock, formatDayTime, msUntilNextDay } from '@/lib/dates';

test('formatClock pads hours and minutes', () => {
  assert.equal(formatClock(new Date(2026, 10, 8, 9, 5)), '09:05');
  assert.equal(formatClock(new Date(2026, 10, 8, 21, 42)), '21:42');
});

test('formatDayTime shows the time only when the entry was made that same day', () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 30);
  const enteredToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 31);
  assert.match(formatDayTime(today, enteredToday), /, 08:30$/);

  // O'tgan sana bilan kiritilgan amal: vaqti noma'lum (12:00 shartli) — faqat sana.
  const backdated = new Date(2026, 0, 3, 12, 0);
  assert.doesNotMatch(formatDayTime(backdated, enteredToday), /\d{2}:\d{2}/);
});

test('msUntilNextDay counts down to local midnight', () => {
  assert.equal(msUntilNextDay(new Date(2026, 10, 8, 23, 59, 0)), 60_000);
  assert.equal(msUntilNextDay(new Date(2026, 10, 8, 0, 0, 0)), 24 * 60 * 60 * 1000);
});
