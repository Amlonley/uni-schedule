export function normalizeSearchNeedle(rawValue) {
  return String(rawValue || "").toLowerCase().trim();
}

export function matchesSearchNeedle(rawHaystack, rawNeedle) {
  const needle = normalizeSearchNeedle(rawNeedle);
  if (!needle) return true;
  return String(rawHaystack || "").toLowerCase().includes(needle);
}

export function isClassVisibleInWeek(rawType, rawWeek) {
  const type = String(rawType || "normal");
  const week = rawWeek === "even" ? "even" : "odd";
  return type === "normal" || type === week;
}

export function canClassTypesOverlap(typeA, typeB) {
  return ["odd", "even"].some(
    (week) => isClassVisibleInWeek(typeA, week) && isClassVisibleInWeek(typeB, week),
  );
}

export function checkClassTimeConflict(c1, c2) {
  if (!c1 || !c2) return false;
  if (c1.day !== c2.day) return false;
  if (c1.id === c2.id) return false;
  return c1.start < c2.end && c1.end > c2.start;
}

export function normalizeSessionOffset(rawValue) {
  const normalizedText = String(rawValue ?? "")
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const parsed = Number(normalizedText || 0);
  if (!Number.isFinite(parsed)) return 0;
  const intValue = Math.floor(parsed);
  return Math.max(-9999, Math.min(9999, intValue));
}

export function computeSessionOffsetState({
  desiredSession,
  autoSessionBase,
  manualTouched = false,
  existingManual = false,
  normalizeOffset = normalizeSessionOffset,
} = {}) {
  const desired = Math.max(0, Math.floor(Number(desiredSession) || 0));
  const hasAutoBase =
    autoSessionBase !== null &&
    autoSessionBase !== undefined &&
    String(autoSessionBase).trim() !== "" &&
    Number.isFinite(Number(autoSessionBase));
  const safeAutoBase = hasAutoBase
    ? Math.max(1, Number(autoSessionBase) || 0)
    : null;

  const rawOffset = safeAutoBase === null ? desired : desired - safeAutoBase;
  const offset = normalizeOffset(rawOffset);
  const desiredDiffersFromAuto = safeAutoBase === null ? desired > 0 : desired !== safeAutoBase;
  const manual = offset !== 0 && (desiredDiffersFromAuto || Boolean(manualTouched) || Boolean(existingManual));

  return {
    desired,
    autoSessionBase: safeAutoBase,
    offset,
    manual,
  };
}
