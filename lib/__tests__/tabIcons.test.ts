/// <reference types="node" />

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// PNG sarlavhasidan (IHDR) kenglik va balandlikni o'qiydi.
function pngSize(path: string): [number, number] {
  const data = readFileSync(path);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}

// iOS tab ikonkasini rasm o'lchamida (pt) ko'rsatadi — @1x/@2x/@3x 30/60/90 px bo'lishi shart.
test('native tab logo ships 30pt at @1x/@2x/@3x', () => {
  assert.deepEqual(pngSize('assets/tab-logo.png'), [30, 30]);
  assert.deepEqual(pngSize('assets/tab-logo@2x.png'), [60, 60]);
  assert.deepEqual(pngSize('assets/tab-logo@3x.png'), [90, 90]);
});

test('web tab logo is sharp at 44px on 3x screens', () => {
  const [width] = pngSize('assets/tab-logo-web.png');
  assert.ok(width >= 132);
});
