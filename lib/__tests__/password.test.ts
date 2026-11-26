/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { passwordChecks, validateNewPassword, validatePasswordRequired } from '@/lib/validation';

test('new password needs 8+ chars with upper, lower and digit', () => {
  assert.equal(validateNewPassword('Flosso2026'), undefined, 'harf va raqam yetarli');
  assert.equal(validateNewPassword('Far!dun#26'), undefined, 'belgilar ham ruxsat');
  assert.notEqual(validateNewPassword(''), undefined);
  assert.notEqual(validateNewPassword('Abc1234'), undefined, '7 ta belgi');
  assert.notEqual(validateNewPassword('flosso2026'), undefined, 'katta harf yo\'q');
  assert.notEqual(validateNewPassword('FLOSSO2026'), undefined, 'kichik harf yo\'q');
  assert.notEqual(validateNewPassword('FlossoCash'), undefined, 'raqam yo\'q');
});

test('password checks report each rule', () => {
  assert.deepEqual(passwordChecks('abc'), { length: false, upper: false, lower: true, digit: false });
  assert.deepEqual(passwordChecks('Flosso2026'), { length: true, upper: true, lower: true, digit: true });
});

test('sign-in only requires a password (old short passwords still work)', () => {
  assert.equal(validatePasswordRequired('abc123'), undefined);
  assert.notEqual(validatePasswordRequired(''), undefined);
});
