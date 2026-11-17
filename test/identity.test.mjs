// The shard's identity: the slug upload, the grid and /slug/<slug> use.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the shard is glowfen, named Glowfen', () => {
  const identity = JSON.parse(readFileSync(new URL('../src/identity.json', import.meta.url), 'utf8'));
  assert.equal(identity.slug, 'glowfen');
  assert.equal(identity.name, 'Glowfen');
});
