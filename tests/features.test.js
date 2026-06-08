import test from 'node:test';
import assert from 'node:assert/strict';
import { featureRegistry } from '../src/features/index.js';

test('feature registry documents modular upgrade points', () => {
  assert.deepEqual(
    featureRegistry.map((feature) => feature.name),
    ['auth', 'uploads', 'users', 'posts', 'notifications', 'search', 'moderation', 'messages']
  );
  for (const feature of featureRegistry) {
    assert.equal(typeof feature.mountPath, 'string');
    assert.equal(typeof feature.createRouter, 'function');
  }
});
