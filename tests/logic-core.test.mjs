import assert from "node:assert/strict";
import {
  canClassTypesOverlap,
  checkClassTimeConflict,
  computeSessionOffsetState,
  isClassVisibleInWeek,
  matchesSearchNeedle,
  normalizeSearchNeedle,
  normalizeSessionOffset,
} from "../src/logic-core.js";

const tests = [];
const addTest = (name, fn) => tests.push({ name, fn });

addTest("class conflict: overlapping same-day classes conflict", () => {
  const a = { id: 1, day: 2, start: "09:00", end: "10:30" };
  const b = { id: 2, day: 2, start: "10:00", end: "11:30" };
  assert.equal(checkClassTimeConflict(a, b), true);
});

addTest("class conflict: same class id or different day does not conflict", () => {
  const base = { id: 4, day: 1, start: "08:00", end: "09:30" };
  assert.equal(
    checkClassTimeConflict(base, { ...base, start: "08:30", end: "10:00" }),
    false,
  );
  assert.equal(
    checkClassTimeConflict(base, { id: 5, day: 3, start: "08:30", end: "10:00" }),
    false,
  );
});

addTest("class type visibility and overlap by week", () => {
  assert.equal(isClassVisibleInWeek("normal", "odd"), true);
  assert.equal(isClassVisibleInWeek("odd", "odd"), true);
  assert.equal(isClassVisibleInWeek("odd", "even"), false);
  assert.equal(canClassTypesOverlap("odd", "even"), false);
  assert.equal(canClassTypesOverlap("normal", "even"), true);
});

addTest("search helpers normalize and match", () => {
  assert.equal(normalizeSearchNeedle("  DaTa  "), "data");
  assert.equal(matchesSearchNeedle("Advanced Database", "  data "), true);
  assert.equal(matchesSearchNeedle("Linear Algebra", "data"), false);
  assert.equal(matchesSearchNeedle("هر متنی", ""), true);
});

addTest("session offset state: auto-base and manual flag", () => {
  const exactAuto = computeSessionOffsetState({
    desiredSession: 3,
    autoSessionBase: 3,
    manualTouched: false,
    existingManual: false,
  });
  assert.equal(exactAuto.offset, 0);
  assert.equal(exactAuto.manual, false);

  const changedManual = computeSessionOffsetState({
    desiredSession: 5,
    autoSessionBase: 3,
    manualTouched: true,
    existingManual: false,
  });
  assert.equal(changedManual.offset, 2);
  assert.equal(changedManual.manual, true);
});

addTest("session offset state: missing auto base and clamps", () => {
  const missingAuto = computeSessionOffsetState({
    desiredSession: 4,
    autoSessionBase: null,
    manualTouched: false,
    existingManual: false,
  });
  assert.equal(missingAuto.offset, 4);
  assert.equal(missingAuto.manual, true);

  const zeroWhenMissingAuto = computeSessionOffsetState({
    desiredSession: 0,
    autoSessionBase: null,
    manualTouched: false,
    existingManual: false,
  });
  assert.equal(zeroWhenMissingAuto.offset, 0);
  assert.equal(zeroWhenMissingAuto.manual, false);

  assert.equal(normalizeSessionOffset("۲۰۰۰۰"), 9999);
  assert.equal(normalizeSessionOffset("-25000"), -9999);
});

let passed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed += 1;
    console.log(`PASS ${t.name}`);
  } catch (err) {
    console.error(`FAIL ${t.name}`);
    throw err;
  }
}
console.log(`Done. ${passed}/${tests.length} tests passed.`);
