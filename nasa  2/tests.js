/**
 * Ignis Atlas - Logic Verification Test Suite
 * Validates 5 core coverage scenarios with hand-computed expected outcomes,
 * plus rankings and nextTests lunar envelope grid recommendations.
 * 
 * Execution: `node tests.js`
 */

import { calculateCoverage } from './src/logic/coverage.js';
import { rankExperiments } from './src/logic/rank.js';
import { findNextTests } from './src/logic/nextTests.js';
import experiments from './data/experiments.json' with { type: 'json' };

// Target reference experiment from experiments.json: PSI-25 (BASS-II)
// Hardware: MSG, Fuel: Solid, Materials: ["PMMA (Acrylic)", "Cotton-fiberglass blend"]
// O2: [15.0, 22.2], Pressure: [11.6, 14.7], Airflow: [0.0, 40.0], Gravity: 0g
const expBass = experiments.find((e) => e.id === 'PSI-25');

console.log('====================================================');
console.log('   IGNIS ATLAS - DATA / COVERAGE TEST SUITE (PSI Standards)');
console.log('====================================================\n');

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
  }
}

// -----------------------------------------------------------------------------
// TEST 1: Exact Match (all conditions match, material listed, 0g)
// Hand-computed:
// o2=20.0 in [15.0, 22.2] (gap 0), p=13.0 in [11.6, 14.7] (gap 0), flow=2.0 in [0, 40.0] (gap 0)
// material "pmma" listed (gap 0), gravity "0g" matches microgravity (gap 0)
// Weighted sum = 0.0, D = 0.00 <= 0.10, materialGap == 0 -> "covered"
// -----------------------------------------------------------------------------
console.log('Test 1: Exact match scenario');
const scenario1 = {
  o2: 20.0,
  pressure_psi: 13.0,
  airflow_cms: 2.0,
  gravity: '0g',
  material: 'pmma',
};
const res1 = calculateCoverage(scenario1, expBass);
console.log('  Result 1:', { status: res1.status, distance: res1.distance });
assert(res1.status === 'covered', 'Scenario 1 status must be "covered"');
assert(res1.distance === 0.0, 'Scenario 1 distance must be exactly 0.0');

// -----------------------------------------------------------------------------
// TEST 2: Right Conditions but Wrong Fuel Type -> "near"
// Hand-computed:
// o2=20.0 (gap 0), p=13.0 (gap 0), flow=2.0 (gap 0), gravity="0g" (gap 0)
// material="sibal" is not in materials -> material gap = 1.0 (weight 0.15)
// Total weighted sum = 0.15, total weight = 1.0 -> D = 0.15
// D <= 0.35, but materialGap != 0 -> status is "near"
// -----------------------------------------------------------------------------
console.log('\nTest 2: Right conditions but wrong fuel type -> "near"');
const scenario2 = {
  o2: 20.0,
  pressure_psi: 13.0,
  airflow_cms: 2.0,
  gravity: '0g',
  material: 'sibal',
};
const res2 = calculateCoverage(scenario2, expBass);
console.log('  Result 2:', { status: res2.status, distance: res2.distance });
assert(res2.status === 'near', 'Scenario 2 status must be "near"');
assert(res2.distance === 0.15, 'Scenario 2 distance must be exactly 0.15');

// -----------------------------------------------------------------------------
// TEST 3: Unknown Material / Far Out-of-Bounds Conditions -> "gap"
// Hand-computed:
// o2=70.0 vs [15.0, 22.2] -> gap = (70 - 22.2)/100 = 0.478, weighted = 0.1673
// p=2.0 vs [11.6, 14.7] -> gap = (11.6 - 2)/75 = 0.128, weighted = 0.0320
// flow=45.0 vs [0, 40.0] -> gap = (45 - 40)/50 = 0.100, weighted = 0.0150
// material="other" -> gap = 1.0, weighted = 0.1500
// gravity="0g" -> gap = 0.0, weighted = 0.0000
// Total weighted sum = 0.1673 + 0.0320 + 0.0150 + 0.1500 = 0.3643
// D = 0.3643 > 0.35 -> status is "gap"
// -----------------------------------------------------------------------------
console.log('\nTest 3: Far conditions and unknown material -> "gap"');
const scenario3 = {
  o2: 70.0,
  pressure_psi: 2.0,
  airflow_cms: 45.0,
  gravity: '0g',
  material: 'other',
};
const res3 = calculateCoverage(scenario3, expBass);
console.log('  Result 3:', { status: res3.status, distance: res3.distance });
assert(res3.status === 'gap', 'Scenario 3 status must be "gap"');
assert(res3.distance > 0.35, 'Scenario 3 distance must be > 0.35');

