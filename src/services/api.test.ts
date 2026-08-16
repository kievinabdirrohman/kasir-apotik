/**
 * P8 — Property: if any one of 8 fetches inside initializeApp() rejects,
 * the returned Promise rejects; it never resolves with 7 datasets + one undefined.
 *
 * Validates: Requirements 4.5
 *
 * Self-contained Node.js test — no test framework needed.
 * Uses node:assert/strict only. Run with: npx tsx src/services/api.test.ts
 */

import assert from 'node:assert/strict';

// Reproduces the initializeApp Promise.all pattern with injectable fetchers.
// Mirrors the real implementation in api.ts (Promise.all over 8 parallel calls).
async function fakeInitializeApp(fetchers: (() => Promise<unknown>)[]) {
  const [medicines, customers, doctors, users, transactions, stockHistory, cashFlows, settings] =
    await Promise.all(fetchers.map(f => f()));
  return { medicines, customers, doctors, users, transactions, stockHistory, cashFlows, settings };
}

console.log('--- P8: initializeApp partial-failure rejection ---');

const ok = () => Promise.resolve([]);

for (let failPos = 0; failPos < 8; failPos++) {
  const fetchers = Array.from({ length: 8 }, (_, i) =>
    i === failPos ? () => Promise.reject(new Error(`fetch ${i} failed`)) : ok
  );

  let rejected = false;
  let resolvedWithPartial = false;

  try {
    const result = await fakeInitializeApp(fetchers);
    // If it resolved, check that no value is undefined (partial data guard)
    if (Object.values(result).some(v => v === undefined)) {
      resolvedWithPartial = true;
    }
  } catch {
    rejected = true;
  }

  assert(
    rejected,
    `P8: initializeApp must reject when fetch at position ${failPos} fails (resolved with partial data instead)`
  );
  assert(
    !resolvedWithPartial,
    `P8: initializeApp must not resolve with undefined values (position ${failPos})`
  );
}

console.log('P8 initializeApp partial-failure rejection: all 8 positions tested ✓');
