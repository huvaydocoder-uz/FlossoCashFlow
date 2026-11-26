/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { accessState, isTabVisible, type Membership } from '@/lib/membership';

const business = { id: 'b1', name: 'Flosso', join_code: 'ABC234' };
const member = (role: Membership['role'], status: Membership['status']): Membership => ({ role, status, business });

test('accessState covers loading, error, none, pending, owner, seller', () => {
  assert.equal(accessState({ isPending: true, isError: false, data: undefined }), 'loading');
  assert.equal(accessState({ isPending: false, isError: true, data: undefined }), 'error');
  assert.equal(accessState({ isPending: false, isError: false, data: null }), 'none');
  assert.equal(accessState({ isPending: false, isError: false, data: member('seller', 'pending') }), 'pending');
  assert.equal(accessState({ isPending: false, isError: false, data: member('owner', 'active') }), 'owner');
  assert.equal(accessState({ isPending: false, isError: false, data: member('seller', 'active') }), 'seller');
});

test('seller sees only Flosso and Profile tabs', () => {
  assert.equal(isTabVisible('index', 'seller'), false);
  assert.equal(isTabVisible('debts', 'seller'), false);
  assert.equal(isTabVisible('flosso', 'seller'), true);
  assert.equal(isTabVisible('profile', 'seller'), true);
});

test('owner sees every tab', () => {
  for (const tab of ['index', 'history', 'flosso', 'debts', 'profile']) {
    assert.equal(isTabVisible(tab, 'owner'), true);
  }
});

test('failed background refetch keeps cached access', () => {
  assert.equal(accessState({ isPending: false, isError: true, data: member('owner', 'active') }), 'owner');
  assert.equal(accessState({ isPending: false, isError: true, data: null }), 'none');
});