// -----------------------------------------------------------------------------
// TEST 4: Lunar Gravity Capped at "near"
// Hand-computed:
// o2=20.0 (gap 0), p=13.0 (gap 0), flow=2.0 (gap 0), material="pmma" (gap 0)
// gravity="lunar" vs 0g -> gap = 1.0 (weight 0.10)
// Total weighted sum = 0.10, total weight = 1.0 -> D = 0.10
// D <= 0.10 and materialGap == 0 would yield "covered",
// BUT scenario gravity is "lunar", triggering the Cap Rule -> status capped at "near"
// -----------------------------------------------------------------------------
console.log('\nTest 4: Lunar gravity capped at "near"');
const scenario4 = {
  o2: 20.0,
  pressure_psi: 13.0,
  airflow_cms: 2.0,
  gravity: 'lunar',
  material: 'pmma',
};
const res4 = calculateCoverage(scenario4, expBass);
console.log('  Result 4:', { status: res4.status, distance: res4.distance });
assert(res4.status === 'near', 'Scenario 4 status must be capped at "near"');
assert(res4.distance === 0.10, 'Scenario 4 distance must be 0.10');
assert(
  res4.reasons.some((r) => r.includes('capped at \'near\'')),
  'Scenario 4 must include cap rule explanation reason'
);

// -----------------------------------------------------------------------------
// TEST 5: Scenario with No Comparable Data -> "insufficient"
// -----------------------------------------------------------------------------
console.log('\nTest 5: Scenario with no comparable data -> "insufficient"');
const scenario5 = {
  o2: 30.0,
  pressure_psi: null,
  airflow_cms: null,
  gravity: '0g',
  material: 'pmma',
};
const res5 = calculateCoverage(scenario5, expBass);
console.log('  Result 5:', { status: res5.status, distance: res5.distance });
assert(res5.status === 'insufficient', 'Scenario 5 status must be "insufficient"');
assert(res5.distance === null, 'Scenario 5 distance must be null');

// -----------------------------------------------------------------------------
// ADDITIONAL SUITE TESTS: rankExperiments & nextTests
// -----------------------------------------------------------------------------
console.log('\nTest 6: rankExperiments ordering');
const rankings = rankExperiments(scenario1, experiments);
assert(rankings.length === experiments.length, 'rankExperiments must evaluate all experiments');
assert(rankings[0].coverage.status === 'covered', 'First ranked experiment must have status "covered"');
assert(rankings[0].experiment.id === 'PSI-25', 'First ranked experiment must be PSI-25');

console.log('\nTest 7: nextTests lunar parameter envelope grid search');
const nextTestsResult = findNextTests(experiments);
assert(nextTestsResult.disclaimer.includes('logged rows in experiments.json only'), 'nextTests must declare data dependency');
assert(nextTestsResult.farthestCells.length === 3, 'nextTests must return exactly the 3 farthest cells');
console.log('  Top 3 Farthest Lunar Cells:');
nextTestsResult.farthestCells.forEach((c, idx) => {
  console.log(`    ${idx + 1}. O2 ${c.o2}%, P ${c.pressure_psi} psi (dist: ${c.minDistance}) - ${c.reason}`);
});

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passedCount} / ${totalCount} PASSED`);
console.log('====================================================');

if (passedCount === totalCount) {
  process.exit(0);
} else {
  process.exit(1);
}
