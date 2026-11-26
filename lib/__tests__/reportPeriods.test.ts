/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createReportBuckets, fillReportBuckets, reportRangeStart } from '@/lib/reportPeriods';

// 2026-yil 8-noyabr, yakshanba, 15:30 (mahalliy vaqt).
const NOW = new Date(2026, 10, 8, 15, 30);

const at = (...parts: [number, number, number, number?, number?]) => new Date(...parts).toISOString();

test('day: 6 blocks of 4 hours from midnight', () => {
  const b = createReportBuckets('day', NOW);
  assert.equal(b.length, 6);
  assert.deepEqual(b[0]?.start, new Date(2026, 10, 8, 0, 0));
  assert.deepEqual(
    b.map((x) => x.label),
    ['00:00–04:00', '04:00–08:00', '08:00–12:00', '12:00–16:00', '16:00–20:00', '20:00–24:00'],
  );
});

test('week: 7 days ending today, weekday labels', () => {
  const b = createReportBuckets('week', NOW);
  assert.equal(b.length, 7);
  assert.equal(b[0]?.label, 'Du, 02.11');
  assert.equal(b[6]?.label, 'Ya, 08.11');
});

test('month: 5 weekly blocks starting 34 days ago', () => {
  const b = createReportBuckets('month', NOW);
  assert.equal(b.length, 5);
  assert.deepEqual(b[0]?.start, new Date(2026, 9, 5));
  assert.equal(b[0]?.label, '05.10–11.10');
  assert.equal(b[4]?.label, '02.11–08.11');
});

test('quarter/half: month buckets ending with current month', () => {
  assert.deepEqual(
    createReportBuckets('quarter', NOW).map((x) => x.label),
    ['Sentabr', 'Oktabr', 'Noyabr'],
  );
  assert.equal(createReportBuckets('half', NOW)[0]?.label, 'Iyun');
});

test('year labels add year only for previous year', () => {
  const b = createReportBuckets('year', NOW);
  assert.equal(b.length, 12);
  assert.equal(b[0]?.label, 'Dekabr 2025');
  assert.equal(b[1]?.label, 'Yanvar');
});

test('reportRangeStart equals first bucket start', () => {
  assert.deepEqual(reportRangeStart('month', NOW), new Date(2026, 9, 5));
});

test('fill sums income and expense per bucket', () => {
  const rows = [
    { type: 'income' as const, amount: 100, occurred_at: at(2026, 10, 8, 10) },
    { type: 'expense' as const, amount: 40, occurred_at: at(2026, 10, 8, 11) },
    { type: 'income' as const, amount: 5, occurred_at: at(2026, 10, 8, 9) },
  ];
  const b = fillReportBuckets(createReportBuckets('day', NOW), rows);
  assert.equal(b[2]?.income, 105);
  assert.equal(b[2]?.expense, 40);
});

test('boundary row goes to later bucket', () => {
  const rows = [{ type: 'income' as const, amount: 1, occurred_at: at(2026, 10, 8, 8, 0) }];
  const b = fillReportBuckets(createReportBuckets('day', NOW), rows);
  assert.equal(b[1]?.income, 0);
  assert.equal(b[2]?.income, 1);
});

test('rows before range are ignored', () => {
  const rows = [{ type: 'expense' as const, amount: 9, occurred_at: at(2026, 10, 7, 23, 59) }];
  const b = fillReportBuckets(createReportBuckets('day', NOW), rows);
  assert.ok(b.every((x) => x.expense === 0));
});
